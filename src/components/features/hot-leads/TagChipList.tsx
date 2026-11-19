import styles from "./TagChipList.module.scss";

// Read-only display, used on Hot Leads / Follow-ups cards. Editing tags
// happens in the inbox (TagsNotesPopover) while a conversation is open -
// this just reflects whatever's already been set there.
export function TagChipList({ tags, max = 4 }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, max);
  const overflow = tags.length - visible.length;

  return (
    <div className={styles.row}>
      {visible.map((tag) => (
        <span key={tag} className={styles.chip}>
          {tag}
        </span>
      ))}
      {overflow > 0 && <span className={styles.overflow}>+{overflow}</span>}
    </div>
  );
}
