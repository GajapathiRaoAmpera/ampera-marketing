"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import styles from "./FilterDropdown.module.scss";

export interface FilterDropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  color?: string;
}

export function FilterDropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: FilterDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.trigger} onClick={() => setIsOpen((v) => !v)}>
        {active?.icon && (
          <span className={styles.triggerIcon} style={{ color: active.color }}>
            {active.icon}
          </span>
        )}
        <span className={styles.triggerLabel}>{active ? active.label : placeholder}</span>
        <svg className={clsx(styles.chevron, isOpen && styles.chevronOpen)} width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div className={styles.menu}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={clsx(styles.option, opt.value === value && styles.optionActive)}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.icon && (
                <span className={styles.optionIcon} style={{ color: opt.color }}>
                  {opt.icon}
                </span>
              )}
              <span className={styles.optionLabel}>{opt.label}</span>
              {opt.value === value && (
                <svg className={styles.check} width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
