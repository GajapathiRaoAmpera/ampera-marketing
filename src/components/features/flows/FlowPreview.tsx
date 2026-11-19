"use client";

import type { FlowStep } from "@/lib/api/template-flows";
import styles from "./FlowPreview.module.scss";

export function FlowPreview({ step }: { step: FlowStep | null }) {
  return (
    <div className={styles.phoneFrame}>
      <div className={styles.chatBackground}>
        <div className={styles.bubble}>
          <div className={styles.bodyText}>
            {step?.message.trim() ? step.message : <span className={styles.placeholder}>Step message appears here…</span>}
          </div>
          <div className={styles.timestamp}>10:47 AM</div>
        </div>
        {step && step.buttons.length > 0 && (
          <div className={styles.buttonStack}>
            {step.buttons.map((b) => (
              <div key={b.id} className={styles.buttonRow}>
                {b.title || "Button"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
