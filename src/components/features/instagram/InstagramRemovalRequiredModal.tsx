"use client";

import { Button, Modal } from "@/components/ui";
import styles from "./InstagramConnectPanel.module.scss";

interface InstagramRemovalRequiredModalProps {
  isOpen: boolean;
  removalUrl: string;
  onClose: () => void;
}

export function InstagramRemovalRequiredModal({
  isOpen,
  removalUrl,
  onClose,
}: InstagramRemovalRequiredModalProps) {
  function openInstagramSettings() {
    window.open(removalUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="One final Instagram step"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Done</Button>
          <Button onClick={openInstagramSettings}>Open Instagram settings</Button>
        </>
      }
    >
      <div className={styles.removalNotice}>
        <span className={styles.removalNoticeIcon} aria-hidden="true">✓</span>
        <div>
          <strong>Ampera is disconnected.</strong>
          <p>
            Webhook delivery has stopped and your local automations were deleted. In Instagram,
            find <strong>Ampera-IG</strong> under Apps and websites and select <strong>Remove</strong>
            to revoke the remaining authorization.
          </p>
        </div>
      </div>
    </Modal>
  );
}
