"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { whatsappStudioApi, type WhatsAppSettings, type WhatsAppStudioOverview } from "@/lib/api/whatsapp-studio";
import { useBusiness } from "@/context/BusinessContext";
import { Skeleton } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { WhatsAppIcon } from "@/components/layout/icons";
import { OfficialConnectPanel } from "../OfficialConnectPanel";
import { ConnectionHealth } from "./ConnectionHealth";
import { WhatsAppSettingsTab } from "./WhatsAppSettingsTab";
import { HomeTab, type RepliesSection, type WhatsAppTab } from "./HomeTab";
import { AutoRepliesTab } from "./AutoRepliesTab";
import { ContactsTab } from "./ContactsTab";
import styles from "../../instagram/workspace/workspace.module.scss";
import local from "./whatsapp.module.scss";

export type { WhatsAppTab } from "./HomeTab";

// The bigger screens, each loaded only when its tab is first opened.
const CampaignsScreen = dynamic(() => import("@/app/(dashboard)/channels/whatsapp-studio/campaigns/page"), { loading: () => <Skeleton height={360} /> });
const TemplatesScreen = dynamic(() => import("@/app/(dashboard)/channels/whatsapp/templates/page"), { loading: () => <Skeleton height={360} /> });
const ShopScreen = dynamic(() => import("@/app/(dashboard)/channels/whatsapp-studio/commerce/page"), { loading: () => <Skeleton height={360} /> });

interface TabInfo {
  value: WhatsAppTab;
  label: string;
  icon: IconName;
  minRole?: "manager";
  /** One line on what the tab is for and when to use it, shown above it. */
  intro?: string;
}

const TABS: TabInfo[] = [
  { value: "home", label: "Home", icon: "overview" },
  { value: "replies", label: "Auto-replies", icon: "bolt", minRole: "manager" },
  { value: "contacts", label: "Contacts", icon: "team" },
  {
    value: "campaigns",
    label: "Campaigns",
    icon: "share",
    minRole: "manager",
    intro: "Message many subscribed contacts at once: an offer, a launch, a reminder. Use a drip sequence to follow up automatically over days.",
  },
  {
    value: "templates",
    label: "Templates",
    icon: "book",
    minRole: "manager",
    intro: "WhatsApp only lets you message someone first (or after 24 hours of silence) with a template Meta has approved. Campaigns use them. Inside 24 hours of their last message, you can reply freely.",
  },
  {
    value: "shop",
    label: "Shop",
    icon: "box",
    intro: "Products customers can order inside WhatsApp, from a clickable menu or a link you send. They pay by UPI; you confirm, pack and ship here.",
  },
  { value: "settings", label: "Settings", icon: "gear" },
];

// Links from before the tabs were reorganised.
const OLD_TABS: Record<string, { tab: WhatsAppTab; section?: RepliesSection }> = {
  overview: { tab: "home" },
  flows: { tab: "replies", section: "menus" },
  forms: { tab: "replies", section: "flows" },
};

const SECTIONS: RepliesSection[] = ["menus", "ai", "hours", "flows"];

interface Props {
  businessId: string;
  agentId?: string;
  whatsappConfigId?: string;
}

export function WhatsAppWorkspace({ businessId, agentId, whatsappConfigId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = useBusiness();
  const requested = searchParams.get("tab") ?? "";
  const legacy = OLD_TABS[requested];
  const tab: WhatsAppTab = legacy?.tab ?? (TABS.some((item) => item.value === requested) ? (requested as WhatsAppTab) : "home");
  const requestedSection = searchParams.get("section") as RepliesSection | null;
  const section: RepliesSection = legacy?.section ?? (requestedSection && SECTIONS.includes(requestedSection) ? requestedSection : "menus");

  const [overview, setOverview] = useState<WhatsAppStudioOverview | null>(null);
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [reload, setReload] = useState(0);
  const refreshAll = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([whatsappStudioApi.overview(businessId).catch(() => null), whatsappStudioApi.settings(businessId).catch(() => null)]).then(([nextOverview, nextSettings]) => {
      if (cancelled) return;
      setOverview(nextOverview);
      setSettings(nextSettings);
      setConnected(Boolean(nextSettings) || Boolean(nextOverview?.readiness.official_connection));
    });
    return () => {
      cancelled = true;
    };
  }, [businessId, reload]);

  const go = useCallback(
    (next: WhatsAppTab, nextSection?: RepliesSection) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "home") params.delete("tab");
      else params.set("tab", next);
      if (next === "replies" && nextSection) params.set("section", nextSection);
      else if (next !== "replies") params.delete("section");
      router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const visibleTabs = useMemo(() => TABS.filter((item) => !item.minRole || can(item.minRole)), [can]);
  const [visited, setVisited] = useState<Set<WhatsAppTab>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));

  if (connected === null) return <Skeleton height={420} />;

  if (!connected) {
    return (
      <div className={styles.workspace}>
        <section className={`${styles.connect} ${local.connect}`}>
          <div className={styles.connectText}>
            <span className={styles.pill}>
              <WhatsAppIcon size={14} /> WhatsApp
            </span>
            <h1>Answer every WhatsApp message, even at midnight.</h1>
            <p>Connect your official WhatsApp Business number. Then reply with menus or AI, take orders, and send campaigns.</p>
          </div>
          <ol className={styles.connectSteps}>
            <li>
              <div>
                <strong>Connect with Meta</strong>
                <span>Log in with Facebook and choose your business number. Takes about two minutes.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Choose who answers</strong>
                <span>A clickable menu, the AI agent, or both. You can always take over a chat yourself.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Share your link</strong>
                <span>Get a chat link and QR code for your website, Instagram and shop counter.</span>
              </div>
            </li>
          </ol>
        </section>
        <div className={styles.card}>
          <ConnectionHealth businessId={businessId} onChanged={refreshAll} />
          <OfficialConnectPanel agentId={agentId} whatsappConfigId={whatsappConfigId} onChanged={refreshAll} />
        </div>
      </div>
    );
  }

  const number = settings?.number;
  const aiOn = Boolean(settings?.ai_enabled && settings?.ai_allowed);
  const tokenExpired = overview?.readiness.connection_status === "reconnect_required";
  const intro = TABS.find((item) => item.value === tab)?.intro;

  return (
    <div className={styles.workspace}>
      <header className={styles.hero}>
        <span className={local.waBadge}>
          <WhatsAppIcon size={34} />
        </span>
        <div className={styles.identity}>
          <h1 className={styles.handle}>{number?.verified_name || "WhatsApp"}</h1>
          {number?.phone_number && <span className={styles.displayName}>{number.phone_number}</span>}
          <div className={styles.pills}>
            <span className={`${styles.pill} ${tokenExpired ? styles.pillWarn : styles.pillOn}`}>
              <i aria-hidden /> {tokenExpired ? "Reconnect needed" : "Connected"}
            </span>
            {number?.quality_rating && (
              <span className={`${styles.pill} ${number.quality_rating === "GREEN" ? styles.pillOn : styles.pillWarn}`} title="Meta's rating of how customers react to your messages. Blocks and reports lower it.">
                <i aria-hidden /> Quality {number.quality_rating === "GREEN" ? "good" : number.quality_rating === "YELLOW" ? "medium" : number.quality_rating.toLowerCase() === "red" ? "low" : number.quality_rating.toLowerCase()}
              </span>
            )}
            {settings && (
              <button type="button" className={`${styles.pill} ${styles.pillButton} ${!settings.ai_allowed ? styles.pillWarn : aiOn ? styles.pillOn : styles.pillOff}`} onClick={() => go("replies", "ai")}>
                <i aria-hidden /> {!settings.ai_allowed ? "AI not in plan" : aiOn ? "AI agent on" : "AI agent off"}
              </button>
            )}
          </div>
        </div>
        {can("manager") && (
          <div className={styles.heroActions}>
            <button type="button" className={`${styles.primaryCta} ${local.waCta}`} onClick={() => go("campaigns")}>
              <span className={styles.ctaPlus} aria-hidden>
                <Icon name="plus" size={16} style={{ strokeWidth: 2.4 }} />
              </span>
              New campaign
            </button>
          </div>
        )}
      </header>

      {tokenExpired && (
        <div className={`${styles.notice} ${styles.noticeWarn} ${local.expired}`} role="alert">
          <span>Your WhatsApp login has expired, so messages can&apos;t be sent or received. Reconnect to fix it; your number, contacts and settings stay as they are.</span>
          {can("admin") && (
            <button type="button" className={local.linkButton} onClick={() => go("settings")}>
              Reconnect
            </button>
          )}
        </div>
      )}

      <div className={styles.tabsArea}>
        <nav className={styles.tabs} aria-label="WhatsApp sections">
          {visibleTabs.map((item) => (
            <button key={item.value} type="button" className={tab === item.value ? styles.tabActive : styles.tab} aria-current={tab === item.value ? "page" : undefined} onClick={() => go(item.value)}>
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </nav>

        {intro && <p className={local.tabIntro}>{intro}</p>}

        <Pane value="home" tab={tab} visited={visited}>
          <HomeTab businessId={businessId} agentId={agentId} overview={overview} settings={settings} onGo={go} />
        </Pane>
        <Pane value="replies" tab={tab} visited={visited}>
          <AutoRepliesTab
            businessId={businessId}
            agentId={agentId}
            section={section}
            onSection={(next) => go("replies", next)}
            settings={settings}
            onSettings={setSettings}
            canAdmin={can("admin")}
            canManage={can("manager")}
          />
        </Pane>
        <Pane value="contacts" tab={tab} visited={visited}>
          <ContactsTab businessId={businessId} canManage={can("manager")} />
        </Pane>
        <Pane value="campaigns" tab={tab} visited={visited} embedded>
          <CampaignsScreen />
        </Pane>
        <Pane value="templates" tab={tab} visited={visited} embedded>
          <TemplatesScreen />
        </Pane>
        <Pane value="shop" tab={tab} visited={visited} embedded>
          <ShopScreen />
        </Pane>
        <Pane value="settings" tab={tab} visited={visited}>
          {settings ? (
            <WhatsAppSettingsTab businessId={businessId} agentId={agentId} settings={settings} canAdmin={can("admin")} onChanged={setSettings} whatsappConfigId={whatsappConfigId} tokenExpired={tokenExpired} onConnectionChanged={refreshAll} />
          ) : (
            <p className={styles.muted}>Settings couldn&apos;t be loaded. Reconnect your number and try again.</p>
          )}
        </Pane>
      </div>
    </div>
  );
}

function Pane({ value, tab, visited, embedded, children }: { value: WhatsAppTab; tab: WhatsAppTab; visited: Set<WhatsAppTab>; embedded?: boolean; children: React.ReactNode }) {
  if (!visited.has(value) && value !== tab) return null;
  return (
    <div className={`${styles.tabPane} ${embedded ? local.embedded : ""}`} hidden={value !== tab}>
      {children}
    </div>
  );
}
