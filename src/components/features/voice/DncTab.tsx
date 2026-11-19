"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Skeleton, Switch, Table, Textarea } from "@/components/ui";
import { ApiError, voiceCenterApi, type DncEntry } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { ConfirmDialog } from "./ConfirmDialog";
import styles from "./VoiceCenter.module.scss";
import { parseServerDate } from "@/lib/utils/date";

const SOURCE_LABELS: Record<DncEntry["source"], string> = {
  manual: "Added by you",
  caller_request: "Asked during a call",
  ai_detected: "Found in call review",
};

export function DncTab() {
  const { show } = useToast();
  const [data, setData] = useState<{ numbers: DncEntry[]; total: number } | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({ numbers: "", reason: "", blockInbound: false });
  const [isAdding, setIsAdding] = useState(false);
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState<DncEntry | null>(null);

  const load = useCallback(() => {
    return voiceCenterApi.listDnc(search.trim() || undefined)
      .then((value) => { setData(value); setFailed(false); })
      .catch(() => setFailed(true));
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function add() {
    const numbers = draft.numbers.split(/[\n,;]/).map((value) => value.trim()).filter(Boolean);
    if (!numbers.length) return;
    setIsAdding(true);
    try {
      const result = await voiceCenterApi.addDnc(numbers, { reason: draft.reason.trim(), block_inbound: draft.blockInbound });
      show(
        `${result.added} number${result.added === 1 ? "" : "s"} added.${result.invalid ? ` ${result.invalid} skipped: include the country code, like +91.` : ""}`,
        result.added ? "success" : "error",
      );
      if (result.added) setDraft({ numbers: "", reason: "", blockInbound: false });
      await load();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't add those numbers.", "error");
    } finally {
      setIsAdding(false);
    }
  }

  async function remove(entry: DncEntry) {
    try {
      await voiceCenterApi.removeDnc(entry.number);
      await load();
    } catch {
      show("Couldn't remove that number.", "error");
    }
  }

  return (
    <div className={styles.stack}>
      <Card>
        <div className={styles.sectionTitle}>Do-not-call list</div>
        <div className={styles.sectionHint}>
          Your agent never dials these numbers, in campaigns, retries or scheduled calls. Anyone who says &quot;stop calling me&quot; on a call is added automatically.
        </div>
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <Textarea
              label="Numbers to add"
              value={draft.numbers}
              onChange={(e) => setDraft({ ...draft, numbers: e.target.value })}
              placeholder={"+919876543210\n+919123456780"}
              helperText="One per line or comma separated, with country code."
              rows={3}
            />
          </div>
          <Input label="Reason (optional)" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} maxLength={300} />
          <div style={{ alignSelf: "center" }}>
            <Switch
              checked={draft.blockInbound}
              onChange={(value) => setDraft({ ...draft, blockInbound: value })}
              label="Also reject their incoming calls (spam)"
            />
          </div>
          <div className={styles.fullWidth}>
            <Button onClick={add} isLoading={isAdding} disabled={!draft.numbers.trim()}>Add to list</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className={styles.toolbar}>
          <div className={styles.toolbarGrow}>
            <Input label="Find a number" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="+91…" />
          </div>
          {data && <span className={styles.muted}>{data.total} on the list</span>}
        </div>
        <div style={{ marginTop: "var(--space-4)" }}>
          {failed ? (
            <EmptyState title="Couldn't load the list" description="Check your connection and try again." action={<Button onClick={() => void load()}>Try again</Button>} />
          ) : !data ? (
            <Skeleton height={160} />
          ) : data.numbers.length === 0 ? (
            <EmptyState title={search ? "No match" : "Nobody on the list yet"} description={search ? "Check the number and try again." : "Numbers you add, and callers who opt out, appear here."} />
          ) : (
            <Table<DncEntry>
              rows={data.numbers}
              rowKey={(entry) => entry.number}
              columns={[
                { key: "number", header: "Number", render: (entry) => entry.number },
                {
                  key: "source", header: "How it got here",
                  render: (entry) => (
                    <div className={styles.badgeRow}>
                      <Badge variant={entry.source === "manual" ? "neutral" : "warning"}>{SOURCE_LABELS[entry.source] ?? entry.source}</Badge>
                      {entry.block_inbound && <Badge variant="danger">Incoming blocked</Badge>}
                    </div>
                  ),
                },
                { key: "reason", header: "Reason", render: (entry) => <div className={styles.outcomeCell}>{entry.reason}</div> },
                { key: "added", header: "Added", width: "130px", render: (entry) => (entry.created_at ? parseServerDate(entry.created_at).toLocaleDateString() : "") },
                { key: "remove", header: "", width: "100px", render: (entry) => <Button size="sm" variant="ghost" onClick={() => setRemoving(entry)}>Remove</Button> },
              ]}
            />
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={Boolean(removing)}
        title={`Allow calls to ${removing?.number ?? ""} again?`}
        confirmLabel="Remove from list"
        onConfirm={async () => { if (removing) await remove(removing); }}
        onClose={() => setRemoving(null)}
      >
        {removing?.source === "manual"
          ? "Your agent will be able to call this number in campaigns and scheduled calls."
          : "This person asked not to be called. Only remove them if they have since agreed to be contacted."}
      </ConfirmDialog>
    </div>
  );
}
