"use client";

import { useState, type FormEvent } from "react";
import { whatsappApi, ApiError } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Input } from "@/components/ui";
import styles from "./ManualConnectForm.module.scss";

interface ManualConnectFormProps {
  agentId?: string;
  onConnected: () => void;
  /** Reconnecting a known number: its IDs are filled in, only a new token is needed. */
  known?: { wabaId: string; phoneNumberId: string };
}

export function ManualConnectForm({ agentId, onConnected, known }: ManualConnectFormProps) {
  const { show } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [wabaId, setWabaId] = useState(known?.wabaId ?? "");
  const [phoneNumberId, setPhoneNumberId] = useState(known?.phoneNumberId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await whatsappApi.official.manualConnect({
        whatsappBusinessAccountId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        agentId,
      });
      show(known ? "New token saved. WhatsApp is reconnected." : "WhatsApp connected successfully.", "success");
      setWabaId(known?.wabaId ?? "");
      setPhoneNumberId(known?.phoneNumberId ?? "");
      setAccessToken("");
      setIsOpen(false);
      onConnected();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't connect. Check the details and try again.";
      show(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button type="button" className={styles.toggleLink} onClick={() => setIsOpen(true)}>
        {known ? "Connected manually? Paste a new access token" : "Or connect manually with a WABA ID, phone number ID, and access token"}
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles.helperText}>
        {known
          ? "Temporary tokens from Meta's API Setup page expire within a day. A permanent System User token won't expire."
          : "For testing: paste details from Meta's \"API Setup\" test number page, or a permanent System User token for a real number."}
      </p>
      <Input
        label="WhatsApp Business Account ID"
        placeholder="e.g. 1485511839609750"
        value={wabaId}
        onChange={(e) => setWabaId(e.target.value)}
        required
      />
      <Input
        label="Phone number ID"
        placeholder="e.g. 1060212733833186"
        value={phoneNumberId}
        onChange={(e) => setPhoneNumberId(e.target.value)}
        required
      />
      <Input
        label="Access token"
        type="password"
        placeholder="EAAG..."
        value={accessToken}
        onChange={(e) => setAccessToken(e.target.value)}
        required
      />
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {known ? "Save new token" : "Connect"}
        </Button>
      </div>
    </form>
  );
}
