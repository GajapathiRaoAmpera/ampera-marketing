"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { connectedAppsApi, type ConnectedAppSummary, type ConnectedAppsResponse } from "@/lib/api/integrations";
import { formatRelativeTime } from "@/lib/utils/date";
import styles from "@/app/(dashboard)/connected-apps/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

// ── What each app does for a business, in plain words ──────────────────────────────────────────
// Written for an owner, not a developer: what you get, what you need, how long it takes.

type Goal = "leads" | "products" | "orders" | "chat";
type Group = "chat" | "stores" | "marketplaces";

interface AppInfo {
  name: string;
  color: string;
  group: Group;
  tagline: string;
  benefits: string[];
  needs: string;
  goals: Goal[];
  href: string;
}

const APPS: Record<string, AppInfo> = {
  whatsapp: {
    name: "WhatsApp", color: "#25d366", group: "chat", href: "/channels/whatsapp", goals: ["chat", "orders"],
    tagline: "Your AI answers customers on WhatsApp, day and night.",
    benefits: ["Instant replies to every enquiry", "Catalog, orders and payments in chat", "Broadcasts to your contacts"],
    needs: "A WhatsApp Business number · about 5 min",
  },
  instagram: {
    name: "Instagram", color: "#e1306c", group: "chat", href: "/channels/instagram", goals: ["chat", "leads"],
    tagline: "Replies to DMs and turns comments into conversations.",
    benefits: ["Auto-DM people who comment a keyword", "AI answers questions in DMs", "Schedule and publish posts"],
    needs: "An Instagram professional account · about 2 min",
  },
  messenger: {
    name: "Messenger", color: "#0084ff", group: "chat", href: "/channels/messenger", goals: ["chat"],
    tagline: "Answers messages sent to your Facebook Page.",
    benefits: ["Instant replies on your Page", "Menus and quick buttons", "Hands over to you when needed"],
    needs: "A Facebook Page you manage · about 2 min",
  },
  telegram: {
    name: "Telegram", color: "#229ed9", group: "chat", href: "/channels/telegram", goals: ["chat"],
    tagline: "Runs your Telegram bot with your AI behind it.",
    benefits: ["Answers in your bot", "Welcome message and menu"], needs: "A bot token from @BotFather · about 3 min",
  },
  sms: {
    name: "SMS", color: "#7c5cff", group: "chat", href: "/channels/sms", goals: ["chat"],
    tagline: "Answers text messages sent to your number.",
    benefits: ["Reaches customers without apps", "Same AI, plain text"], needs: "A Twilio account and number · about 10 min",
  },
  twitter: {
    name: "X (Twitter)", color: "#111111", group: "chat", href: "/channels/twitter", goals: ["chat"],
    tagline: "Answers direct messages on X.",
    benefits: ["AI replies to DMs"], needs: "An X account · about 2 min",
  },
  discord: {
    name: "Discord", color: "#5865f2", group: "chat", href: "/channels/discord", goals: ["chat"],
    tagline: "Adds your AI to your Discord server.",
    benefits: ["Answers questions in your server"], needs: "A Discord bot · about 5 min",
  },
  widget: {
    name: "Website chat", color: "#0f9d8a", group: "chat", href: "/channels/widget", goals: ["chat", "leads"],
    tagline: "A chat bubble on your website, answered by your AI.",
    benefits: ["Captures visitors' details as leads", "Answers from your own knowledge"], needs: "Paste one line into your website · about 2 min",
  },
  indiamart: {
    name: "IndiaMART", color: "#2e3192", group: "stores", href: "/connected-apps/indiamart", goals: ["leads", "products"],
    tagline: "Every buyer enquiry lands here automatically.",
    benefits: ["New leads pulled in every few minutes", "Leads scored so you call the best first", "Your storefront products taught to your AI"],
    needs: "Your IndiaMART CRM key (Lead Manager → Import/Export Leads) · about 2 min",
  },
  shopify: {
    name: "Shopify", color: "#5e8e3e", group: "stores", href: "/products", goals: ["products", "orders"],
    tagline: "Your AI knows your products and live orders.",
    benefits: ["Answers price and stock questions", "Tells customers where their order is", "Products stay in sync"],
    needs: "Your Shopify store · about 3 min",
  },
  woocommerce: {
    name: "WooCommerce", color: "#7f54b3", group: "stores", href: "/connected-apps/woocommerce", goals: ["products", "orders"],
    tagline: "Your AI knows your WordPress shop's products and orders.",
    benefits: ["Answers price and stock questions", "Order status on request", "Products stay in sync"],
    needs: "A WooCommerce API key and secret · about 5 min",
  },
  custom_store: {
    name: "Your own website", color: "#0f766e", group: "stores", href: "/connected-apps/custom-store", goals: ["products"],
    tagline: "Teach your AI the products from any website or sheet.",
    benefits: ["Works with any shop that has a product feed", "Refresh whenever prices change"],
    needs: "A product feed or sheet link · about 2 min",
  },
  flipkart: {
    name: "Flipkart", color: "#2874f0", group: "marketplaces", href: "/connected-apps/flipkart", goals: ["products", "orders"],
    tagline: "Your Flipkart catalog and orders, answered by your AI.",
    benefits: ["Customers can ask where their order is", "Your Flipkart products taught to your AI"],
    needs: "A Flipkart API key: Seller Dashboard → Manage Profile → Developer Access · about 5 min",
  },
  amazon: {
    name: "Amazon", color: "#ff9900", group: "marketplaces", href: "/connected-apps/amazon", goals: ["products", "orders"],
    tagline: "Your Amazon catalog and orders, answered by your AI.",
    benefits: ["Customers can ask where their order is", "Your Amazon products taught to your AI"],
    needs: "An Amazon Professional seller account · sign in with Amazon",
  },
  meesho: {
    name: "Meesho", color: "#9f2089", group: "marketplaces", href: "/connected-apps/meesho", goals: ["products"],
    tagline: "Your Meesho catalog taught to your AI.",
    benefits: ["Answers questions about your Meesho products"],
    needs: "API access approved by Meesho (request it from Meesho's integration team)",
  },
  myntra: {
    name: "Myntra", color: "#ff3f6c", group: "marketplaces", href: "/connected-apps/myntra", goals: ["products"],
    tagline: "Your Myntra catalog taught to your AI.",
    benefits: ["Answers questions about your Myntra styles"],
    needs: "Myntra Partner Portal access, approved by Myntra",
  },
};

// Stores first: people arrive here from "Stores & apps"; channels also have their own sidebar entries.
const GROUPS: { key: Group; title: string; blurb: string }[] = [
  { key: "stores", title: "Your shop and lead sources", blurb: "Bring in leads and teach your AI your real products and orders." },
  { key: "marketplaces", title: "Marketplaces", blurb: "Let your AI answer questions about what you sell on marketplaces." },
  { key: "chat", title: "Where customers talk to you", blurb: "Connect a channel and your AI answers there." },
];

const FILTERS: { key: "all" | Goal | "connected"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "leads", label: "Get more leads" },
  { key: "products", label: "Answer product questions" },
  { key: "orders", label: "Track orders" },
  { key: "chat", label: "Talk to customers" },
  { key: "connected", label: "Connected" },
];

// ── Status: one honest answer per card ──────────────────────────────────────────────────────────

interface Status {
  label: string;
  variant: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  cta: string | null;
  note?: string;
}

function statusOf(key: string, app: ConnectedAppSummary): Status {
  if (app.stats?.problem) return { label: "Needs attention", variant: "danger", cta: "Fix it", note: app.stats.problem };
  if (app.coming_soon) {
    return { label: "Not available yet", variant: "neutral", cta: null, note: "Sign-in with this app isn't switched on for this platform yet." };
  }
  if (key === "amazon" && app.available === false && !app.connected) {
    return { label: "Not available yet", variant: "neutral", cta: null, note: "Amazon must first approve a developer app for this platform." };
  }
  if (app.connected) {
    const note = key === "shopify" && app.order_updates_ready === false
      ? "Order status updates from Shopify are switched off on the server, so order answers may be out of date."
      : undefined;
    return { label: "Connected", variant: "success", cta: "Manage", note };
  }
  if (key === "meesho" || key === "myntra") {
    return { label: "Needs approval", variant: "warning", cta: "See how to get access" };
  }
  return { label: "Not connected", variant: "neutral", cta: "Connect" };
}

function statsLine(app: ConnectedAppSummary): string[] {
  const s = app.stats;
  const parts: string[] = [];
  if (typeof app.session_count === "number" && app.session_count > 0) parts.push(`${app.session_count} website chat${app.session_count === 1 ? "" : "s"}`);
  if (!s) return parts;
  if (typeof s.leads_7d === "number") parts.push(`${s.leads_7d} lead${s.leads_7d === 1 ? "" : "s"} this week`);
  if (typeof s.products === "number" && s.products > 0) parts.push(`${s.products.toLocaleString()} product${s.products === 1 ? "" : "s"}`);
  if (s.last_sync_at) parts.push(`updated ${formatRelativeTime(s.last_sync_at)}`);
  else if (typeof s.products === "number" && s.products === 0 && typeof s.leads_7d !== "number") parts.push("not synced yet");
  return parts;
}

// ── Screen ──────────────────────────────────────────────────────────────────────────────────────

export default function ConnectedAppsPage() {
  const embedded = useEmbedded();
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();
  const [data, setData] = useState<ConnectedAppsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const load = useCallback(async (id: string) => {
    try {
      setData(await connectedAppsApi.get(id));
    } catch {
      show("Couldn't load your connected apps.", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    if (!businessId) return;
    const timer = window.setTimeout(() => void load(businessId), 0);
    return () => window.clearTimeout(timer);
  }, [businessId, load]);

  const visible = useMemo(() => {
    if (!data) return [] as string[];
    return Object.keys(APPS).filter((key) => {
      const app = data.apps[key];
      if (!app) return false;
      if (filter === "all") return true;
      if (filter === "connected") return app.connected;
      return APPS[key].goals.includes(filter);
    });
  }, [data, filter]);

  if (businessLoading || (loading && businessId)) return <Skeleton height={420} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before connecting any apps." />;
  }
  if (!data) return <EmptyState title="Couldn't load connected apps" description="Try refreshing the page." />;

  const known = Object.keys(APPS).filter((key) => data.apps[key]);
  const connectedCount = known.filter((key) => data.apps[key].connected).length;
  const attention = known.filter((key) => data.apps[key].stats?.problem).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {!embedded && (
          <>
            <h1>Stores &amp; apps</h1>
            <p className={styles.intro}>
              Connect where your customers talk to you and where you sell. Each connection makes your AI more useful:
              more leads, real product answers, and order updates without you lifting a finger.
            </p>
          </>
        )}
        <div className={styles.summary}>
          <Badge variant={connectedCount > 0 ? "success" : "neutral"}>{connectedCount} of {known.length} connected</Badge>
          {attention > 0 && <Badge variant="danger">{attention} need{attention === 1 ? "s" : ""} attention</Badge>}
        </div>
      </header>

      <div className={styles.filters} role="toolbar" aria-label="Show apps that help me">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={styles.filter}
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            {item.key === "connected" && <span className={styles.filterCount}>{connectedCount}</span>}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <EmptyState
          title={filter === "connected" ? "Nothing connected yet" : "Nothing here"}
          description={filter === "connected" ? "Pick something from Everything to get started." : "Try another filter."}
        />
      )}

      {GROUPS.map((group) => {
        const keys = visible.filter((key) => APPS[key].group === group.key);
        if (keys.length === 0) return null;
        return (
          <section key={group.key} className={styles.group} aria-labelledby={`apps-${group.key}`}>
            <div className={styles.groupHeading}>
              <h2 id={`apps-${group.key}`}>{group.title}</h2>
              <span>{group.blurb}</span>
            </div>
            <div className={styles.grid}>
              {keys.map((key) => (
                <AppCard key={key} appKey={key} app={data.apps[key]} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AppCard({ appKey, app }: { appKey: string; app: ConnectedAppSummary }) {
  const info = APPS[appKey];
  const status = statusOf(appKey, app);
  const stats = app.connected ? statsLine(app) : [];
  return (
    <article className={styles.card} data-connected={app.connected || undefined} style={{ ["--app-color" as string]: info.color }}>
      <div className={styles.cardTop}>
        <span className={styles.logo} aria-hidden="true">{info.name.charAt(0)}</span>
        <div className={styles.cardTitle}>
          <h3>{info.name}</h3>
          {app.name && <span className={styles.cardName} title={app.name}>{app.name}</span>}
          <span className={styles.status}><Badge variant={status.variant}>{status.label}</Badge></span>
        </div>
      </div>

      <p className={styles.tagline}>{info.tagline}</p>

      {stats.length > 0 ? (
        <p className={styles.stats}>{stats.join(" · ")}</p>
      ) : (
        <ul className={styles.benefits}>
          {info.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
        </ul>
      )}

      {status.note && <p className={styles.note} data-tone={status.variant}>{status.note}</p>}

      {!app.connected && <p className={styles.needs}><strong>You need:</strong> {info.needs}</p>}

      {app.active_trigger_rules > 0 && (
        <p className={styles.meta}>{app.active_trigger_rules} automation{app.active_trigger_rules === 1 ? "" : "s"} use this</p>
      )}

      <div className={styles.cardFooter}>
        {status.cta ? (
          <a className={styles.cta} data-primary={!app.connected || undefined} href={info.href}>
            {status.cta}
            <span aria-hidden="true">→</span>
          </a>
        ) : (
          <span className={styles.ctaDisabled} aria-disabled="true">Not available yet</span>
        )}
      </div>
    </article>
  );
}
