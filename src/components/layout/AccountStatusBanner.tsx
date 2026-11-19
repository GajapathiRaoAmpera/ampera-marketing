"use client";

import Link from "next/link";
import clsx from "clsx";
import type { UsageMeter } from "@/lib/api";
import type { Entitlements } from "@/lib/api/entitlements";
import { formatTimeLeft, useCountdown } from "@/lib/hooks/useCountdown";
import { useEntitlements } from "@/context/EntitlementsContext";
import { useBusiness } from "@/context/BusinessContext";
import styles from "./AccountStatusBanner.module.scss";

function Bar({ label, meter }: { label: string; meter: UsageMeter }) {
  const unlimited = meter.limit === null;
  const pct = unlimited || !meter.limit ? 0 : Math.min(100, Math.round((meter.used / meter.limit) * 100));
  return (
    <div className={styles.meter}>
      <div className={styles.meterTop}>
        <span>{label}</span>
        <span className={styles.meterValue}>
          {unlimited ? `${meter.used} used` : `${meter.used} of ${meter.limit} used`}
        </span>
      </div>
      <div className={styles.track}>
        <div className={clsx(styles.fill, pct >= 100 && styles.fillFull)} style={{ width: `${unlimited ? 0 : pct}%` }} />
      </div>
    </div>
  );
}

const isFull = (meter: UsageMeter) => meter.limit !== null && meter.used >= meter.limit;
const isNearly = (meter: UsageMeter) => meter.limit !== null && meter.limit > 0 && meter.used / meter.limit >= 0.8;

/** The live "time left" in the free trial, ticking down. */
function TrialClock({ subscription }: { subscription: Entitlements["subscription"] }) {
  const left = useCountdown(subscription.countdown?.ends_at);
  if (!left) return null;
  return <span className={styles.clock}>{formatTimeLeft(left)}</span>;
}

/**
 * One calm, clear message about the account's state: waiting for approval,
 * out of an allowance, or close to it. Nothing at all when all is well.
 */
export function AccountStatusBanner() {
  const { entitlements } = useEntitlements();
  const { can } = useBusiness();
  if (!entitlements) return null;

  const { usage } = entitlements;

  if (entitlements.awaiting_approval) {
    return (
      <div className={clsx(styles.banner, styles.pending)} role="status">
        <div className={styles.text}>
          <div className={styles.title}>Your account is waiting for approval</div>
          <div className={styles.body}>
            Until we approve it you can try the product with a small allowance. Once approved, those limits lift and your
            plan applies.
          </div>
        </div>
        <div className={styles.meters}>
          <Bar label="AI replies" meter={usage.ai_replies} />
          <Bar label="Automated replies" meter={usage.automated_replies} />
        </div>
      </div>
    );
  }

  if (entitlements.is_expired) {
    return (
      <div className={clsx(styles.banner, styles.full)} role="alert">
        <div className={styles.text}>
          <div className={styles.title}>Your free trial has ended</div>
          <div className={styles.body}>
            The AI and your automations are paused, and nothing new can be added. Your contacts, flows and settings are
            kept. {can("owner") ? "Subscribe to pick up where you left off." : "Ask the account owner to subscribe."}
          </div>
        </div>
        {can("owner") && (
          <Link href="/billing" className={styles.action}>
            Subscribe
          </Link>
        )}
      </div>
    );
  }

  const aiFull = isFull(usage.ai_replies);
  const autoFull = isFull(usage.automated_replies);
  if (aiFull || autoFull) {
    return (
      <div className={clsx(styles.banner, styles.full)} role="alert">
        <div className={styles.text}>
          <div className={styles.title}>
            {aiFull && autoFull
              ? "You've used all your AI and automated replies for this month"
              : aiFull
                ? "You've used all your AI replies for this month"
                : "You've used all your automated replies for this month"}
          </div>
          <div className={styles.body}>
            {aiFull && "The AI won't answer new messages until your allowance renews. "}
            {autoFull && "Comment and DM automations won't send until your allowance renews. "}
            {can("owner") ? "Upgrade your plan or contact us to keep going." : "Ask the account owner to upgrade, or contact us."}
          </div>
        </div>
        {can("owner") && (
          <Link href="/billing" className={styles.action}>
            See plans
          </Link>
        )}
      </div>
    );
  }

  if (isNearly(usage.ai_replies) || isNearly(usage.automated_replies)) {
    return (
      <div className={clsx(styles.banner, styles.near)} role="status">
        <div className={styles.text}>
          <div className={styles.title}>You&apos;re close to this month&apos;s allowance</div>
        </div>
        <div className={styles.meters}>
          {isNearly(usage.ai_replies) && <Bar label="AI replies" meter={usage.ai_replies} />}
          {isNearly(usage.automated_replies) && <Bar label="Automated replies" meter={usage.automated_replies} />}
        </div>
      </div>
    );
  }

  const subscription = entitlements.subscription;
  if (subscription?.state === "paid" && subscription.in_grace) {
    return (
      <div className={clsx(styles.banner, styles.full)} role="alert">
        <div className={styles.text}>
          <div className={styles.title}>We couldn&apos;t renew your plan</div>
          <div className={styles.body}>
            Your plan stays on for a few more days. {can("owner") ? "Update your payment method to keep it." : "Ask the account owner to update the payment method."}
          </div>
        </div>
        {can("owner") && (
          <Link href="/billing" className={styles.action}>
            Update billing
          </Link>
        )}
      </div>
    );
  }

  if (subscription?.state === "free_trial" && subscription.countdown && !subscription.countdown.expired) {
    const urgent = subscription.countdown.days_remaining <= 3;
    return (
      <div className={clsx(styles.banner, urgent ? styles.near : styles.trial)} role="status">
        <div className={styles.text}>
          <div className={styles.title}>
            Free trial: <TrialClock subscription={subscription} /> left
          </div>
          <div className={styles.body}>
            The free tier includes 100 AI replies and 100 WhatsApp messages a month, with limits on automations, flows and contacts.{" "}
            {can("owner") ? "Subscribe any time to lift them." : "The account owner can subscribe to lift them."}
          </div>
        </div>
        {can("owner") && (
          <Link href="/billing" className={styles.action}>
            See plans
          </Link>
        )}
      </div>
    );
  }

  return null;
}
