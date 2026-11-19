import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import styles from "./Input.module.scss";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  helperText?: string;
  errorText?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, errorText, leftIcon, rightSlot, required, className, id, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className={styles.field}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        <div className={styles.inputWrap}>
          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              styles.input,
              leftIcon && styles.hasLeftIcon,
              rightSlot && styles.hasRightSlot,
              errorText && styles.error,
              className
            )}
            aria-invalid={Boolean(errorText)}
            aria-describedby={errorText ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            required={required}
            {...rest}
          />
          {rightSlot && <span className={styles.rightSlot}>{rightSlot}</span>}
        </div>
        {errorText && (
          <span id={`${inputId}-error`} className={styles.errorText}>
            {errorText}
          </span>
        )}
        {!errorText && helperText && (
          <span id={`${inputId}-helper`} className={styles.helperText}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
