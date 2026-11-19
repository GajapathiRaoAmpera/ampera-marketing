import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import styles from "./Card.module.scss";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md";
  interactive?: boolean;
}

export function Card({ padding = "md", interactive, className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        styles.card,
        padding === "sm" && styles.padSm,
        padding === "none" && styles.padNone,
        interactive && styles.interactive,
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.header}>
      <div>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
