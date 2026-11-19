import type { HTMLAttributes } from "react";
import clsx from "clsx";
import styles from "./Badge.module.scss";

type BadgeVariant = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({ variant = "neutral", dot, className, children, ...rest }: BadgeProps) {
  return (
    <span className={clsx(styles.badge, styles[variant], className)} {...rest}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
