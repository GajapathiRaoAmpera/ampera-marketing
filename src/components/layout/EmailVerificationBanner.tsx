"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { authApi, ApiError } from "@/lib/api";
import styles from "./EmailVerificationBanner.module.scss";

const DISMISS_KEY = "email-verify-banner-dismissed";

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { show } = useToast();
  const [isDismissed, setIsDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1"
  );
  const [isSending, setIsSending] = useState(false);

  if (!user || user.email_verified !== false || isDismissed) return null;

  async function handleResend() {
    setIsSending(true);
    try {
      const res = await authApi.resendVerification();
      show(res.message, "success");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't send verification email. Please try again.", "error");
    } finally {
      setIsSending(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setIsDismissed(true);
  }

  return (
    <div className={styles.banner}>
      <span>Please verify your email address to secure your account.</span>
      <div className={styles.actions}>
        <button type="button" className={styles.link} onClick={handleResend} disabled={isSending}>
          {isSending ? "Sending…" : "Resend email"}
        </button>
        <button type="button" className={styles.dismiss} onClick={handleDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
