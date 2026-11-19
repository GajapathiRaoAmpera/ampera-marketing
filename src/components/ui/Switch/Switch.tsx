import { useId, type InputHTMLAttributes } from "react";
import clsx from "clsx";
import styles from "./Switch.module.scss";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Switch({ checked, onChange, label, disabled, id, ...rest }: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;

  return (
    <label htmlFor={switchId} className={clsx(styles.wrap, disabled && styles.disabled)}>
      <input
        id={switchId}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.hiddenInput}
        {...rest}
      />
      <span className={clsx(styles.track, checked && styles.checked)}>
        <span className={styles.thumb} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
