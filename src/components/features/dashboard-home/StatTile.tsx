import type { ReactNode } from "react";
import clsx from "clsx";
import styles from "./StatTile.module.scss";

interface StatTileProps {
  label: string;
  value: string | number | null;
  icon?: ReactNode;
  note?: string;
  delta?: number;
}

export function StatTile({ label, value, icon, note, delta }: StatTileProps) {
  const isUntracked = value === null;

  return (
    <div className={styles.tile}>
      <div className={styles.topRow}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.iconWrap}>{icon}</span>}
      </div>
      {isUntracked ? (
        <span className={styles.notTracked} title={note}>
          Not yet tracked
        </span>
      ) : (
        <span className={styles.value}>{value}</span>
      )}
      {delta !== undefined && !isUntracked && (
        <span className={clsx(styles.delta, delta >= 0 ? styles.positive : styles.negative)}>
          {delta >= 0 ? "+" : ""}
          {delta}% vs last period
        </span>
      )}
      {note && !isUntracked && <span className={styles.delta}>{note}</span>}
    </div>
  );
}
