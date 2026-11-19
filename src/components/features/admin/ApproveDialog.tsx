"use client";

import { useState } from "react";
import clsx from "clsx";
import { adminApi, ApiError, type AssignablePlanId } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Modal } from "@/components/ui";
import { TIER_NAME } from "./AdminUi";
import styles from "./ApproveDialog.module.scss";

const CHOICES: Array<{ id: AssignablePlanId; blurb: string }> = [
  { id: "free", blurb: "The starter allowance. A good default for someone you have just vetted." },
  { id: "pro", blurb: "A bigger allowance for a growing business." },
  { id: "enterprise", blurb: "No limits unless you set some. For your largest customers." },
];

export function ApproveDialog({
  account,
  isOpen,
  onClose,
  onDone,
}: {
  account: { id: string; name: string | null; email: string | null } | null;
  isOpen: boolean;
  onClose: () => void;
  onDone: (planId: AssignablePlanId) => void;
}) {
  const { show } = useToast();
  const [plan, setPlan] = useState<AssignablePlanId>("free");
  const [isSaving, setIsSaving] = useState(false);
  const [trialDays, setTrialDays] = useState("");

  if (!account) return null;
  const who = account.name || account.email || "this account";

  // Empty = the platform's free-trial length.
  const customDays = trialDays.trim() === "" ? undefined : Number(trialDays);
  const daysInvalid = customDays !== undefined && !(Number.isInteger(customDays) && customDays >= 0 && customDays <= 3650);

  async function confirm() {
    if (!account || daysInvalid) return;
    setIsSaving(true);
    try {
      await adminApi.approveUser(account.id, plan, customDays);
      show(`${who} is approved on the ${TIER_NAME[plan]} plan.`, "success");
      onDone(plan);
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't approve this account.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve this account"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} isLoading={isSaving} disabled={daysInvalid}>
            Approve on {TIER_NAME[plan]}
          </Button>
        </>
      }
    >
      <p className={styles.intro}>
        <strong>{who}</strong> is on the trial tier: <strong>3 AI replies and 10 automated replies, for life</strong>.
        Approving lifts those limits and puts the account on a plan.
      </p>
      <fieldset className={styles.choices}>
        <legend className={styles.legend}>Which plan?</legend>
        {CHOICES.map((choice) => (
          <label key={choice.id} className={clsx(styles.choice, plan === choice.id && styles.chosen)}>
            <input
              type="radio"
              name="plan"
              value={choice.id}
              checked={plan === choice.id}
              onChange={() => setPlan(choice.id)}
              className={styles.radio}
            />
            <span>
              <span className={styles.choiceName}>{TIER_NAME[choice.id]}</span>
              <span className={styles.choiceBlurb}>{choice.blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Input
        label="Free trial length (days)"
        type="number"
        min={0}
        max={3650}
        inputMode="numeric"
        value={trialDays}
        onChange={(event) => setTrialDays(event.target.value)}
        placeholder="Platform default"
        helperText="Leave empty to use the platform's length. The free period starts today."
        errorText={daysInvalid ? "Use a whole number of days, 0 to 3650." : undefined}
      />
      <p className={styles.footnote}>
        What each plan includes is set under <strong>Plans &amp; limits</strong>. You can still change this account
        individually afterwards.
      </p>
    </Modal>
  );
}
