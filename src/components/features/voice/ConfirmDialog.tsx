"use client";

import { useState, type ReactNode } from "react";
import { Button, Modal } from "@/components/ui";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** May be async; the dialog stays open, showing progress, until it settles. */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({ isOpen, title, children, confirmLabel, danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [isBusy, setIsBusy] = useState(false);

  async function confirm() {
    setIsBusy(true);
    try {
      await onConfirm();
    } finally {
      setIsBusy(false);
      onClose();
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isBusy) onClose(); }}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>Keep as is</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm} isLoading={isBusy}>{confirmLabel}</Button>
        </>
      }
    >
      <div style={{ fontSize: "var(--font-size-sm)", lineHeight: 1.6, color: "var(--color-text-secondary)" }}>{children}</div>
    </Modal>
  );
}
