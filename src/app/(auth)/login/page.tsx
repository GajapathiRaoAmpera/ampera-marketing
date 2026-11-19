"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, Icon, Input } from "@/components/ui";
import { motion, MotionConfig, type Variants } from "motion/react";
import styles from "./page.module.scss";

// Card springs in, then its contents stagger (Motion). reducedMotion="user" drops the slide.
const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};
const CHANNELS = [
  ["WhatsApp", "#25d366"],
  ["Instagram", "#e1306c"],
  ["Messenger", "#0084ff"],
] as const;

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  // Demo: prefilled; the mock backend accepts any email and password.
  const [email, setEmail] = useState("demo@amperatech.ai");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
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
    <MotionConfig reducedMotion="user">
      <motion.div
        data-login-form
        className={styles.card}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
      >
        <motion.div variants={list} initial="hidden" animate="show">
          <motion.p variants={item} className={styles.demoPill}>
            <span aria-hidden className={styles.liveDot} />
            Demo workspace · sample data
          </motion.p>
          <motion.h1 variants={item} className={styles.cardTitle}>
            Welcome back
          </motion.h1>
          <motion.p variants={item} className={styles.cardLead}>
            Log in to your AI inbox for WhatsApp, Instagram and Messenger. Any email and password
            work in this demo.
          </motion.p>

          <motion.form variants={item} className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <div role="alert" className={styles.errorBanner}>
                {error}
              </div>
            )}
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              leftIcon={<Icon name="mail" size={16} />}
            />
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              leftIcon={<Icon name="lock" size={16} />}
              rightSlot={
                <button
                  type="button"
                  className={styles.reveal}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                </button>
              }
            />
            <div className={styles.forgotPasswordRow}>
              <Link href="/forgot-password" className={styles.forgotPasswordLink}>
                Forgot password?
              </Link>
            </div>
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                size="lg"
                fullWidth
                isLoading={isLoading}
                className={styles.submit}
                rightIcon={<Icon name="arrowRight" size={16} />}
              >
                Log in
              </Button>
            </motion.div>
          </motion.form>

          <motion.p variants={item} className={styles.cardFooter}>
            New to Ampera? <Link href="/register">Create an account</Link>
          </motion.p>
        </motion.div>
      </motion.div>

      <motion.p
        className={styles.channels}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        Works with
        {CHANNELS.map(([name, color]) => (
          <span key={name} className={styles.channel}>
            <span aria-hidden className={styles.channelDot} style={{ background: color }} />
            {name}
          </span>
        ))}
      </motion.p>
    </MotionConfig>
  );
}
