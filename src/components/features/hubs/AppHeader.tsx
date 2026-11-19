import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import styles from "./AppHeader.module.scss";

interface Props {
  /** The store or service's brand colour. */
  color: string;
  title: string;
  subtitle: ReactNode;
  /** A status badge, shown at the right. */
  right?: ReactNode;
}

/** The top of each store's connect page: the same header look as the channel pages, and a way back. */
export function AppHeader({ color, title, subtitle, right }: Props) {
  return (
    <header className={styles.header} style={{ "--app-color": color } as CSSProperties}>
      <Link href="/business-profile?tab=apps" className={styles.back}>
        ← Connected apps
      </Link>
      <div className={styles.row}>
        <span className={styles.mark} aria-hidden>
          {title.charAt(0)}
        </span>
        <div className={styles.text}>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {right && <div className={styles.right}>{right}</div>}
      </div>
    </header>
  );
}
