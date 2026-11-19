"use client";

import { useState } from "react";
import { adminApi, ApiError, type AccountSubscription } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { formatTimeLeft, useCountdown } from "@/lib/hooks/useCountdown";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Skeleton } from "@/components/ui";
import { Panel, formatDate } from "./AdminUi";
import styles from "./TrialPanel.module.scss";

const STATE_COPY: Record<AccountSubscription["state"], string> = {
  pending: "Waiting for approval. The free period starts the day the account is approved.",
  free_trial: "In the free period.",
  free: "On the free tier, with no end date.",
  paid: "On a paid plan.",
  expired: "The free period is over and nothing paid is running. The account is locked until it subscribes.",
};

const SOURCE_COPY: Record<AccountSubscription["trial_days_source"], string> = {
  user: "set for this account",
  plan: "set on the Free plan",
  global: "the platform's length",
  default: "the built-in default",
};

function parseDays(value: string): number | null {
  const days = Number(value);
  return value.trim() !== "" && Number.isInteger(days) && days >= 0 && days <= 3650 ? days : null;
}

function Clock({ endsAt, label }: { endsAt: string; label: string }) {
  const left = useCountdown(endsAt);
  if (!left) return null;
  return (
    <div className={styles.clock}>
      <span className={styles.clockValue}>{formatTimeLeft(left)}</span>
      {!left.expired && <span className={styles.clockLabel}>{label}</span>}
    </div>
  );
}

/** One account's free period and billing cycle: where it stands, and how to change it. */
export function AccountTrialPanel({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const { show } = useToast();
  const info = useAsync(() => adminApi.getUserSubscription(userId), [userId]);
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);

  const sub = info.data;
  if (info.isLoading || !sub) return <Skeleton height={160} />;

  async function change(
    change: Parameters<typeof adminApi.changeUserTrial>[1],
    done: string
  ) {
    setBusy(true);
    try {
      await adminApi.changeUserTrial(userId, change);
      show(done, "success");
      setDays("");
      info.refresh();
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't change the free trial.", "error");
    } finally {
      setBusy(false);
    }
  }

  const parsed = parseDays(days);
  const trial = sub.trial;
  const neverEnds = sub.state === "free" || (trial !== null && trial.days === null);

  return (
    <Panel title="Free trial & billing" description="How long this account's free period lasts, and where its paid cycle stands.">
      <p className={styles.state}>{STATE_COPY[sub.state]}</p>

      {sub.state === "paid" && sub.countdown && (
        <>
          <Clock endsAt={sub.countdown.ends_at} label={sub.in_grace ? "of grace left (renewal is late)" : "until the cycle ends"} />
          <p className={styles.fine}>
            {sub.billing_interval ? `${sub.billing_interval.replace("_", "-")} cycle` : "Billing cycle"} · ends {formatDate(sub.countdown.ends_at)}
          </p>
        </>
      )}
      {sub.state === "paid" && !sub.countdown && <p className={styles.fine}>No end date: this plan does not lapse.</p>}

      {trial && (sub.state === "free_trial" || sub.state === "expired") && trial.countdown && (
        <>
          <Clock endsAt={trial.countdown.ends_at} label="of free trial left" />
          <p className={styles.fine}>
            {trial.days} days from {formatDate(trial.started_at)}, ending {formatDate(trial.countdown.ends_at)}
          </p>
        </>
      )}
      {trial && neverEnds && sub.state !== "paid" && <p className={styles.fine}>Started {formatDate(trial.started_at)}. It never ends.</p>}
      {!trial && sub.state !== "pending" && (
        <p className={styles.fine}>
          No start date yet (an older account). Setting a length below starts the free period from today.
        </p>
      )}
      {sub.state !== "pending" && (
        <p className={styles.fine}>
          Length: {neverEnds ? "no end" : `${trial?.days ?? "?"} days`} ({SOURCE_COPY[sub.trial_days_source]}).
        </p>
      )}

      <div className={styles.row}>
        <Input
          label="Free trial length (days)"
          type="number"
          min={0}
          max={3650}
          inputMode="numeric"
          value={days}
          onChange={(event) => setDays(event.target.value)}
          placeholder={trial?.days != null ? String(trial.days) : "e.g. 30"}
          helperText="Total days from when the free period started. 0 means no free tier."
        />
        <Button
          variant="secondary"
          disabled={busy || parsed === null}
          onClick={() => parsed !== null && change({ days: parsed }, `Free trial set to ${parsed} days.`)}
        >
          Set days
        </Button>
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => change({ unlimited: true }, "The free tier never ends for this account.")}>
          Never ends
        </Button>
        {sub.trial_days_source === "user" && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => change({ useDefault: true }, "Back to the platform's length.")}>
            Use the platform&apos;s length
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => change({ restart: true }, "Free period restarted from today.")}>
          Restart from today
        </Button>
      </div>
    </Panel>
  );
}

/** The free-period length for everyone who has no number of their own. */
export function TrialDefaultPanel() {
  const { show } = useToast();
  const current = useAsync(() => adminApi.getTrialDefault(), []);
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);

  if (current.isLoading || !current.data) return <Skeleton height={120} />;

  async function save(value: number | null) {
    setBusy(true);
    try {
      await adminApi.setTrialDefault(value);
      show(value === null ? "The free tier now never ends." : `Free trial is now ${value} days for everyone.`, "success");
      setDays("");
      current.refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't save the free trial length.", "error");
    } finally {
      setBusy(false);
    }
  }

  const parsed = parseDays(days);
  const now = current.data.days;
  return (
    <Panel
      title="Free trial length"
      description="How many days the free tier lasts for everyone, counted from the day an account is approved. People with their own number keep it. After it ends the account is locked until it subscribes."
    >
      <p className={styles.state}>
        Right now: <strong>{now === null ? "the free tier never ends" : `${now} days`}</strong>
        {current.data.source === "default" && " (built-in default)"}.
      </p>
      <div className={styles.row}>
        <Input
          label="Days"
          type="number"
          min={0}
          max={3650}
          inputMode="numeric"
          value={days}
          onChange={(event) => setDays(event.target.value)}
          placeholder={now === null ? "e.g. 14" : String(now)}
        />
        <Button disabled={busy || parsed === null} onClick={() => parsed !== null && save(parsed)}>
          Save
        </Button>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" disabled={busy || now === null} onClick={() => save(null)}>
          Never end the free tier
        </Button>
      </div>
    </Panel>
  );
}
