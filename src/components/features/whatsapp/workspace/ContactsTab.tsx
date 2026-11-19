"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { whatsappStudioApi, type WhatsAppStudioContact, type WhatsAppStudioSegment } from "@/lib/api/whatsapp-studio";
import { useToast } from "@/context/ToastContext";
import { Avatar, Badge, Button, EmptyState, Input, Modal, Skeleton, Tabs, Textarea } from "@/components/ui";
import { Icon, IconTile } from "@/components/ui/Icon/Icon";
import { formatRelativeTime } from "@/lib/utils/date";
import styles from "../../instagram/workspace/workspace.module.scss";
import local from "./whatsapp.module.scss";

const PAGE = 50;
type Filter = "all" | "subscribed" | "not_subscribed";

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.userMessage : fallback;
}

function slug(value: string, separator: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, separator).replace(new RegExp(`(^${separator}|${separator}$)`, "g"), "").slice(0, 60);
}

/** Everyone who has messaged the number or been added, and the lists campaigns go to. */
export function ContactsTab({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  const { show } = useToast();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ contacts: WhatsAppStudioContact[]; total: number } | null>(null);
  const [lists, setLists] = useState<WhatsAppStudioSegment[] | null>(null);
  const [editing, setEditing] = useState<WhatsAppStudioContact | null>(null);
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    whatsappStudioApi
      .contacts(businessId, { search: query, tag: tag || undefined, optedIn: filter === "all" ? undefined : filter === "subscribed", offset: page * PAGE, limit: PAGE })
      .then((next) => !cancelled && setResult(next))
      .catch(() => !cancelled && setResult({ contacts: [], total: 0 }));
    return () => {
      cancelled = true;
    };
  }, [businessId, query, filter, tag, page, reload]);

  useEffect(() => {
    let cancelled = false;
    whatsappStudioApi
      .segments(businessId)
      .then((next) => !cancelled && setLists(next))
      .catch(() => !cancelled && setLists([]));
    return () => {
      cancelled = true;
    };
  }, [businessId, reload]);

  async function removeList(list: WhatsAppStudioSegment) {
    if (!confirm(`Delete the list “${list.name}”? The contacts stay; only the list goes.`)) return;
    try {
      await whatsappStudioApi.deleteSegment(businessId, list.id);
      show("List deleted.", "success");
      refresh();
    } catch (error) {
      show(errorText(error, "Couldn't delete this list."), "error");
    }
  }

  const listTag = (list: WhatsAppStudioSegment) => list.rules.tags_any[0] ?? "";
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE));

  return (
    <div className={styles.panel}>
      <div className={local.contactsLayout}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.titleWithIcon}>
                <IconTile name="team" tone="green" size="sm" /> Contacts
              </h3>
              <p>Everyone who has messaged your number, plus anyone you added. Campaigns only reach people marked “Subscribed”.</p>
            </div>
            {canManage && (
              <div className={local.headActions}>
                <a className={local.linkButton} href={whatsappStudioApi.exportContactsUrl(businessId)} download>
                  Export CSV
                </a>
                <Button leftIcon={<Icon name="plus" size={16} />} onClick={() => setAdding(true)}>
                  Add contacts
                </Button>
              </div>
            )}
          </div>

          <div className={local.contactFilters}>
            <label className={styles.searchBox}>
              <Icon name="search" size={16} />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search name, number or email" aria-label="Search contacts" />
            </label>
            <Tabs
              value={filter}
              onChange={(value) => { setFilter(value); setPage(0); }}
              options={[
                { value: "all", label: "All" },
                { value: "subscribed", label: "Subscribed" },
                { value: "not_subscribed", label: "Not subscribed" },
              ]}
            />
          </div>
          {tag && (
            <button type="button" className={styles.filterChipOn} onClick={() => setTag("")}>
              List: {lists?.find((list) => listTag(list) === tag)?.name ?? tag} ✕
            </button>
          )}

          {result === null ? (
            <Skeleton height={240} />
          ) : result.contacts.length === 0 ? (
            <EmptyState
              title={query || tag || filter !== "all" ? "No contacts match" : "No contacts yet"}
              description={query || tag || filter !== "all" ? "Try another search or filter." : "People appear here as soon as they message your number. You can also add a list of numbers yourself."}
            />
          ) : (
            <>
              <ul className={local.contactList}>
                {result.contacts.map((contact) => (
                  <li key={contact.id}>
                    <button type="button" className={local.contactRow} onClick={() => setEditing(contact)} disabled={!canManage}>
                      <Avatar name={contact.name || contact.phone.replace(/D/g, "").slice(-2)} size="sm" />
                      <span className={local.contactMain}>
                        <strong>{contact.name || contact.phone}</strong>
                        <span>
                          {contact.name ? contact.phone : "No name yet"}
                          {contact.ad_source ? ` · from ad: ${contact.ad_source}` : ""}
                          {contact.last_interaction ? ` · last message ${formatRelativeTime(contact.last_interaction)}` : ""}
                        </span>
                      </span>
                      <span className={local.contactTags}>
                        {contact.tags.slice(0, 3).map((item) => (
                          <span key={item} className={local.tag}>{lists?.find((list) => listTag(list) === item)?.name ?? item}</span>
                        ))}
                      </span>
                      <Badge variant={contact.whatsapp_opt_in ? "success" : "neutral"}>{contact.whatsapp_opt_in ? "Subscribed" : "Not subscribed"}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <div className={local.pager}>
                  <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <span>Page {page + 1} of {pages} · {result.total.toLocaleString()} contacts</span>
                  <Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.titleWithIcon}>
                <IconTile name="book" tone="blue" size="sm" /> Lists
              </h3>
              <p>Groups of contacts you send campaigns to, like “VIP customers” or “Diwali leads”.</p>
            </div>
          </div>
          {lists === null ? (
            <Skeleton height={120} />
          ) : lists.length === 0 ? (
            <p className={styles.muted}>No lists yet. Use “Add contacts” and give the numbers a list name.</p>
          ) : (
            <ul className={styles.miniList}>
              {lists.map((list) => (
                <li key={list.id}>
                  <button type="button" className={local.listButton} onClick={() => { setTag(listTag(list)); setPage(0); }} disabled={!listTag(list)}>
                    <strong>{list.name}</strong>
                    <span>{list.contact_count.toLocaleString()} subscribed</span>
                  </button>
                  {canManage && (
                    <button type="button" className={local.iconButton} onClick={() => void removeList(list)} aria-label={`Delete list ${list.name}`}>
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <ul className={styles.bullets}>
            <li>People who reply STOP are unsubscribed automatically; START subscribes them again.</li>
            <li>Only add numbers whose owners agreed to hear from you. Meta lowers your quality rating if people block you.</li>
          </ul>
        </aside>
      </div>

      {editing && <EditContact businessId={businessId} contact={editing} lists={lists ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {adding && <AddContacts businessId={businessId} lists={lists ?? []} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); refresh(); }} />}
    </div>
  );
}

function EditContact({ businessId, contact, lists, onClose, onSaved }: { businessId: string; contact: WhatsAppStudioContact; lists: WhatsAppStudioSegment[]; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const [name, setName] = useState(contact.name ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [tags, setTags] = useState(contact.tags.join(", "));
  const [subscribed, setSubscribed] = useState(contact.whatsapp_opt_in);
  const [source, setSource] = useState(contact.opt_in_source ?? "");
  const [busy, setBusy] = useState(false);
  const needsSource = subscribed && !contact.whatsapp_opt_in;

  async function save() {
    if (needsSource && !source.trim()) {
      show("Note how this person agreed to hear from you.", "warning");
      return;
    }
    setBusy(true);
    try {
      await whatsappStudioApi.updateContact(businessId, contact.id, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        tags: Array.from(new Set(tags.split(",").map((item) => slug(item, "-")).filter(Boolean))),
        whatsapp_opt_in: subscribed,
        ...(needsSource ? { opt_in_source: source.trim() } : {}),
      });
      show("Contact saved.", "success");
      onSaved();
    } catch (error) {
      show(errorText(error, "Couldn't save this contact."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${contact.name || contact.phone}? Their chat history stays in the inbox.`)) return;
    setBusy(true);
    try {
      await whatsappStudioApi.deleteContact(businessId, contact.id);
      show("Contact deleted.", "success");
      onSaved();
    } catch (error) {
      show(errorText(error, "Couldn't delete this contact."), "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => !busy && onClose()}
      title={contact.name || contact.phone}
      footer={
        <>
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>Delete</Button>
          <span style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void save()} isLoading={busy}>Save</Button>
        </>
      }
    >
      <div className={styles.checks}>
        <p className={styles.muted}>{contact.phone}</p>
        <Input label="Name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input
          label="Lists"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          helperText={lists.length ? `Separate with commas. Your lists: ${lists.map((list) => list.rules.tags_any[0]).filter(Boolean).join(", ")}` : "Separate with commas."}
        />
        <label className={styles.checkOption}>
          <input type="checkbox" checked={subscribed} onChange={(event) => setSubscribed(event.target.checked)} />
          <span>
            <strong>Subscribed to campaigns</strong>
            <small>{contact.whatsapp_opt_in && contact.opt_in_source ? `Agreed via: ${contact.opt_in_source}` : "Only tick this if they agreed to get messages from you."}</small>
          </span>
        </label>
        {needsSource && <Input label="How did they agree?" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Asked on WhatsApp, 3 Nov 2026" required />}
      </div>
    </Modal>
  );
}

function parseLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split(",").map((part) => part.trim()))
    .filter(([phone]) => phone)
    .map(([phone, name]) => ({ phone, name: name || undefined }));
}

function AddContacts({ businessId, lists, onClose, onAdded }: { businessId: string; lists: WhatsAppStudioSegment[]; onClose: () => void; onAdded: () => void }) {
  const { show } = useToast();
  const [method, setMethod] = useState<"paste" | "file">("paste");
  const [listName, setListName] = useState("");
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const entries = useMemo(() => parseLines(pasted), [pasted]);

  async function submit() {
    const tag = slug(listName, "-");
    if (consent && !source.trim()) {
      show("Note where they agreed to hear from you.", "warning");
      return;
    }
    setBusy(true);
    try {
      let added = 0;
      let skipped = 0;
      if (method === "file") {
        if (!file) {
          show("Choose a CSV file first.", "warning");
          setBusy(false);
          return;
        }
        const result = await whatsappStudioApi.importContacts(businessId, file, consent, tag || undefined);
        added = result.processed - result.skipped;
        skipped = result.skipped;
      } else {
        for (const entry of entries) {
          try {
            await whatsappStudioApi.createContact(businessId, { ...entry, tags: tag ? [tag] : [], whatsapp_opt_in: consent, opt_in_source: consent ? source.trim() : undefined });
            added += 1;
          } catch {
            skipped += 1;
          }
        }
      }
      if (tag && !lists.some((list) => list.rules.tags_any.includes(tag))) {
        await whatsappStudioApi.createSegment(businessId, listName.trim(), tag).catch(() => undefined);
      }
      show(`${added} added${skipped ? `, ${skipped} skipped (invalid or already there)` : ""}.`, added ? "success" : "warning");
      onAdded();
    } catch (error) {
      show(errorText(error, "Couldn't add these contacts."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      size="lg"
      onClose={() => !busy && onClose()}
      title="Add contacts"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} isLoading={busy} disabled={method === "paste" ? entries.length === 0 : !file}>
            {method === "paste" && entries.length ? `Add ${entries.length} contact${entries.length === 1 ? "" : "s"}` : "Add contacts"}
          </Button>
        </>
      }
    >
      <div className={styles.checks}>
        <Input
          label="Put them in a list (optional)"
          value={listName}
          onChange={(event) => setListName(event.target.value)}
          placeholder="VIP customers"
          helperText={lists.length ? `Use an existing name to add to it: ${lists.map((list) => list.name).join(", ")}` : "You'll pick this list when you send a campaign."}
        />
        <Tabs value={method} onChange={setMethod} options={[{ value: "paste", label: "Paste numbers" }, { value: "file", label: "Upload CSV" }]} />
        {method === "paste" ? (
          <Textarea
            label="Phone numbers"
            rows={6}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={"+919876543210, Asha Verma\n+919812345678, Rohit Shah\n+919800011122"}
            helperText="One per line, with country code. Add a name after a comma if you have it."
          />
        ) : (
          <label className={local.fileDrop}>
            <Icon name="box" size={20} />
            <span>
              <strong>{file ? file.name : "Choose a CSV file"}</strong>
              <small>Needs a “phone” column. Other columns (name, email, city…) are saved and can fill in campaign messages.</small>
            </span>
            <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
        )}
        <label className={styles.checkOption}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>
            <strong>These people agreed to get WhatsApp messages from me</strong>
            <small>Without this they&apos;re saved, but campaigns skip them.</small>
          </span>
        </label>
        {consent && <Input label="Where did they agree?" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Checkbox at checkout on our website" required />}
      </div>
    </Modal>
  );
}
