"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGoogleIdentity } from "@/lib/hooks/useGoogleIdentity";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui";
import styles from "./SocialLoginButtons.module.scss";

function FacebookMonoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M18 9a9 9 0 10-10.4 8.9v-6.3H5.3V9h2.3V7.1c0-2.3 1.4-3.5 3.4-3.5.97 0 2 .17 2 .17v2.2h-1.1c-1.1 0-1.45.7-1.45 1.4V9h2.5l-.4 2.6h-2.1v6.3A9 9 0 0018 9z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth();
  const { show } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  const handleCredential = useCallback(
    (idToken: string) => {
      // The rendered button's own popup closes itself once a credential is
      // returned, no manual dismiss needed (unlike the One Tap prompt()
      // flow this replaces, which required an explicit cancel()).
      setIsConnecting(true);
      loginWithGoogle(idToken)
        .catch(() => show("Couldn't sign in with Google. Please try again.", "error"))
        .finally(() => setIsConnecting(false));
    },
    [loginWithGoogle, show]
  );

  const { isReady } = useGoogleIdentity(handleCredential);

  useEffect(() => {
    if (!isReady || renderedRef.current || !containerRef.current || !window.google) return;
    renderedRef.current = true;

    // renderButton() shows a personalized "Continue as <name>" state whenever
    // Google's own g_state cookie says this browser has an active paired
    // session with our client_id, auto_select/disableAutoSelect (One Tap
    // controls) don't affect this at all. Clearing the cookie before
    // rendering forces the generic "Continue with Google" button + account
    // chooser instead, every time.
    document.cookie = "g_state=; Max-Age=0; path=/; SameSite=Lax";

    // Google lays out the icon+text cluster centered within whatever pixel
    // width we tell it here: a fixed guess (previously 320) left the icon
    // off-center once our CSS then force-stretched the iframe to 100% of a
    // wider container. Measuring the real container width makes Google's
    // internal centering match our actual rendered width.
    const measuredWidth = Math.round(containerRef.current.getBoundingClientRect().width) || 320;

    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "outline",
      // Google's fixed button heights: small≈20px, medium≈32px, large≈40px.
      // "large" is the one we match the Facebook button's height to below
      // (see .googleButtonWrap / .facebookButton in the stylesheet).
      size: "large",
      width: measuredWidth,
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
    });
  }, [isReady]);

  return (
    <div className={styles.googleButtonWrap}>
      <div ref={containerRef} className={styles.googleButton} />
      {!isReady && <div className={styles.googleButtonPlaceholder}>Loading Google sign-in…</div>}
      {isConnecting && <div className={styles.googleButtonOverlay}>Signing in…</div>}
    </div>
  );
}

// Full-page redirect to Meta's own OAuth dialog, not the JS SDK popup. The
// popup flow (FB.login + FedCM) currently fails with an undocumented
// PLATFORM_FEDCM_ERROR/NetworkError in Chrome as of Meta's ~August 2026
// FedCM rollout. This classic redirect flow is Meta's oldest, most stable,
// best-documented pattern and doesn't touch FedCM at all. The browser lands
// back on /api/auth/facebook/callback (a Next.js route), which exchanges
// the code server-side and establishes the session, see that route for
// the other half of this flow.
function buildFacebookLoginUrl(appId: string): string {
  const redirectUri = `${window.location.origin}/api/auth/facebook/callback`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "public_profile,email",
  });
  return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
}

function FacebookLoginButton() {
  const { show } = useToast();
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID;

  const handleClick = useCallback(() => {
    if (!appId) {
      show("Facebook login isn't configured on this deployment.", "error");
      return;
    }
    window.location.href = buildFacebookLoginUrl(appId);
  }, [appId, show]);

  return (
    <Button
      type="button"
      variant="secondary"
      fullWidth
      onClick={handleClick}
      leftIcon={<FacebookMonoIcon />}
      className={styles.facebookButton}
    >
      Continue with Facebook
    </Button>
  );
}

export function SocialLoginButtons() {
  return (
    <div className={styles.stack}>
      <GoogleLoginButton />
      <FacebookLoginButton />
    </div>
  );
}
