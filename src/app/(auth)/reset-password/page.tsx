"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import styles from "../login/page.module.scss";

type Status = "form" | "success" | "invalid-link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "form" : "invalid-link");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (!token) {
      setStatus("invalid-link");
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword({ token, new_password: newPassword });
      setStatus("success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // The backend returns 400 for both an expired/invalid token and an
        // OAuth-only account with no password to reset, same generic
        // messaging either way, matching the reset flow's own account-
        // enumeration-avoidance stance.
        setStatus("invalid-link");
      } else {
        setError(err instanceof ApiError ? err.userMessage : "Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (status === "invalid-link") {
    return (
      <>
        <h1 className={styles.title}>Link invalid or expired</h1>
        <p className={styles.subtitle}>
          This password reset link is no longer valid. Reset links expire after 30 minutes,
          request a new one to continue.
        </p>
        <p className={styles.footer}>
          <Link href="/forgot-password">Request a new reset link</Link>
        </p>
      </>
    );
  }

  if (status === "success") {
    return (
      <>
        <h1 className={styles.title}>Password reset</h1>
        <p className={styles.subtitle}>Your password has been changed. You can now log in with it.</p>
        <p className={styles.footer}>
          <Link href="/login">Go to login</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Choose a new password</h1>
      <p className={styles.subtitle}>Enter a new password for your account.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <Input
          label="New password"
          type="password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
          autoFocus
        />
        <Input
          label="Confirm new password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <Button type="submit" fullWidth isLoading={isLoading}>
          Reset password
        </Button>
      </form>

      <p className={styles.footer}>
        <Link href="/login">Back to login</Link>
      </p>
    </>
  );
}
