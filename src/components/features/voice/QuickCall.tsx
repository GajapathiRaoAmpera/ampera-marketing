"use client";

import { useState } from "react";
import { Button, Input, Modal, Textarea } from "@/components/ui";
import { ApiError, voiceCenterApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import styles from "./VoiceCenter.module.scss";

interface QuickCallProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaced?: () => void;
  /** Prefill when calling someone back from call history. */
  number?: string;
  name?: string;
  context?: string;
}

export function QuickCall({ isOpen, onClose, onPlaced, number = "", name = "", context = "" }: QuickCallProps) {
  const { show } = useToast();
  const [form, setForm] = useState({ number, name, context, when: "" });
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const cleanNumber = form.number.replace(/[\s\-().]/g, "");
  const isValid = /^\+[1-9]\d{7,14}$/.test(cleanNumber);

  async function submit() {
    if (form.when && new Date(form.when).getTime() <= Date.now()) {
      setError("Choose a time in the future, or clear the time to call now.");
      return;
    }
    setIsBusy(true);
    setError("");
    const options = { context: form.context.trim() || undefined, contact_name: form.name.trim() || undefined };
    try {
      if (form.when) {
        await voiceCenterApi.scheduleCall(cleanNumber, new Date(form.when).toISOString(), options);
        show("Call scheduled.", "success");
      } else {
        await voiceCenterApi.callNow(cleanNumber, options);
        show("Calling now. It will appear under live calls.", "success");
      }
      onPlaced?.();
      onClose();
    } catch (err) {
      // Kept in the dialog: the reason (do-not-call list, outside calling hours) decides what to do next.
      setError(err instanceof ApiError ? err.userMessage : "Couldn't place the call. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Call someone"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} isLoading={isBusy} disabled={!isValid}>
            {form.when ? "Schedule call" : "Call now"}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <Input
          label="Phone number"
          type="tel"
          value={form.number}
          onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
          placeholder="+919876543210"
          errorText={form.number && !isValid ? "Include the country code, for example +91" : undefined}
          required
        />
        <Input
          label="Their name (optional)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Priya"
        />
        <Textarea
          label="What is this call for?"
          value={form.context}
          onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
          placeholder="Confirm tomorrow's 3pm appointment and ask if they need directions."
          helperText="Your agent uses this as the goal of the call."
          maxLength={2000}
        />
        <Input
          label="When (leave empty to call now)"
          type="datetime-local"
          value={form.when}
          onChange={(e) => setForm((f) => ({ ...f, when: e.target.value }))}
        />
        {error && <div className={styles.errorBox} role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
