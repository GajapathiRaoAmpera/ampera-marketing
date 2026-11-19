"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./InfoLabel.module.scss";

interface InfoTipProps {
  /** What this option is for, in a sentence or two. */
  help: ReactNode;
  /** Accessible name for the button; defaults to "More information". */
  label?: string;
}

/**
 * A small "i" that explains an option. Opens on hover, keyboard focus or a
 * tap (phones have no hover), and is drawn above the page so it is never
 * clipped by a card or pushed off the screen edge.
 */
export function InfoTip({ help, label = "More information" }: InfoTipProps) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; below: boolean } | null>(null);

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
    // Below the icon when there isn't room above it.
    const below = rect.top < 120;
    setPosition({ top: below ? rect.bottom + 8 : rect.top - 8, left, width, below });
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event.type === "pointerdown" && buttonRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setPinned(false);
    };
    const reposition = () => place();
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, place]);

  function show() {
    place();
    setOpen(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.icon}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={show}
        onBlur={() => !pinned && setOpen(false)}
        onClick={(event) => {
          // Inside a <label> a click would otherwise focus the field.
          event.preventDefault();
          event.stopPropagation();
          if (pinned) {
            setPinned(false);
            setOpen(false);
          } else {
            show();
            setPinned(true);
          }
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
          <circle cx="5" cy="2" r="1.1" fill="currentColor" />
          <path d="M5 4.4v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className={`${styles.tooltip} ${position.below ? styles.below : ""}`}
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {help}
          </span>,
          document.body
        )}
    </>
  );
}

interface InfoLabelProps {
  children: ReactNode;
  help: ReactNode;
}

/** A label with an "i" after it explaining the option. */
export function InfoLabel({ children, help }: InfoLabelProps) {
  return (
    <span className={styles.label}>
      {children}
      <InfoTip help={help} />
    </span>
  );
}
