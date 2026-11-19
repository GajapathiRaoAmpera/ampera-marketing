"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEntitlements } from "@/context/EntitlementsContext";
import { useBusiness } from "@/context/BusinessContext";
import { Button, Skeleton } from "@/components/ui";
import { LockIcon } from "@/components/layout/icons";
import styles from "./FeatureGate.module.scss";

/**
 * Shows its page when the feature is on for the business's plan, and a clear
 * "locked" screen when it is not. The server enforces the same rule; this is
 * what makes the reason visible instead of a page that quietly fails.
 */
export function FeatureGate({
  featureKey,
  name,
  children,
}: {
  featureKey: string;
  /** What to call it on the locked screen, e.g. "Instagram". */
  name: string;
  children: ReactNode;
}) {
  const { entitlements, isLoading, isEnabled } = useEntitlements();
  const { can } = useBusiness();

  if (isLoading) return <Skeleton height={220} />;
  if (isEnabled(featureKey)) return <>{children}</>;

  const awaiting = entitlements?.awaiting_approval;

  return (
    <div className={styles.wrap} role="status">
      <span className={styles.icon}>
        <LockIcon size={26} />
      </span>
      <h1 className={styles.title}>{name} is locked</h1>
      <p className={styles.text}>
        {awaiting
          ? `${name} becomes available once your account is approved. We review new accounts so we can set you up properly; until then you can try the product with a small allowance.`
          : `${name} isn't included in your ${entitlements?.plan_name ?? "current"} plan. Ask us to switch it on, or look at what other plans include.`}
      </p>
      <div className={styles.actions}>
        {!awaiting && can("owner") && (
          <Link href="/billing">
            <Button>See plans</Button>
          </Link>
        )}
        <Link href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
