"use client";

import Link from "next/link";
import { useState } from "react";
import { widgetApi, type WidgetVisitor } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Badge, Button, EmptyState, Input, Skeleton, Switch } from "@/components/ui";
import list from "@/components/features/messenger/Messenger.module.scss";
import styles from "./WidgetVisitors.module.scss";

/** "Asia/Kolkata" says roughly where someone is; turn it into a place a person would recognise. */
function placeFrom(timezone: string | null): string | null {
  if (!timezone) return null;
  if (timezone === "Asia/Kolkata" || timezone === "Asia/Calcutta") return "India";
  const city = timezone.split("/").pop()?.replace(/_/g, " ");
  return city ? `${city} time zone` : null;
}

function languageName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code.split("-")[0]) ?? code;
  } catch {
    return code;
  }
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (60 * 24))} d ago`;
}

function pagePath(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname + (parsed.pathname === "/" ? "" : parsed.pathname);
  } catch {
    return url;
  }
}

function VisitorRow({ visitor }: { visitor: WidgetVisitor }) {
  const title = visitor.name ?? visitor.email ?? visitor.phone ?? "Anonymous visitor";
  const isKnown = Boolean(visitor.name || visitor.email || visitor.phone);
  const place = placeFrom(visitor.timezone);
  const referrer = pagePath(visitor.referrer);
  const facts = [
    place,
    [visitor.device && visitor.device.charAt(0).toUpperCase() + visitor.device.slice(1), visitor.browser].filter(Boolean).join(", ") || null,
    languageName(visitor.language),
  ].filter(Boolean);

  return (
    <div className={styles.row}>
      <div className={styles.avatar} data-known={isKnown || undefined} aria-hidden>
        {isKnown ? title.trim().charAt(0).toUpperCase() : "?"}
      </div>
      <div className={styles.main}>
        <div className={styles.title}>
          {title}
          {visitor.lead_label && (
            <Badge variant={visitor.lead_label.includes("hot") ? "danger" : visitor.lead_label === "warm" ? "warning" : "neutral"}>
              {visitor.lead_label.replace("_", " ")} lead
            </Badge>
          )}
          {visitor.needs_callback && <Badge variant="warning">Wants a callback</Badge>}
        </div>
        {(visitor.email || visitor.phone) && (
          <div className={styles.contact}>
            {visitor.email && visitor.email !== title && <a href={`mailto:${visitor.email}`}>{visitor.email}</a>}
            {visitor.phone && visitor.phone !== title && <a href={`tel:${visitor.phone}`}>{visitor.phone}</a>}
          </div>
        )}
        {visitor.last_message && <div className={styles.quote}>“{visitor.last_message}”</div>}
        <div className={styles.facts}>
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
          {visitor.page_url && (
            <span title={visitor.page_url}>On {visitor.page_title || pagePath(visitor.page_url)}</span>
          )}
          {referrer && <span title={visitor.referrer ?? undefined}>Came from {referrer}</span>}
        </div>
      </div>
      <div className={styles.side}>
        <span className={styles.when}>{ago(visitor.last_message_at)}</span>
        <span className={styles.count}>{visitor.messages} message{visitor.messages === 1 ? "" : "s"}</span>
        <Link href="/inbox">
          <Button size="sm" variant="secondary">Open in inbox</Button>
        </Link>
      </div>
    </div>
  );
}

/** Everyone who chatted through the widget, with what is known about each of them. */
export function WidgetVisitors({ agentId }: { agentId: string }) {
  const [knownOnly, setKnownOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading, error, refresh } = useAsync(
    () => widgetApi.visitors(agentId, { knownOnly, search: query || undefined }),
    [agentId, knownOnly, query],
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <div className={styles.stat}><strong>{data?.total ?? "–"}</strong><span>people chatted</span></div>
        <div className={styles.stat}><strong>{data?.identified ?? "–"}</strong><span>left contact details</span></div>
        <p className={styles.note}>
          Name, email and phone come from the contact form or from what a visitor types in the chat. Location is a rough guide
          taken from their device&apos;s time zone, not an address.
        </p>
      </div>

      <form
        className={list.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input aria-label="Search visitors" placeholder="Search by name, email, phone or page" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
        <Button type="button" variant="ghost" onClick={refresh}>Refresh</Button>
        <Switch checked={knownOnly} onChange={setKnownOnly} label="Only with contact details" />
      </form>

      {isLoading ? (
        <Skeleton height={260} />
      ) : !data ? (
        <EmptyState title="Couldn't load visitors" description={error ?? "Please try again."} action={<Button onClick={refresh}>Try again</Button>} />
      ) : !data.visitors.length ? (
        <EmptyState
          title={query || knownOnly ? "Nobody matches" : "No visitors yet"}
          description={
            query || knownOnly
              ? "Try a different search, or turn off the contact-details filter."
              : "As soon as someone chats on your website, they appear here with everything we know about them."
          }
        />
      ) : (
        <div className={styles.list}>
          {data.visitors.map((visitor) => (
            <VisitorRow key={visitor.session_id} visitor={visitor} />
          ))}
        </div>
      )}
    </div>
  );
}
