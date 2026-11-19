"use client";

import type { MessengerAction, MessengerActionItem } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";
import styles from "./Messenger.module.scss";

export const ACTION_LABELS: Record<MessengerAction, string> = {
  ask: "Ask the assistant",
  url: "Open a link",
  products: "Show products",
  human: "Talk to a person",
  book: "Book an appointment",
  whatsapp: "Continue on WhatsApp",
  share_phone: "Share phone number",
  share_email: "Share email",
  rate: "Rate the chat",
};

interface ActionListEditorProps {
  items: MessengerActionItem[];
  onChange: (items: MessengerActionItem[]) => void;
  max: number;
  addLabel: string;
  /** Actions that make no sense in this spot, e.g. one-tap sharing in a menu. */
  exclude?: MessengerAction[];
}

/** Edits a short list of "button label → what it does" rows. */
export function ActionListEditor({ items, onChange, max, addLabel, exclude = [] }: ActionListEditorProps) {
  const actions = (Object.keys(ACTION_LABELS) as MessengerAction[]).filter((action) => !exclude.includes(action));
  const update = (index: number, patch: Partial<MessengerActionItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <>
      {items.map((item, index) => {
        const needsLabel = item.action !== "share_phone" && item.action !== "share_email";
        return (
          <div key={index} className={styles.row}>
            {needsLabel && (
              <Input
                aria-label="Button label"
                placeholder="Button label"
                value={item.title}
                maxLength={20}
                onChange={(e) => update(index, { title: e.target.value })}
              />
            )}
            <Select aria-label="What it does" value={item.action} onChange={(e) => update(index, { action: e.target.value as MessengerAction, value: "" })}>
              {actions.map((action) => (
                <option key={action} value={action}>{ACTION_LABELS[action]}</option>
              ))}
            </Select>
            {(item.action === "ask" || item.action === "url") && (
              <Input
                aria-label={item.action === "url" ? "Link" : "Question to ask"}
                placeholder={item.action === "url" ? "https://…" : "Question (optional)"}
                value={item.value}
                onChange={(e) => update(index, { value: e.target.value })}
              />
            )}
            <button type="button" className={styles.iconButton} onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label="Remove">✕</button>
          </div>
        );
      })}
      {items.length < max && (
        <div>
          <Button size="sm" variant="secondary" onClick={() => onChange([...items, { title: "", action: "ask", value: "" }])}>
            {addLabel}
          </Button>
        </div>
      )}
    </>
  );
}
