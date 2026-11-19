"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";
import styles from "../login/page.module.scss";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Your email has been verified.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.userMessage : "This verification link is invalid or has expired.");
      });
  }, [token]);

  return (
    <>
      <h1 className={styles.title}>{status === "success" ? "Email verified" : "Verify your email"}</h1>
      <p className={styles.subtitle}>
        {status === "verifying" && "Confirming your email address…"}
        {status !== "verifying" && message}
      </p>

      {status === "error" && (
        <p className={styles.footer}>
          You can request a new verification email from your account settings once logged in.
        </p>
      )}

      <p className={styles.footer}>
        <Link href={status === "success" ? "/dashboard" : "/login"}>
          {status === "success" ? "Go to dashboard" : "Back to login"}
        </Link>
      </p>
    </>
  );
}
