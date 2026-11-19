"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { TagIcon } from "@/components/layout/icons";
import { TagsNotesEditor } from "@/components/features/hot-leads/TagsNotesEditor";
import styles from "./TagsNotesPopover.module.scss";

// Popover chrome around the shared TagsNotesEditor - the inbox message-list
// header has no room for an always-open section (see Hot Leads/Follow-ups'
// LeadTimelineModal for that version), so this hides it behind a trigger
// button instead.
export function TagsNotesPopover({
  tags,
  notes,
  onSave,
}: {
  tags: string[];
  notes: string | null | undefined;
  onSave: (input: { tags?: string[]; notes?: string }) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasContent = tags.length > 0 || Boolean(notes?.trim());

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={clsx(styles.trigger, hasContent && styles.triggerActive)}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Tags and notes"
        title="Tags and notes"
      >
        <TagIcon size={16} />
        <span className={styles.triggerLabel}>{tags.length > 0 ? `Tags · ${tags.length}` : "Tags & notes"}</span>
      </button>

      {isOpen && (
        <div className={styles.panel}>
          {/* Re-keying on tags/notes identity isn't needed here: the popover
              unmounts its contents on close (isOpen && ...), so the editor's
              internal draft state is naturally fresh every time it reopens,
              same effect the old openPopover() reset used to achieve by hand. */}
          <TagsNotesEditor tags={tags} notes={notes} onSave={onSave} />
        </div>
      )}
    </div>
  );
}
