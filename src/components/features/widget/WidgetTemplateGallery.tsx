"use client";

import clsx from "clsx";
import styles from "./WidgetTemplateGallery.module.scss";

export interface WidgetTemplateOption {
  value: "bubble" | "panel" | "bar";
  label: string;
  description: string;
}

export const WIDGET_TEMPLATE_OPTIONS: WidgetTemplateOption[] = [
  { value: "bubble", label: "Floating bubble", description: "A round button in the corner that opens the chat above it." },
  { value: "panel", label: "Side panel", description: "A tab on the edge of the screen slides a full-height chat in." },
  { value: "bar", label: "Ask bar", description: "An “ask anything” pill at the bottom of the page that opens into a chat." },
];

const PAGE = "var(--color-bg-surface-sunken)";
const INK = "var(--color-border-default)";

/** A faint stand-in for the customer's web page behind the widget. */
function PageLines() {
  return (
    <>
      <rect width="160" height="110" rx="8" fill={PAGE} />
      <rect x="12" y="12" width="46" height="7" rx="3.5" fill={INK} />
      <rect x="12" y="26" width="76" height="5" rx="2.5" fill={INK} opacity="0.6" />
      <rect x="12" y="36" width="60" height="5" rx="2.5" fill={INK} opacity="0.6" />
    </>
  );
}

function TemplateThumbnail({ template, color }: { template: WidgetTemplateOption["value"]; color: string }) {
  if (template === "panel") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 160 110" fill="none">
        <PageLines />
        <rect x="104" y="0" width="56" height="110" fill="white" />
        <rect x="104" y="0" width="56" height="22" fill={color} />
        <rect x="110" y="6" width="10" height="10" rx="3.5" fill="white" opacity="0.35" />
        <rect x="124" y="9" width="22" height="4" rx="2" fill="white" opacity="0.9" />
        <rect x="110" y="32" width="32" height="9" rx="4.5" fill={PAGE} />
        <rect x="126" y="46" width="28" height="9" rx="4.5" fill={color} />
        <rect x="110" y="60" width="26" height="9" rx="4.5" fill={PAGE} />
        <rect x="110" y="94" width="44" height="9" rx="4.5" fill={PAGE} />
      </svg>
    );
  }
  if (template === "bar") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 160 110" fill="none">
        <PageLines />
        <rect x="32" y="84" width="96" height="18" rx="9" fill="white" stroke={INK} />
        <circle cx="42" cy="93" r="5" fill={color} opacity="0.25" />
        <rect x="52" y="90.5" width="44" height="5" rx="2.5" fill={INK} />
        <circle cx="118" cy="93" r="6" fill={color} />
      </svg>
    );
  }
  // bubble
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 110" fill="none">
      <PageLines />
      <rect x="92" y="14" width="58" height="66" rx="9" fill="white" />
      <path d="M92 23a9 9 0 0 1 9-9h40a9 9 0 0 1 9 9v7H92z" fill={color} />
      <rect x="98" y="19" width="8" height="8" rx="3" fill="white" opacity="0.35" />
      <rect x="110" y="21" width="20" height="4" rx="2" fill="white" opacity="0.9" />
      <rect x="98" y="38" width="30" height="8" rx="4" fill={PAGE} />
      <rect x="118" y="50" width="26" height="8" rx="4" fill={color} />
      <rect x="98" y="66" width="46" height="8" rx="4" fill={PAGE} />
      <circle cx="138" cy="94" r="11" fill={color} />
      <path d="M133.5 93.5h9M133.5 96.5h5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function WidgetTemplateGallery({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (template: string) => void;
  color: string;
}) {
  return (
    <div className={styles.grid}>
      {WIDGET_TEMPLATE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={clsx(styles.option, value === opt.value && styles.optionActive)}
          onClick={() => onChange(opt.value)}
        >
          <div className={styles.thumbnail}>
            <TemplateThumbnail template={opt.value} color={color} />
          </div>
          <div className={styles.optionLabel}>{opt.label}</div>
          <div className={styles.optionDescription}>{opt.description}</div>
          {value === opt.value && (
            <div className={styles.checkBadge}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
