"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { billingApi, ApiError } from "@/lib/api";
import type { BillingInterval, BillingIntervalInfo, Plan, PlanId, Subscription } from "@/lib/api/billing";
import { useAsync } from "@/lib/hooks/useAsync";
import { formatTimeLeft, useCountdown } from "@/lib/hooks/useCountdown";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils/date";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import styles from "@/app/(dashboard)/billing/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

const PLAN_ORDER: PlanId[] = ["free", "pro", "enterprise"];
const INTERVAL_ORDER: BillingInterval[] = ["monthly", "quarterly", "half_yearly", "annual"];
const INTERVAL_LABEL: Record<BillingInterval, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annual: "Annual",
};
const PERIOD_WORD: Record<BillingInterval, string> = {
  monthly: "month",
  quarterly: "3 months",
  half_yearly: "6 months",
  annual: "year",
};

/** What the account is called in the "Current plan" card. */
function currentPlanTitle(subscription: Subscription | null | undefined): string {
  if (!subscription) return "Free";
  if (subscription.state === "expired") return "Free trial ended";
  if (subscription.state === "pending") return "Trial";
  if (subscription.state === "free_trial") return "Free trial";
  return subscription.plan.name;
}

/** A live "ends in ..." line for the free period or the current billing cycle. */
function CountdownLine({ subscription }: { subscription: Subscription }) {
  const left = useCountdown(subscription.countdown?.ends_at);
  const { user } = useAuth();
  if (!subscription.countdown || !left) return null;

  const when = formatDate(subscription.countdown.ends_at, user?.timezone);
  let label: string;
  if (subscription.state === "expired") label = `Ended ${when}`;
  else if (subscription.state === "free_trial") label = `Free trial ends in ${formatTimeLeft(left)}`;
  else if (subscription.in_grace) label = "Renewal is late. Update your payment method to keep your plan";
  else if (subscription.cancel_at_period_end) label = `Plan ends in ${formatTimeLeft(left)}`;
  else label = `Renews in ${formatTimeLeft(left)}`;

  return (
    <div
      className={clsx(
        styles.countdown,
        (subscription.state === "expired" || subscription.in_grace || (left.days < 3 && !left.expired)) && styles.countdownWarn
      )}
    >
      <span className={styles.countdownValue}>{label}</span>
      {subscription.state !== "expired" && <span className={styles.countdownDate}> · {when}</span>}
    </div>
  );
}

function PlanPrice({ plan, interval, info }: { plan: Plan; interval: BillingInterval; info?: BillingIntervalInfo }) {
  if (plan.price_monthly === null) {
    return (
      <div className={styles.planPrice}>
        <span className={styles.priceContactUs}>Contact us</span>
      </div>
    );
  }
  if (plan.price_monthly === 0) {
    return (
      <div className={styles.planPrice}>
        <span>Free</span>
      </div>
    );
  }
  const price = plan.prices[interval] ?? plan.price_monthly;
  const months = info?.months ?? 1;
  const perMonth = price / months;
  return (
    <div>
      <div className={styles.planPrice}>
        <span className={styles.priceAmount}>${price}</span>
        <span className={styles.pricePeriod}>/{PERIOD_WORD[interval]}</span>
      </div>
      {months > 1 && (
        <div className={styles.pricePerMonth}>
          ${perMonth.toFixed(2)} a month
          {info && info.discount_pct > 0 && ` · you save ${info.discount_pct}%`}
        </div>
      )}
    </div>
  );
}

function formatLimit(value: number | null): string {
  if (value === null) return "Unlimited";
  return value.toLocaleString();
}

export default function BillingPage() {
  const embedded = useEmbedded();
  const { show } = useToast();
  const searchParams = useSearchParams();
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<PlanId | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const { data: catalog, isLoading: plansLoading } = useAsync(() => billingApi.listPlans(), []);
  const plans = catalog?.plans;
  const intervals = catalog?.intervals;
  const {
    data: subscription,
    isLoading: subLoading,
    refresh: refreshSubscription,
  } = useAsync(() => billingApi.getSubscription(), []);

  useEffect(() => {
    const status = searchParams.get("checkout");
    if (status === "success") {
      show("Subscription updated! It may take a few seconds to reflect below.", "success");
      refreshSubscription();
    } else if (status === "cancelled") {
      show("Checkout cancelled, no changes made.", "default");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleChoosePlan(planId: PlanId) {
    if (planId === "free") return;
    if (planId === "enterprise") {
      window.location.href = "mailto:sales@vaultxtecholution.live?subject=Enterprise%20plan%20inquiry";
      return;
    }
    setCheckoutLoadingPlan(planId);
    try {
      const { url } = await billingApi.checkout(planId, interval);
      window.location.href = url;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.userMessage
          : "Couldn't start checkout. Billing may not be configured yet.";
      show(message, "error");
      setCheckoutLoadingPlan(null);
    }
  }

  async function handleManageBilling() {
    setIsOpeningPortal(true);
    try {
      const { url } = await billingApi.openPortal();
      window.location.href = url;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.userMessage : "Couldn't open the billing portal. Please try again.";
      show(message, "error");
    } finally {
      setIsOpeningPortal(false);
    }
  }

  const currentPlanId = subscription?.plan_id ?? "free";
  const state = subscription?.state;
  // Only a paid plan, or the free tier while it still runs, is "current".
  const onFreeTier = state === "free_trial" || state === "free";
  const isPaid = state === "paid";

  return (
    <div>
      {!embedded && (
        <div className={styles.header}>
          <div className={styles.title}>Plans & Billing</div>
          <div className={styles.subtitle}>Choose the plan that fits your business, and manage your subscription.</div>
        </div>
      )}

      <Card className={styles.currentPlanCard}>
        {subLoading ? (
          <Skeleton height={60} />
        ) : (
          <div className={styles.currentPlanRow}>
            <div>
              <div className={styles.currentPlanLabel}>Current plan</div>
              <div className={styles.currentPlanName}>
                {currentPlanTitle(subscription)}
                {isPaid && subscription?.billing_interval && (
                  <Badge variant="brand">{INTERVAL_LABEL[subscription.billing_interval]}</Badge>
                )}
                {state === "expired" && <Badge variant="danger">Locked</Badge>}
                {subscription?.cancel_at_period_end && (
                  <Badge variant="warning" className={styles.cancelBadge}>
                    Cancels at period end
                  </Badge>
                )}
              </div>
              {subscription && <CountdownLine subscription={subscription} />}
              {state === "expired" && (
                <div className={styles.currentPlanMeta}>
                  Your automations and AI are paused until you subscribe. Your contacts, flows and settings are kept.
                </div>
              )}
              {state === "pending" && (
                <div className={styles.currentPlanMeta}>
                  You can try the product with a small allowance until your account is approved.
                </div>
              )}
            </div>
            {isPaid && (
              <Button variant="secondary" onClick={handleManageBilling} isLoading={isOpeningPortal}>
                Manage billing
              </Button>
            )}
          </div>
        )}
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <div className={styles.intervalBar} role="radiogroup" aria-label="Billing cycle">
        {INTERVAL_ORDER.map((option) => {
          const info = intervals?.[option];
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={interval === option}
              className={clsx(styles.intervalBtn, interval === option && styles.intervalBtnActive)}
              onClick={() => setInterval(option)}
            >
              {info?.label ?? INTERVAL_LABEL[option]}
              {info && info.discount_pct > 0 && <span className={styles.saveBadge}>Save {info.discount_pct}%</span>}
            </button>
          );
        })}
      </div>

      {plansLoading ? (
        <div className={styles.plansGrid}>
          <Skeleton height={420} />
          <Skeleton height={420} />
          <Skeleton height={420} />
        </div>
      ) : (
        <div className={styles.plansGrid}>
          {PLAN_ORDER.map((planId) => {
            const plan = plans?.[planId] as Plan | undefined;
            if (!plan) return null;
            const isCurrent = planId === "free" ? onFreeTier : isPaid && planId === currentPlanId;
            const isPopular = planId === "pro";

            return (
              <Card key={planId} className={clsx(styles.planCard, isPopular && styles.planCardPopular)}>
                {isPopular && <div className={styles.popularBadge}>Most popular</div>}
                <div className={styles.planName}>{plan.name}</div>
                <PlanPrice plan={plan} interval={interval} info={intervals?.[interval]} />

                <ul className={styles.featureList}>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span className={styles.checkIcon}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className={styles.planLimits}>
                  <div>
                    <strong>{formatLimit(plan.limits.agents)}</strong> agents
                  </div>
                  <div>
                    <strong>{formatLimit(plan.limits.channels)}</strong> channels
                  </div>
                  <div>
                    <strong>{formatLimit(plan.limits.messages_per_month)}</strong> messages/mo
                  </div>
                </div>

                <Button
                  fullWidth
                  variant={isCurrent ? "secondary" : isPopular ? "primary" : "secondary"}
                  disabled={isCurrent || planId === "free"}
                  isLoading={checkoutLoadingPlan === planId}
                  onClick={() => handleChoosePlan(planId)}
                >
                  {isCurrent
                    ? "Current plan"
                    : planId === "enterprise"
                      ? "Contact sales"
                      : planId === "free"
                        ? state === "expired" ? "Trial ended" : "Free tier"
                        : state === "expired" ? "Subscribe" : "Upgrade"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
