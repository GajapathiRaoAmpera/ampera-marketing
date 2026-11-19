"use client";

import { BusinessSwitcher } from "./BusinessSwitcher";
import { NotificationBell } from "./NotificationBell";
import { MenuIcon } from "./icons";
import styles from "./Topbar.module.scss";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className={styles.topbar}>
      <button type="button" className={styles.menuButton} onClick={onMenuClick} aria-label="Open menu">
        <MenuIcon />
      </button>
      <BusinessSwitcher />
      <div className={styles.spacer} />
      <NotificationBell />
    </header>
  );
}
