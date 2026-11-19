import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          disableAutoSelect: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

const SDK_SRC = "https://accounts.google.com/gsi/client";

let sdkLoadPromise: Promise<void> | null = null;
// initialize() configures a global singleton on window.google.accounts.id -
// calling it again (e.g. on React StrictMode's dev-only double-invoke, or a
// second mounted consumer of this hook) just re-registers the same config
// and trips Google's own "called multiple times" warning. Guard it at module
// scope so it only ever runs once per page load, no matter how many
// components call this hook or how many times an effect re-fires.
let hasInitialized = false;

function loadGoogleIdentitySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve) => {
    if (document.getElementById("google-identity-sdk")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-identity-sdk";
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });

  return sdkLoadPromise;
}

/**
 * Loads the Google Identity Services SDK once and reports readiness.
 *
 * Deliberately uses Google's own rendered button (a reliable OAuth popup),
 * NOT the "One Tap" floating-card prompt() flow. One Tap is finicky
 * (silently no-ops under third-party-cookie restrictions, enters a cooldown
 * after being dismissed once, and doesn't auto-dismiss on credential receipt
 * without an explicit cancel() call). The rendered button behaves like a
 * normal "Continue with X" popup, consistent with the rest of this app's
 * social-login UX.
 *
 * Unlike the Facebook JS SDK (popup + authorization code), GIS hands the
 * caller a signed ID token directly via `callback` - no server-side code
 * exchange step, verified instead by app/services/oauth/google_client.py.
 */
export function useGoogleIdentity(onCredential: (idToken: string) => void) {
  const [isReady, setIsReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const mounted = useRef(true);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    mounted.current = true;
    if (!clientId) return;
    loadGoogleIdentitySdk().then(() => {
      if (!mounted.current || !window.google) return;
      if (!hasInitialized) {
        hasInitialized = true;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
          // Only suppresses the automatic One Tap prompt - it has no effect
          // on renderButton()'s personalized "Continue as <name>" state,
          // which Google derives from its own g_state session cookie. See
          // SocialLoginButtons.tsx for how that's actually suppressed.
          auto_select: false,
        });
      }
      setIsReady(true);
    });
    return () => {
      mounted.current = false;
    };
  }, [clientId]);

  return { isReady, clientId };
}
