import type { ReactNode } from "react";
import clsx from "clsx";
import styles from "./Tabs.module.scss";

export interface TabOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "pill" | "underline";
}

export function Tabs<T extends string>({ options, value, onChange, variant = "pill" }: TabsProps<T>) {
  if (variant === "underline") {
    return (
      <div className={styles.underlineList} role="tablist">
        {options.map((opt) => (
          <button
            key={opt.value}
            role="tab"
            aria-selected={value === opt.value}
            className={clsx(styles.underlineTab, value === opt.value && styles.underlineActive)}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.list} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          className={clsx(styles.tab, value === opt.value && styles.active)}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
