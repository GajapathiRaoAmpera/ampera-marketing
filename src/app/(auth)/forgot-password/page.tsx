"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import styles from "../login/page.module.scss";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      // The backend always returns the same generic success response no
      // matter what: whether the account exists, is OAuth-only, or the
      // email actually sent, so this UI never branches on the result, only
      // on whether the request itself failed (e.g. rate-limited).
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <>
        <h1 className={styles.title}>Check your email</h1>
        <p className={styles.subtitle}>
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your
          password. The link expires in 30 minutes.
        </p>
        <p className={styles.footer}>
          <Link href="/login">Back to login</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Forgot your password?</h1>
      <p className={styles.subtitle}>
        Enter the email address on your account and we&apos;ll send you a link to reset your
        password.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
        <Button type="submit" fullWidth isLoading={isLoading}>
          Send reset link
        </Button>
      </form>

      <p className={styles.footer}>
        <Link href="/login">Back to login</Link>
      </p>
    </>
  );
}
