// The app's own icon set: one family of 24px rounded line
// icons (1.8 stroke) so tabs, triggers, cards and activity all read alike.
import type { CSSProperties, ReactNode } from "react";
import styles from "./Icon.module.scss";

const PATHS = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="9" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="2" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="2" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="2" />
    </>
  ),
  bolt: <path d="M13.2 2.8 5.6 13.1a.6.6 0 0 0 .5 1h5.2l-1 7.1 7.6-10.3a.6.6 0 0 0-.5-1h-5.2l1-7.1Z" />,
  posts: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="9" cy="9" r="1.8" />
      <path d="m20.5 15.5-4.6-4.6a1.2 1.2 0 0 0-1.7 0L4.5 20.4" />
    </>
  ),
  pulse: <path d="M3 12h3.6l2.2-5.5 4.2 11 2.4-5.5H21" />,
  pen: (
    <>
      <path d="M15.6 4.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L9 18.8l-4.6 1.1 1.1-4.6L15.6 4.6Z" />
      <path d="m13.8 6.4 3.8 3.8" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V7M17 16v-6" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" />
    </>
  ),
  comment: <path d="M20.5 11.6a8 8 0 0 1-11.9 7l-4.1 1.4 1.4-3.9A8.5 8.5 0 1 1 20.5 11.6Z" />,
  mail: (
    <>
      <path d="M4 7.5 12 13l8-5.5" />
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
    </>
  ),
  story: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 1-6 2.5" strokeDasharray="2.6 2.6" />
      <circle cx="12" cy="12" r="4.2" />
    </>
  ),
  share: (
    <>
      <path d="m21 3-9.8 9.8" />
      <path d="M21 3 14.6 20.6l-3.4-7.8L3.4 9.4 21 3Z" />
    </>
  ),
  at: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M15.8 8.2v5a2.6 2.6 0 0 0 5.2 0V12a9 9 0 1 0-3.5 7.1" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.4-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.6-7.5 10-7.5 10Z" />,
  live: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  bot: (
    <>
      <rect x="4.5" y="8" width="15" height="11" rx="3.5" />
      <path d="M12 4.5V8M9.5 13v1M14.5 13v1M2.5 13v2M21.5 13v2" />
      <circle cx="12" cy="4" r="0.6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.6a3 3 0 0 1 0 5.8M18 14.2a5.5 5.5 0 0 1 2.5 5.3" />
    </>
  ),
  stop: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5h5v5h-5z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6l-7-2.5Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.2 16.5a8.5 8.5 0 1 1 15.6 0" />
      <path d="m12 13 3.5-4" />
      <circle cx="12" cy="13.5" r="1.2" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3.5v4M15 3.5v4" />
      <path d="M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0v-3Z" />
      <path d="M12 16v4.5" />
    </>
  ),
  play: <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.3-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" />,
  pause: (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
    </>
  ),
  carousel: (
    <>
      <rect x="7.5" y="3.5" width="13" height="13" rx="3" />
      <path d="M16.5 20.5h-10a3 3 0 0 1-3-3v-10" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M10.3 4.3 3 17.5A2 2 0 0 0 4.7 20.5h14.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5Z" />
      <path d="M19 15.5c.3 1.9 1 2.7 2.5 3-1.5.3-2.2 1.1-2.5 3-.3-1.9-1-2.7-2.5-3 1.5-.3 2.2-1.1 2.5-3Z" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M10 11v6M14 11v6" />
      <path d="M6.5 7l.8 11.4A2 2 0 0 0 9.3 20.3h5.4a2 2 0 0 0 2-1.9L17.5 7M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" />
    </>
  ),
  arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  shuffle: (
    <>
      <path d="M16.5 4.5h3v3M19.5 4.5l-15 15M19.5 16.5v3h-3M14.5 14.5l5 5M4.5 4.5l5 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M4 4l16 16" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h12v15h-12a2 2 0 0 0-2 2v-15Z" />
      <path d="M4.5 20.5a2 2 0 0 1 2-2h12v2h-12a2 2 0 0 1-2 0Z" />
      <path d="M9 8h6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2-2.4 3.5M12 17h.01" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="3" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-2l-.4-1a1.6 1.6 0 0 1 1.5-2.2h2.2a3.8 3.8 0 0 0 3.8-3.8C20.5 7 16.7 3.5 12 3.5Z" />
      <circle cx="7.8" cy="11" r="1" />
      <circle cx="10.5" cy="7.6" r="1" />
      <circle cx="15" cy="7.8" r="1" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4.5" />
      <path d="m11.2 12.3 8.8-8.8M16.5 7l2.5 2.5M14 9.5l2 2" />
    </>
  ),
  box: (
    <>
      <path d="M12 3.2 20 7.5v9L12 20.8 4 16.5v-9L12 3.2Z" />
      <path d="M4 7.5l8 4.3 8-4.3M12 11.8v9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12A7.5 7.5 0 0 1 17.7 7.1" />
      <path d="M18 3.5v4h-4M6 20.5v-4h4" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-.6c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5Z" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 13.5 6 5.5h12l2.5 8v5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-5Z" />
      <path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5" />
    </>
  ),
  phone: <path d="M5 4.5h3.2l1.6 4-2 1.3a10 10 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 6 1.5 1.5 0 0 1 5 4.5Z" />,
  fire: <path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.3 2.5-5.5 4-8.4.6 1.6 1.4 2.6 2.4 3.2C11.8 6.6 13 4.3 15 3c-.2 3 .9 5 2.4 7 1 1.3 1.6 2.6 1.6 4.4 0 3.8-3.1 6.6-7 6.6Z" />,
  logout: (
    <>
      <path d="M15 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" />
      <path d="M10 16.5 14.5 12 10 7.5M14.5 12H4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, style, className }: { name: IconName; size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}

export type Tone = "pink" | "violet" | "blue" | "teal" | "green" | "amber" | "orange" | "red" | "slate";

/** An icon in a soft tinted tile: the workspace's signature mark for cards and triggers. */
export function IconTile({ name, tone = "pink", size = "md" }: { name: IconName; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const px = size === "sm" ? 15 : size === "lg" ? 24 : 19;
  return (
    <span className={`${styles.tile} ${styles[tone]} ${styles[size]}`} aria-hidden>
      <Icon name={name} size={px} />
    </span>
  );
}

/** The icon and colour each kind of Instagram event or trigger uses everywhere. */
export const EVENT_ICON: Record<string, { name: IconName; tone: Tone }> = {
  comment: { name: "comment", tone: "pink" },
  live_comment: { name: "live", tone: "red" },
  dm: { name: "mail", tone: "violet" },
  story_reply: { name: "story", tone: "orange" },
  story_reaction: { name: "heart", tone: "red" },
  story_mention: { name: "at", tone: "blue" },
  account_mention: { name: "at", tone: "blue" },
  media_share: { name: "share", tone: "teal" },
  referral: { name: "link", tone: "amber" },
  continuation: { name: "clock", tone: "slate" },
  moderated: { name: "shield", tone: "slate" },
};
