"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import styles from "./page.module.scss";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  // Demo: prefilled; the mock backend accepts any email and password.
  const [email, setEmail] = useState("demo@amperatech.ai");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.subtitle}>Demo workspace with sample data. Any email and password work.</p>

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
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <div className={styles.forgotPasswordRow}>
          <Link href="/forgot-password" className={styles.forgotPasswordLink}>
            Forgot password?
          </Link>
        </div>
        <Button type="submit" fullWidth isLoading={isLoading}>
          Log in
        </Button>
      </form>

      <p className={styles.footer}>
        Don&apos;t have an account? <Link href="/register">Sign up</Link>
      </p>
    </>
  );
}
