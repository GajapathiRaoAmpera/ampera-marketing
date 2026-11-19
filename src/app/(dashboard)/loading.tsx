import { Skeleton } from "@/components/ui";
import styles from "./loading.module.scss";

/**
 * Route-group loading fallback for (dashboard). Shown by Next.js while a
 * server component/page in this group is still resolving, so navigating
 * between dashboard pages never shows a stale/blank content area. The
 * shell stays put and this renders in the content slot underneath it.
 */
export default function DashboardLoading() {
  return (
    <div className={styles.wrap}>
      <Skeleton height={32} width="40%" />
      <div className={styles.row}>
        <Skeleton height={100} />
        <Skeleton height={100} />
        <Skeleton height={100} />
      </div>
      <Skeleton height={280} />
    </div>
  );
}
