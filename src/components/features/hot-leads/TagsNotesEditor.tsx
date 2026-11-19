"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui";
import styles from "./TagsNotesEditor.module.scss";

// Shared with the inbox's TagsNotesPopover (components/features/inbox/),
// which wraps this same editing UI behind a popover trigger for the
// message-list header where space is tight. Here (Hot Leads / Follow-ups
// detail) there's room to show it inline, always open, as its own section -
// same default tags, same add/remove/save behavior either way, so a tag
// added from one place looks identical from the other.
export const DEFAULT_SUGGESTED_TAGS = [
  "VIP",
  "Ready to buy",
  "Price sensitive",
  "Needs follow-up",
  "Wholesale",
  "Repeat customer",
  "Complaint",
  "Spam/Bot",
];

const NOTES_MAX_LENGTH = 4000;

export function TagsNotesEditor({
  tags,
  notes,
  onSave,
}: {
  tags: string[];
  notes: string | null | undefined;
  onSave: (input: { tags?: string[]; notes?: string }) => Promise<void>;
}) {
  const [draftTags, setDraftTags] = useState(tags);
  const [tagInput, setTagInput] = useState("");
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  async function commitTags(next: string[]) {
    setDraftTags(next);
    setIsSavingTags(true);
    try {
      await onSave({ tags: next });
    } finally {
      setIsSavingTags(false);
    }
  }

  function addTag(raw: string) {
    const value = raw.trim();
    if (!value || draftTags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    void commitTags([...draftTags, value]);
    setTagInput("");
  }

  function removeTag(value: string) {
    void commitTags(draftTags.filter((t) => t !== value));
  }

  async function saveNotes() {
    if (draftNotes === (notes ?? "")) return;
    setIsSavingNotes(true);
    try {
      await onSave({ notes: draftNotes });
    } finally {
      setIsSavingNotes(false);
    }
  }

  const availableSuggestions = DEFAULT_SUGGESTED_TAGS.filter(
    (suggestion) => !draftTags.some((t) => t.toLowerCase() === suggestion.toLowerCase())
  );

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Tags</div>
        {draftTags.length > 0 && (
          <div className={styles.chipRow}>
            {draftTags.map((tag) => (
              <span key={tag} className={styles.chip}>
                {tag}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeTag(tag)}
                  disabled={isSavingTags}
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          className={styles.tagInput}
          placeholder="Type a tag and press Enter…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          disabled={isSavingTags}
        />
        {availableSuggestions.length > 0 && (
          <div className={styles.suggestionRow}>
            {availableSuggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                className={styles.suggestionChip}
                onClick={() => addTag(suggestion)}
                disabled={isSavingTags}
              >
                + {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Note (private, only your team sees this)</div>
        <Textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          onBlur={saveNotes}
          maxLength={NOTES_MAX_LENGTH}
          rows={3}
          placeholder="e.g. Prefers evening calls, already has a similar product…"
          className={styles.notesTextarea}
        />
        <div className={styles.notesFooter}>
          {isSavingNotes ? "Saving…" : draftNotes !== (notes ?? "") ? "Unsaved (saves when you click away)" : " "}
        </div>
      </div>
    </div>
  );
}
