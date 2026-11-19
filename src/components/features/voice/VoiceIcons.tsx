import styles from "./VoiceCenter.module.scss";

interface IconProps {
  size?: number;
}

const line = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** A tick that draws itself in when it appears. */
export function CheckMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...line} strokeWidth={2}>
      <path className={styles.drawn} d="M5 10.5l3.2 3.2L15 7" />
    </svg>
  );
}

export function NumberIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...line}>
      <path d="M4 3h3l1.5 4-2 1.5a11 11 0 005.5 5.5L13.5 12l4 1.5V17a2 2 0 01-2 2 14 14 0 01-13-13 2 2 0 012-2z" />
    </svg>
  );
}

export function AgentIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...line}>
      <rect x="4" y="7" width="12" height="9" rx="2.5" />
      <path d="M10 7V4M8 11.2v1.2M12 11.2v1.2M2.5 11v2M17.5 11v2" />
      <circle cx="10" cy="3.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IncomingIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...line}>
      <path d="M15.5 4.5l-9 9M6.5 7v6.5h6.5" />
      <path d="M4 16.5h12" opacity="0.45" />
    </svg>
  );
}

export function VoiceWaveIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...line}>
      <path d="M3.5 9v2M6.75 6.5v7M10 3.5v13M13.25 6.5v7M16.5 9v2" />
    </svg>
  );
}

export function RulesIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...line}>
      <path d="M3.5 6h7M14.5 6h2M3.5 14h2M9.5 14h7" />
      <circle cx="12.5" cy="6" r="2" />
      <circle cx="7.5" cy="14" r="2" />
    </svg>
  );
}

export function LaunchIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...line}>
      <path d="M17 3L3 8.5l5.5 2.5L11 16.5 17 3z" />
      <path d="M8.5 11L17 3" />
    </svg>
  );
}
