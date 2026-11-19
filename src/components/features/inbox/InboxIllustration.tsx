export function InboxIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} width="180" height="140" viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="inboxGrad" x1="0" y1="0" x2="180" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-brand-400)" />
          <stop offset="55%" stopColor="var(--color-brand-500)" />
          <stop offset="100%" stopColor="var(--color-brand-600)" />
        </linearGradient>
      </defs>
      <rect x="20" y="28" width="140" height="92" rx="14" fill="var(--color-bg-surface-sunken)" stroke="var(--color-border-subtle)" strokeWidth="1.5" />
      <path d="M20 42a14 14 0 0114-14h92a14 14 0 0114 14v6H20v-6z" fill="url(#inboxGrad)" opacity="0.14" />
      <rect x="36" y="54" width="70" height="10" rx="5" fill="var(--color-border-default)" />
      <rect x="36" y="72" width="98" height="8" rx="4" fill="var(--color-border-subtle)" />
      <rect x="36" y="88" width="60" height="8" rx="4" fill="var(--color-border-subtle)" />
      <circle cx="132" cy="30" r="26" fill="url(#inboxGrad)" />
      <path
        d="M120 26l8 8 12-14"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="20" r="4" fill="var(--color-brand-300)" opacity="0.6" />
      <circle cx="160" cy="110" r="5" fill="var(--color-brand-300)" opacity="0.4" />
    </svg>
  );
}
