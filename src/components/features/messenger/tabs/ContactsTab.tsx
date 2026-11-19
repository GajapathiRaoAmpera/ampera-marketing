"use client";

import { useCallback, useEffect, useState } from "react";
import {
  messengerPageApi,
  ApiError,
  type MessengerContact,
  type MessengerSendInput,
  type MessengerSendKind,
  type MessengerWindow,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Avatar, Badge, Button, EmptyState, Input, Modal, Select, Skeleton, Textarea } from "@/components/ui";
import styles from "@/components/features/messenger/Messenger.module.scss";

const SEND_KINDS: Array<{ value: MessengerSendKind; label: string }> = [
  { value: "text", label: "A message" },
  { value: "products", label: "Product cards" },
  { value: "link_button", label: "A link that opens in the chat" },
  { value: "coupon", label: "A coupon" },
  { value: "receipt", label: "An order receipt" },
  { value: "share_phone", label: "Ask for their phone number" },
  { value: "share_email", label: "Ask for their email" },
  { value: "rating", label: "Ask for a rating" },
  { value: "optin", label: "Invite to get updates" },
  { value: "whatsapp", label: "Continue on WhatsApp button" },
];

function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const hours = Math.max(0, (new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (hours >= 48) return `${Math.round(hours / 24)}d left`;
  return hours >= 1 ? `${Math.round(hours)}h left` : `${Math.max(1, Math.round(hours * 60))}m left`;
}

function WindowBadge({ window }: { window: MessengerWindow }) {
  if (window.state === "open") return <Badge variant="success">Can reply · {timeLeft(window.standard_closes_at)}</Badge>;
  if (window.state === "human_agent") return <Badge variant="warning">Person only · {timeLeft(window.human_closes_at)}</Badge>;
  return <Badge variant="neutral">Window closed</Badge>;
}

function SendModal({ pageId, contact, onClose }: { pageId: string; contact: MessengerContact; onClose: () => void }) {
  const { show } = useToast();
  const closed = contact.window.state === "closed";
  const [input, setInput] = useState<MessengerSendInput>({ kind: "text", text: "", update_type: closed ? "order_update" : undefined });
  const [item, setItem] = useState({ title: "", quantity: 1, price: 0 });
  const [isSending, setIsSending] = useState(false);
  const patch = (value: Partial<MessengerSendInput>) => setInput((current) => ({ ...current, ...value }));
  const { kind } = input;
  const usesText = kind === "text" || kind === "link_button" || kind === "share_phone" || kind === "share_email";

  async function send() {
    setIsSending(true);
    try {
      await messengerPageApi.send(pageId, contact.psid, kind === "receipt" ? { ...input, items: [item] } : input);
      show("Sent.", "success");
      onClose();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't send. Please try again.", "error");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Send to ${contact.name ?? "this person"}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={send} isLoading={isSending}>Send</Button>
        </>
      }
    >
      <div className={styles.modalStack}>
        <Select label="What to send" value={kind} onChange={(e) => patch({ kind: e.target.value as MessengerSendKind })}>
          {SEND_KINDS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
        {usesText && (
          <Textarea
            label={kind === "text" ? "Message" : "Message (optional)"}
            value={input.text ?? ""}
            onChange={(e) => patch({ text: e.target.value })}
            maxLength={2000}
            rows={3}
          />
        )}
        {(kind === "coupon" || kind === "optin") && (
          <Input label="Title" value={input.title ?? ""} onChange={(e) => patch({ title: e.target.value })} maxLength={80} />
        )}
        {kind === "coupon" && (
          <Input label="Coupon code" value={input.coupon_code ?? ""} onChange={(e) => patch({ coupon_code: e.target.value })} />
        )}
        {(kind === "link_button" || kind === "coupon") && (
          <div className={styles.row}>
            <Input label={kind === "coupon" ? "Shop link (optional)" : "Link"} placeholder="https://…" value={input.url ?? ""} onChange={(e) => patch({ url: e.target.value })} />
            <Input label="Button text" placeholder="Open" value={input.button_title ?? ""} onChange={(e) => patch({ button_title: e.target.value })} maxLength={20} />
          </div>
        )}
        {kind === "receipt" && (
          <>
            <Input label="Order number" value={input.order_number ?? ""} onChange={(e) => patch({ order_number: e.target.value })} />
            <div className={styles.row}>
              <Input label="Item" value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} />
              <Input type="number" label="Qty" min={1} value={item.quantity} onChange={(e) => setItem({ ...item, quantity: Number(e.target.value) })} />
              <Input type="number" label="Price" min={0} value={item.price} onChange={(e) => setItem({ ...item, price: Number(e.target.value) })} />
            </div>
          </>
        )}
        {closed && (
          <Select
            label="This person last wrote over 7 days ago. Send as"
            value={input.update_type}
            onChange={(e) => patch({ update_type: e.target.value as MessengerSendInput["update_type"] })}
          >
            <option value="order_update">An update about their order</option>
            <option value="event_update">An update about their booking or event</option>
            <option value="account_update">An update about their account</option>
          </Select>
        )}
        {closed && <p className={styles.hint}>Meta only allows these updates outside the window, and no promotions in them.</p>}
      </div>
    </Modal>
  );
}

function Contacts({ pageId }: { pageId: string }) {
  const { show } = useToast();
  const [contacts, setContacts] = useState<MessengerContact[] | null>(null);
  const [search, setSearch] = useState("");
  const [sendTo, setSendTo] = useState<MessengerContact | null>(null);
  const [summary, setSummary] = useState<{ name: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    (term: string) =>
      messengerPageApi
        .contacts(pageId, term || undefined)
        .then(setContacts)
        .catch(() => setContacts([])),
    [pageId]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search.trim()), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  async function run(key: string, task: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await task();
      show(done, "success");
      await load(search.trim());
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Something went wrong. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function importHistory() {
    setBusy("import");
    try {
      const result = await messengerPageApi.importHistory(pageId);
      show(result.imported ? `Imported ${result.imported} conversations.` : "Nothing new to import.", "success");
      await load(search.trim());
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't import conversations.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function summarise(contact: MessengerContact) {
    setBusy(`summary-${contact.psid}`);
    try {
      const text = await messengerPageApi.summary(pageId, contact.psid);
      setSummary({ name: contact.name ?? "Conversation", text: text || "Not enough messages to summarise yet." });
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't summarise this chat.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Input placeholder="Search by name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search contacts" />
        <Button variant="secondary" onClick={importHistory} isLoading={busy === "import"}>Import past chats</Button>
      </div>

      {!contacts ? (
        <Skeleton height={240} />
      ) : contacts.length === 0 ? (
        <EmptyState title="No contacts yet" description="People appear here once they message your Page. You can also import your Page's past chats." />
      ) : (
        <div className={styles.list}>
          {contacts.map((contact) => (
            <div key={contact.psid} className={styles.listRow}>
              {contact.profile_pic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={contact.profile_pic} alt="" className={styles.avatar} />
              ) : (
                <Avatar name={contact.name ?? "?"} />
              )}
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{contact.name ?? "Messenger user"}</div>
                <div className={styles.rowMeta}>
                  <WindowBadge window={contact.window} />
                  {contact.thread_owner === "page_inbox" && <Badge variant="info">In Meta inbox</Badge>}
                  {contact.needs_callback && <Badge variant="danger">Wants a callback</Badge>}
                  {contact.lead_label && <span>{contact.lead_label} lead</span>}
                  {contact.subscribed && <span>Subscribed</span>}
                  {contact.source?.ad_id && <span>From an ad</span>}
                  {contact.phone && <span>{contact.phone}</span>}
                  {contact.email && <span>{contact.email}</span>}
                  {contact.linked_profiles.length > 0 && <span>Also on {contact.linked_profiles.map((p) => p.channel).join(", ")}</span>}
                </div>
              </div>
              <div className={styles.rowActions}>
                <Button size="sm" onClick={() => setSendTo(contact)}>Send</Button>
                <Button size="sm" variant="secondary" isLoading={busy === `summary-${contact.psid}`} onClick={() => summarise(contact)}>Summary</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isLoading={busy === `handover-${contact.psid}`}
                  onClick={() =>
                    run(
                      `handover-${contact.psid}`,
                      () => messengerPageApi.handover(pageId, contact.psid, contact.thread_owner === "page_inbox" ? "bot" : "page_inbox"),
                      contact.thread_owner === "page_inbox" ? "The assistant is back on this chat." : "Moved to Meta Business Suite."
                    )
                  }
                >
                  {contact.thread_owner === "page_inbox" ? "Take back" : "Hand over"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sendTo && (
        <SendModal
          pageId={pageId}
          contact={sendTo}
          onClose={() => {
            setSendTo(null);
            void load(search.trim());
          }}
        />
      )}
      {summary && (
        <Modal isOpen onClose={() => setSummary(null)} title={summary.name}>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{summary.text}</p>
        </Modal>
      )}
    </>
  );
}

export function ContactsTab({ pageId }: { pageId: string }) {
  return <Contacts pageId={pageId} />;
}
