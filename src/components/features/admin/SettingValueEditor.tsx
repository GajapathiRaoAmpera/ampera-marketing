"use client";

import { useState } from "react";
import { ApiError, type SettingType, type SettingValue } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Switch } from "@/components/ui";
import styles from "./SettingValueEditor.module.scss";

export type SettingChange = { kind: "set"; value: boolean | number } | { kind: "unlimited" } | { kind: "clear" };

/**
 * Edits one setting's value at one level (a plan, or one account).
 *
 * `emptyMeans` is what "no number" means for this setting: for usage limits it
 * is "unlimited"; for sending speed it is "the platform maximum".
 */
export function SettingValueEditor({
  type,
  label,
  value,
  isCustom,
  emptyMeans = "unlimited",
  resetLabel = "Use default",
  placeholder,
  max,
  onChange,
}: {
  type: SettingType;
  label: string;
  value: SettingValue;
  /** The level being edited has its own value (not inherited). */
  isCustom: boolean;
  emptyMeans?: "unlimited" | "platform maximum";
  resetLabel?: string;
  placeholder?: string;
  max?: number;
  onChange: (change: SettingChange) => Promise<void>;
}) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  // What the person has typed, or null to show the saved value. Cleared after
  // every save, so the box always follows the value the server now holds.
  const [typed, setTyped] = useState<string | null>(null);
  const draft = typed ?? (typeof value === "number" ? String(value) : "");

  async function run(change: SettingChange) {
    setBusy(true);
    try {
      await onChange(change);
      setTyped(null);
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : `Couldn't save "${label}".`, "error");
    } finally {
      setBusy(false);
    }
  }

  const reset = isCustom ? (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run({ kind: "clear" })}>
      {resetLabel}
    </Button>
  ) : null;

  if (type === "bool") {
    return (
      <div className={styles.row}>
        <Switch checked={Boolean(value)} disabled={busy} onChange={(next) => run({ kind: "set", value: next })} label={Boolean(value) ? "On" : "Off"} />
        {reset}
      </div>
    );
  }

  const parsed = Number(draft);
  const valid = draft.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && (max === undefined || parsed <= max);
  const unchanged = typeof value === "number" && parsed === value;
  const isEmpty = value === null;

  return (
    <div className={styles.row}>
      <div className={styles.numberWrap}>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={draft}
          placeholder={placeholder ?? (emptyMeans === "unlimited" ? "No limit" : "Platform max")}
          disabled={busy}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && valid && !unchanged) void run({ kind: "set", value: parsed });
          }}
          aria-label={label}
          className={styles.number}
        />
      </div>
      <Button size="sm" disabled={busy || !valid || unchanged} onClick={() => run({ kind: "set", value: parsed })}>
        Save
      </Button>
      {emptyMeans === "unlimited" && (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || (isEmpty && isCustom)}
          onClick={() => run({ kind: "unlimited" })}
        >
          No limit
        </Button>
      )}
      {reset}
    </div>
  );
}
