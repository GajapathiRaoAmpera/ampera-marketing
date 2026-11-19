import { BrandLockup } from "@/components/layout/BrandLockup";
import styles from "./layout.module.scss";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.formSide}>
        <div className={styles.formInner}>
          <div className={styles.brandRow}>
            <BrandLockup />
          </div>
          {children}
        </div>
      </div>
      <div className={styles.showcaseSide}>
        <div className={styles.showcaseGlow} />
        <div className={styles.showcaseContent}>
          <div className={styles.showcaseTitle}>WhatsApp, Instagram and Messenger in one AI workspace.</div>
          <p className={styles.showcaseDescription}>
            An AI agent answers every Meta channel, runs campaigns and comment automations, and
            hands hot leads to your team with the full conversation.
          </p>
          <div className={styles.showcaseStats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>3</span>
              <span className={styles.statLabel}>Meta channels</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>&lt;1min</span>
              <span className={styles.statLabel}>First response</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>0</span>
              <span className={styles.statLabel}>Missed leads</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
