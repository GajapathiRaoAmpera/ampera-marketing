import clsx from "clsx";
import Image from "next/image";
import styles from "./BrandLockup.module.scss";

interface BrandLockupProps {
  compact?: boolean;
  // Just the "A" mark, for the collapsed icon-rail sidebar.
  logoOnly?: boolean;
}

export function BrandLockup({ compact = false, logoOnly = false }: BrandLockupProps) {
  if (logoOnly) {
    return <Image src="/brand/ampera-mark.png" alt="Ampera" width={34} height={34} className={styles.mark} priority />;
  }
  return (
    <div className={clsx(styles.lockup, compact && styles.compact)}>
      <Image src="/brand/ampera-logo.png" alt="Ampera" width={810} height={226} className={styles.logo} priority />
      <span className={styles.tag}>Demo</span>
    </div>
  );
}
