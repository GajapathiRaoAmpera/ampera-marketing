"use client";

import { useState, type FormEvent } from "react";
import { messengerApi, ApiError } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Input } from "@/components/ui";
import styles from "./ManualMessengerConnectForm.module.scss";

interface ManualMessengerConnectFormProps {
  agentId?: string;
  onConnected: () => void;
}

export function ManualMessengerConnectForm({ agentId, onConnected }: ManualMessengerConnectFormProps) {
  const { show } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [pageId, setPageId] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await messengerApi.manualConnect(pageId.trim(), pageAccessToken.trim(), agentId);
      show("Facebook Page connected successfully.", "success");
      setPageId("");
      setPageAccessToken("");
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
        Or connect manually with a Page ID and access token
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles.helperText}>
        Paste a Page ID and Page access token, e.g. generated via Meta&apos;s Graph API Explorer or a System
        User token.
      </p>
      <Input
        label="Facebook Page ID"
        placeholder="e.g. 102938475610203"
        value={pageId}
        onChange={(e) => setPageId(e.target.value)}
        required
      />
      <Input
        label="Page access token"
        type="password"
        placeholder="EAAG..."
        value={pageAccessToken}
        onChange={(e) => setPageAccessToken(e.target.value)}
        required
      />
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Connect
        </Button>
      </div>
    </form>
  );
}
