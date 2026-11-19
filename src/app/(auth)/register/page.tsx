"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import { SocialLoginButtons } from "@/components/features/auth/SocialLoginButtons";
import styles from "../login/page.module.scss";

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <h1 className={styles.title}>Create your account</h1>
      <p className={styles.subtitle}>Start converting conversations into customers today.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <Input
          label="Full name"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
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
          placeholder="At least 10 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={10}
          autoComplete="new-password"
        />
        <Button type="submit" fullWidth isLoading={isLoading}>
          Create account
        </Button>
      </form>

      <div className={styles.divider}>or</div>

      <SocialLoginButtons />

      <p className={styles.footer}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
