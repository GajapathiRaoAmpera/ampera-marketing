// Minimal hand-rolled icon set, keeps the UI kit dependency-free (no icon
// library needed). Each icon is a 20x20 viewBox stroke icon matching the
// rest of the design system's line weight (1.6).

type IconProps = { size?: number };

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M3 8l7-5 7 5v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1V8z" />
    </svg>
  );
}

export function InboxIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M3 4h14l2 7v6a1 1 0 01-1 1H2a1 1 0 01-1-1v-6l2-7z" />
      <path d="M1 11h5l1.5 2.5h5L14 11h5" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7.1a8.2 8.2 0 01-4-3.5c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.1-.6l-.9-2.1c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-.9 2.4.1 1.5 1.1 3 2.4 4.4a10.4 10.4 0 004.6 3c1.7.6 2.4.4 2.9.3.6-.1 1.7-.7 2-1.4.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.6-.3z" />
      <path d="M12 2a10 10 0 00-8.7 15L2 22l5.2-1.4A10 10 0 1012 2zm0 18.2a8.1 8.1 0 01-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1114.5-4.3 8.2 8.2 0 01-7.5 8.2z" />
    </svg>
  );
}

export function InstagramIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MessengerIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.5 2 2 6.1 2 11.4c0 2.9 1.4 5.5 3.6 7.3V22l3.3-1.8c.9.2 1.8.4 2.8.4 5.5 0 10-4.1 10-9.4C21.7 6.1 17.5 2 12 2z" />
      <path d="M6.7 12.5l3.1-3.3 2.5 2 3.9-3.3-3.4 4.9-2.6-2-3.5 1.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PhoneIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M4 3h3l1.5 4-2 1.5a11 11 0 005.5 5.5L13.5 12l4 1.5V17a2 2 0 01-2 2 14 14 0 01-13-13 2 2 0 012-2z" />
    </svg>
  );
}

export function BookIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M3 4a2 2 0 012-2h4a2 2 0 012 2v13l-4-2-4 2V4z" />
      <path d="M11 4a2 2 0 012-2h2a2 2 0 012 2v13l-3-1.5" />
    </svg>
  );
}

export function BotIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="3" y="7" width="14" height="10" rx="2" />
      <path d="M10 7V3M7 3h6" />
      <circle cx="7.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FireIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M10 18c3 0 5.5-2 5.5-5 0-2-1-3.3-2-4.5.2 1.2-.3 2-1 2.3.3-2-.5-4.3-2.5-5.8.3 1.7-.5 3-1.7 4C6.8 10 6 11.5 6 13c0 3 1 5 4 5z" />
    </svg>
  );
}

export function UsersIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="7" cy="7" r="3" />
      <path d="M1.5 17c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
      <circle cx="14.5" cy="7.5" r="2.3" />
      <path d="M14 12.2c2.3.3 4 2.1 4 4.3v.5" />
    </svg>
  );
}

export function BellIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M5 8a5 5 0 0110 0c0 3 1 4.5 1.5 5.5H3.5C4 12.5 5 11 5 8z" />
      <path d="M8 16a2 2 0 004 0" />
    </svg>
  );
}

export function AlertIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M10 2l8.5 15H1.5L10 2zM10 8v4M10 15h.01" />
    </svg>
  );
}

export function ChartIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M3 17V9M9 17V3M15 17v-6M2 17h16" />
    </svg>
  );
}

export function SettingsIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2M10 15.5v2M4 5l1.4 1.4M14.6 13.6L16 15M2.5 10h2M15.5 10h2M4 15l1.4-1.4M14.6 6.4L16 5" />
    </svg>
  );
}

export function WidgetIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="2" y="3" width="16" height="12" rx="2" />
      <path d="M6 18h4M13 14.5l3 3-3 1" />
    </svg>
  );
}

export function WebChatIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3" width="19" height="15" rx="2.5" />
      <path d="M2.5 7h19" />
      <path d="M8 11.2h8a1.5 1.5 0 011.5 1.5v1.1a1.5 1.5 0 01-1.5 1.5h-3.1L10 17.5v-2.2H8a1.5 1.5 0 01-1.5-1.5v-1.1A1.5 1.5 0 018 11.2z" />
    </svg>
  );
}

export function TwilioIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="9" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChannelsIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="12" y="2.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="2.5" y="12" width="5.5" height="5.5" rx="1.2" />
      <rect x="12" y="12" width="5.5" height="5.5" rx="1.2" />
    </svg>
  );
}

export function PlugIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M7 2.5v4M13 2.5v4" />
      <path d="M4.5 6.5h11v3.5a5.5 5.5 0 0 1-11 0V6.5Z" />
      <path d="M10 14v3.5" />
    </svg>
  );
}

export function CreditCardIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="2" y="4" width="16" height="12" rx="2" />
      <path d="M2 8h16M5 13h3" />
    </svg>
  );
}

export function TemplateIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="3" y="2" width="14" height="16" rx="2" />
      <path d="M6.5 6h7M6.5 9.5h7M6.5 13h4" />
    </svg>
  );
}

export function MegaphoneIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M3 8v4a1 1 0 001 1h1l2 4h2l-1.5-4H10l6 3V4l-6 3H4a1 1 0 00-1 1z" />
      <path d="M16 8.5v3" />
    </svg>
  );
}

export function FlowIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="4" cy="4" r="2" />
      <circle cx="4" cy="16" r="2" />
      <circle cx="16" cy="10" r="2" />
      <path d="M6 4h4a4 4 0 014 4M6 16h4a4 4 0 004-4" />
    </svg>
  );
}

export function LogoutIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M13 14l4-4-4-4M17 10H7" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BoxIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M10 2l7 3.5v9L10 18l-7-3.5v-9L10 2z" />
      <path d="M3.5 5.5L10 9l6.5-3.5" />
      <path d="M10 9v9" />
    </svg>
  );
}

export function BuildingIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M3 18V5l7-3 7 3v13" />
      <path d="M1.5 18h17M7 6h1M12 6h1M7 10h1M12 10h1M8 18v-4h4v4" />
    </svg>
  );
}

export function GlobeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="10" cy="10" r="8" />
      <path d="M2 10h16M10 2c2.2 2.2 3.3 4.9 3.3 8S12.2 15.8 10 18M10 2C7.8 4.2 6.7 6.9 6.7 10s1.1 5.8 3.3 8" />
    </svg>
  );
}

export function MenuIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TagIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M10.5 2.5H4a1.5 1.5 0 00-1.5 1.5v6.5a1.5 1.5 0 00.44 1.06l7 7a1.5 1.5 0 002.12 0l6.5-6.5a1.5 1.5 0 000-2.12l-7-7a1.5 1.5 0 00-1.06-.44z" />
      <circle cx="7" cy="7" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NoteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M5 3h7l4 4v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M12 3v4h4" />
      <path d="M6.5 10.5h7M6.5 13.5h5" />
    </svg>
  );
}

// Sidebar collapse/expand toggle: an outlined panel with a divider marking
// the nav rail, the same glyph VS Code/Linear/Notion use for this action -
// recognizable at a glance instead of relying on chevron-rotation alone.
export function PanelLeftIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M7.5 3.5v13" />
    </svg>
  );
}

export function TelegramIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4L3 11l6 2.2 2 6.8 3.2-4.2L19 19l2-15z" />
      <path d="M9 13.2L17 7" />
    </svg>
  );
}

export function DiscordIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6.5c2.6-.9 5.4-.9 8 0 1.9 2.7 2.9 5.8 2.7 9.3-1.3 1-2.7 1.7-4.2 2.1l-.9-1.7M8 6.5c-1.9 2.7-2.9 5.8-2.7 9.3 1.3 1 2.7 1.7 4.2 2.1l.9-1.7" />
      <path d="M8.3 15.5c2.3 1 5.1 1 7.4 0" />
      <circle cx="9.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SmsIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
      <circle cx="8" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="11" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function XIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}

export function LockIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <rect x="4" y="9" width="12" height="8" rx="2" />
      <path d="M7 9V6.5a3 3 0 016 0V9" />
    </svg>
  );
}
