"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { voiceRealtimeApi, type ContactProfile, type Voicemail } from "@/lib/api/voice-realtime";
import { useToast } from "@/context/ToastContext";
import styles from "./VoiceCenter.module.scss";
import { parseServerDate } from "@/lib/utils/date";

/** Messages people left when nobody could take the call, and what the agent remembers about each caller. */
export function MessagesTab() {
  const [view, setView] = useState<"voicemails" | "contacts">("voicemails");
  return (
    <div className={styles.stack}>
      <div className={styles.toolbar} role="group" aria-label="Messages view">
        <Button variant={view === "voicemails" ? "primary" : "secondary"} size="sm" onClick={() => setView("voicemails")}>Voicemails</Button>
        <Button variant={view === "contacts" ? "primary" : "secondary"} size="sm" onClick={() => setView("contacts")}>What we remember about callers</Button>
      </div>
      {view === "voicemails" ? <Voicemails /> : <Contacts />}
    </div>
  );
}

function Voicemails() {
  const { show } = useToast();
  const [status, setStatus] = useState<"new" | "handled">("new");
  const [items, setItems] = useState<Voicemail[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    voiceRealtimeApi.voicemails(status).then((res) => { setItems(res.voicemails); setFailed(false); }).catch(() => setFailed(true));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  async function mark(item: Voicemail, next: "new" | "handled") {
    try { await voiceRealtimeApi.updateVoicemail(item.id, next); load(); }
    catch { show("Couldn't update that message.", "error"); }
  }
  async function remove(item: Voicemail) {
    try { await voiceRealtimeApi.deleteVoicemail(item.id); load(); }
    catch { show("Couldn't delete that message.", "error"); }
  }

  if (failed) return <EmptyState title="Couldn't load your voicemails" description="Check your connection and try again." action={<Button onClick={load}>Try again</Button>} />;
  if (!items) return <Skeleton height={240} />;
  return (
    <Card>
      <div className={styles.toolbar}>
        <div className={styles.sectionTitle}>Voicemails</div>
        <div className={styles.spacer} />
        <Button size="sm" variant={status === "new" ? "primary" : "secondary"} onClick={() => setStatus("new")}>To do</Button>
        <Button size="sm" variant={status === "handled" ? "primary" : "secondary"} onClick={() => setStatus("handled")}>Done</Button>
      </div>
      {items.length === 0
        ? <p className={styles.muted}>{status === "new" ? "No messages waiting. When someone leaves one after hours, it appears here, written out." : "Nothing marked done yet."}</p>
        : <div className={styles.list}>{items.map((item) => (
          <div key={item.id} className={styles.listRow} style={{ alignItems: "flex-start" }}>
            <div className={styles.listMain}>
              <div className={styles.listTitle}>
                {item.name || item.number}
                {item.urgency === "urgent" && <Badge variant="danger" style={{ marginLeft: "var(--space-2)" }}>Urgent</Badge>}
                {item.department && <Badge variant="neutral" style={{ marginLeft: "var(--space-2)" }}>{item.department}</Badge>}
              </div>
              <div>{item.summary}</div>
              <details><summary className={styles.muted}>Full message</summary><p className={styles.muted}>{item.transcript}</p></details>
              <div className={styles.muted}>{parseServerDate(item.created_at).toLocaleString()} · {item.number}</div>
            </div>
            <a href={`tel:${item.number}`}>Call back</a>
            {item.status === "new"
              ? <Button size="sm" onClick={() => mark(item, "handled")}>Mark done</Button>
              : <Button size="sm" variant="secondary" onClick={() => mark(item, "new")}>Reopen</Button>}
            <Button size="sm" variant="outline-danger" onClick={() => remove(item)}>Delete</Button>
          </div>))}</div>}
    </Card>
  );
}

function Contacts() {
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ContactProfile[] | null>(null);
  const [editing, setEditing] = useState<ContactProfile | null>(null);
  const [facts, setFacts] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    voiceRealtimeApi.contacts(query).then((res) => setItems(res.contacts)).catch(() => show("Couldn't load contacts.", "error"));
  }, [query, show]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);

  function open(contact: ContactProfile) { setEditing(contact); setFacts((contact.facts ?? []).join("\n")); }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await voiceRealtimeApi.saveContact(editing.number, {
        name: editing.name ?? "", language: editing.language ?? "", notes: editing.notes ?? "",
        facts: facts.split("\n").map((line) => line.trim()).filter(Boolean),
      });
      show("Saved. Anything sensitive in the list was not kept.", "success");
      setEditing(null);
      load();
    } catch { show("Couldn't save that contact.", "error"); } finally { setBusy(false); }
  }
  async function forget() {
    if (!editing) return;
    setBusy(true);
    try { await voiceRealtimeApi.forgetContact(editing.number); show("Everything remembered about this number was erased.", "success"); setEditing(null); load(); }
    catch { show("Couldn't erase that contact.", "error"); } finally { setBusy(false); }
  }

  return (
    <Card>
      <div className={styles.sectionTitle}>What we remember about callers</div>
      <div className={styles.sectionHint}>
        After each call the agent keeps a few short, lasting details a caller mentioned (a name, a language, a preference), so returning callers are known. Health, religion, politics, money and account details, ID numbers and passwords are never kept. You can correct or erase any contact, and it only happens while &quot;Remember returning callers&quot; is on under Rules.
      </div>
      <input aria-label="Search contacts" placeholder="Search by name or number" value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-background)", color: "inherit" }} />
      {!items ? <Skeleton height={160} /> : items.length === 0
        ? <p className={styles.muted}>No one yet. Contacts appear here as people call.</p>
        : <div className={styles.list}>{items.map((contact) => (
          <div key={contact.number} className={styles.listRow}>
            <div className={styles.listMain}>
              <div className={styles.listTitle}>{contact.name || contact.number}{contact.language ? ` · ${contact.language}` : ""}</div>
              <div className={styles.muted}>{contact.number} · {contact.calls ?? 0} calls{contact.facts?.length ? ` · ${contact.facts.slice(0, 2).join("; ")}` : ""}</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => open(contact)}>Open</Button>
          </div>))}</div>}
      {editing && (
        <div className={styles.callout} role="dialog" aria-label={`Contact ${editing.number}`} style={{ display: "grid", gap: "var(--space-2)" }}>
          <strong>{editing.number}</strong>
          <input aria-label="Name" placeholder="Name" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={60} />
          <input aria-label="Preferred language" placeholder="Preferred language" value={editing.language ?? ""} onChange={(e) => setEditing({ ...editing, language: e.target.value })} maxLength={30} />
          <textarea aria-label="Remembered details, one per line" placeholder="One detail per line, e.g. prefers morning appointments" value={facts} onChange={(e) => setFacts(e.target.value)} rows={5} />
          <input aria-label="Note for your team" placeholder="A note the agent will also see" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} maxLength={300} />
          {editing.last_outcome && <div className={styles.muted}>Last call: {editing.last_outcome}</div>}
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button size="sm" isLoading={busy} onClick={save}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <div style={{ flex: 1 }} />
            <Button size="sm" variant="outline-danger" isLoading={busy} onClick={forget}>Erase this contact</Button>
          </div>
        </div>)}
    </Card>
  );
}
