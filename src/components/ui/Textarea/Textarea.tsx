import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import styles from "./Textarea.module.scss";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  helperText?: string;
  showCharCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, showCharCount, maxLength, value, className, id, ...rest }, ref) => {
    const autoId = useId();
    const textareaId = id ?? autoId;
    const length = typeof value === "string" ? value.length : 0;

    return (
      <div className={styles.field}>
        {label && (
          <label htmlFor={textareaId} className={styles.label}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(styles.textarea, className)}
          maxLength={maxLength}
          value={value}
          {...rest}
        />
        {showCharCount && maxLength && (
          <span className={styles.charCount}>
            {length}/{maxLength}
          </span>
        )}
        {helperText && <span className={styles.helperText}>{helperText}</span>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
