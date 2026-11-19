"use client";

import { useState } from "react";
import clsx from "clsx";
import styles from "./Avatar.module.scss";

interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "offline";
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, src, size = "md", status, className }: AvatarProps) {
  // Profile photo links expire (Instagram's do within days): fall back to initials.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const content = (
    <span className={clsx(styles.avatar, styles[size], className)}>
      {showImage ? <img src={src} alt={name} className={styles.image} referrerPolicy="no-referrer" onError={() => setFailedSrc(src ?? null)} /> : initials(name)}
    </span>
  );

  if (!status) return content;

  return (
    <span className={styles.statusDot}>
      {content}
      <span className={clsx(styles.dot, styles[status])} aria-label={status} />
    </span>
  );
}
