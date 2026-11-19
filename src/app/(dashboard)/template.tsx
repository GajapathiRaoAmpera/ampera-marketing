import styles from "./template.module.scss";

// Re-created on every page change (not on ?query changes), so each page eases
// in instead of snapping into place.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}
