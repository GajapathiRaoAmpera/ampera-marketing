import clsx from "clsx";
import styles from "./Skeleton.module.scss";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: "block" | "text" | "circle";
  className?: string;
}

export function Skeleton({ width, height, variant = "block", className }: SkeletonProps) {
  return (
    <div
      className={clsx(styles.skeleton, variant === "text" && styles.text, variant === "circle" && styles.circle, className)}
      style={{ width, height }}
      aria-hidden
    />
  );
}
