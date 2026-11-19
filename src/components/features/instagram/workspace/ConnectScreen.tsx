"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { InstagramIcon } from "@/components/layout/icons";
import { InstagramConnectPanel } from "../InstagramConnectPanel";
import styles from "./workspace.module.scss";

interface ConnectScreenProps {
  businessId: string;
  agentId?: string;
  onConnected: () => void;
}

/** Shown until an Instagram account is connected: three steps, one button. */
export function ConnectScreen({ businessId, agentId, onConnected }: ConnectScreenProps) {
  const searchParams = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [showFacebook, setShowFacebook] = useState(false);
  const status = searchParams.get("status");
  const who = (searchParams.get("username") || "this account").replace(/^@/, "");
  const warning =
    status === "duplicate"
      ? `@${who} is already connected somewhere else. Disconnect it there first, then try again.`
      : status === "cancelled"
        ? "Instagram login was cancelled, so nothing was connected."
        : status === "error"
          ? "We couldn't connect your Instagram account. Make sure it is a Professional (Business or Creator) account, then try again. If you've reached your plan's account limit, contact support."
          : null;

  function connect() {
    setRedirecting(true);
    const params = new URLSearchParams({ business_id: businessId });
    if (agentId) params.set("agent_id", agentId);
    // Instagram Login has no popup SDK, so the browser navigates away and back.
    window.open(`/api/backend/users/instagram/login/start?${params}`, "_self");
  }

  return (
    <div className={styles.workspace}>
      {warning && (
        <div className={styles.warning} role="alert">
          {warning}
        </div>
      )}
      <section className={styles.connect}>
        <div className={styles.connectText}>
          <span className={styles.pill}>
            <InstagramIcon size={14} /> Instagram
          </span>
          <h1>Reply to every comment and DM, automatically.</h1>
          <p>
            Connect your Instagram account, pick a post, and choose what to reply. Every comment with your keyword gets an instant reply and a DM,
            day and night.
          </p>
          <button type="button" className={styles.primaryCta} onClick={connect} disabled={redirecting}>
            <InstagramIcon size={20} /> {redirecting ? "Opening Instagram…" : "Connect Instagram"}
          </button>
          <span className={styles.connectFoot}>Takes about a minute. You can disconnect any time.</span>
        </div>
        <ol className={styles.connectSteps}>
          <li>
            <div>
              <strong>Log in with Instagram</strong>
              <span>Use a Professional account (Business or Creator). No Facebook Page needed.</span>
            </div>
          </li>
          <li>
            <div>
              <strong>Create an automation</strong>
              <span>Choose a post, a keyword like “price”, and the reply to send.</span>
            </div>
          </li>
          <li>
            <div>
              <strong>Turn it on</strong>
              <span>That&apos;s it. Watch comments get answered on your dashboard.</span>
            </div>
          </li>
        </ol>
      </section>

      <details className={`${styles.card} ${styles.details}`} open={showFacebook} onToggle={(event) => setShowFacebook((event.target as HTMLDetailsElement).open)}>
        <summary>Having trouble? Connect through a Facebook Page instead</summary>
        {showFacebook && <InstagramConnectPanel businessId={businessId} agentId={agentId} onConnected={onConnected} />}
      </details>
    </div>
  );
}
