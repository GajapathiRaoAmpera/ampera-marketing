import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    FB?: {
      init: (params: {
        appId: string;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } | null; status: string }) => void,
        params:
          | {
              // WhatsApp Embedded Signup (or any Login Config-based) popup.
              config_id: string;
              response_type: "code";
              override_default_response_type: true;
              extras?: Record<string, unknown>;
            }
          | {
              // Plain Facebook Login for authentication - no Login Config needed.
              scope: string;
              response_type: "code";
            }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const GRAPH_VERSION = "v22.0";

// The SDK is a single global (window.FB) that can only be FB.init()'d with
// one app_id at a time, but this app talks to Meta as TWO separate apps
// (a dedicated login app, and the Instagram/WhatsApp/Messenger app whose
// config_ids only work when the SDK is init'd under THAT app). Re-running
// FB.init with a different appId re-points the shared window.FB instance,
// so each distinct appId gets its own load/init promise here, and re-inits
// (cheap, synchronous) whenever a caller asks for a different appId than
// whichever one last initialized it.
let sdkScriptPromise: Promise<void> | null = null;
let initializedAppId: string | null = null;

function loadFacebookScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (sdkScriptPromise) return sdkScriptPromise;

  sdkScriptPromise = new Promise((resolve) => {
    if (window.FB) {
      resolve();
      return;
    }
    window.fbAsyncInit = () => resolve();

    if (document.getElementById("facebook-jssdk")) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  });

  return sdkScriptPromise;
}

async function loadFacebookSdk(appId: string): Promise<void> {
  await loadFacebookScript();
  if (initializedAppId === appId) return;
  window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION });
  initializedAppId = appId;
}

/**
 * Loads the Facebook JS SDK and initializes it for the given app, reporting
 * readiness. Required before calling FB.login. Pass the app_id whose
 * config_id/scope this caller is about to use - the login button and the
 * Instagram/WhatsApp connect panels use different Meta apps, so each must
 * pass its own.
 */
export function useFacebookSdk(appId: string | undefined) {
  const [isReady, setIsReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setIsReady(false);
    if (!appId) return;
    loadFacebookSdk(appId).then(() => {
      if (mounted.current) setIsReady(true);
    });
    return () => {
      mounted.current = false;
    };
  }, [appId]);

  return { isReady, appId };
}
