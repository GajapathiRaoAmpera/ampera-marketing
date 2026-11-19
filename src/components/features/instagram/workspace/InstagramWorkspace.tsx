"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  instagramAutomationsApi,
  type InstagramAutomation,
  type InstagramConnection,
  type InstagramExecution,
  type InstagramMedia,
  type InstagramProfile,
} from "@/lib/api";
import { useBusiness } from "@/context/BusinessContext";
import { useEntitlements } from "@/context/EntitlementsContext";
import { useToast } from "@/context/ToastContext";
import { Skeleton } from "@/components/ui";
import { AutomationBuilder } from "./AutomationBuilder";
import { AutomationsTab } from "./AutomationsTab";
import { ActivityTab } from "./ActivityTab";
import { ConnectScreen } from "./ConnectScreen";
import { OverviewTab } from "./OverviewTab";
import { PostsTab } from "./PostsTab";
import { SettingsTab } from "./SettingsTab";
import { Icon, type IconName } from "./icons";
import { apiErrorMessage, compactNumber } from "./media";
import styles from "./workspace.module.scss";

// Heavy, rarely-opened tabs load only when they are first opened.
const PublishPanel = dynamic(() => import("../InstagramPublishPanel").then((mod) => mod.InstagramPublishPanel), {
  loading: () => <Skeleton height={360} />,
});
const InsightsPanel = dynamic(() => import("../InstagramInsightsPanel").then((mod) => mod.InstagramInsightsPanel), {
  loading: () => <Skeleton height={360} />,
});

export type WorkspaceTab = "overview" | "automations" | "posts" | "activity" | "publish" | "insights" | "settings";

const TABS: Array<{ value: WorkspaceTab; label: string; icon: IconName; minRole?: "manager" }> = [
  { value: "overview", label: "Overview", icon: "overview" },
  { value: "automations", label: "Automations", icon: "bolt" },
  { value: "posts", label: "Posts", icon: "posts" },
  { value: "activity", label: "Activity", icon: "pulse" },
  { value: "publish", label: "Publish", icon: "pen", minRole: "manager" },
  { value: "insights", label: "Insights", icon: "chart" },
  { value: "settings", label: "Settings", icon: "gear" },
];

type BuilderState = { editing: InstagramAutomation | null; preset: InstagramMedia | null } | null;

interface InstagramWorkspaceProps {
  businessId: string;
  agentId?: string;
}

export function InstagramWorkspace({ businessId, agentId }: InstagramWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = useBusiness();
  const { show } = useToast();
  const { isEnabled } = useEntitlements();

  const requestedTab = searchParams.get("tab") as WorkspaceTab | null;
  const tab: WorkspaceTab = TABS.some((item) => item.value === requestedTab) ? (requestedTab as WorkspaceTab) : "overview";

  const [connections, setConnections] = useState<InstagramConnection[] | null>(null);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [profile, setProfile] = useState<InstagramProfile | null>(null);
  const [automations, setAutomations] = useState<InstagramAutomation[] | null>(null);
  const [executions, setExecutions] = useState<InstagramExecution[]>([]);
  // ?new=1 opens the builder straight away (links from elsewhere in the app).
  const [builder, setBuilder] = useState<BuilderState>(() => (searchParams.get("new") === "1" ? { editing: null, preset: null } : null));
  const [reload, setReload] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const automationsIncluded = isEnabled("instagram_automations_enabled");
  const canBuild = can("manager") && automationsIncluded;
  const canAdmin = can("admin");
  const connection = connections?.find((item) => item.id === chosenId) ?? connections?.[0] ?? null;
  const connectionId = connection?.id ?? null;

  // ── Data ──

  useEffect(() => {
    let cancelled = false;
    instagramAutomationsApi
      .connections(businessId)
      .then((list) => !cancelled && setConnections(list))
      .catch((error) => !cancelled && setConnectionsError(apiErrorMessage(error, "Couldn't load your Instagram connection.")));
    return () => {
      cancelled = true;
    };
  }, [businessId, reload]);

  useEffect(() => {
    if (!connectionId) return;
    let cancelled = false;
    instagramAutomationsApi
      .profile(businessId, connectionId)
      .then((result) => !cancelled && setProfile(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId, connectionId]);

  const loadAutomations = useCallback(() => {
    if (!connectionId) return;
    instagramAutomationsApi
      .list(businessId, connectionId)
      .then(setAutomations)
      .catch((error) => {
        setAutomations((current) => current ?? []);
        show(apiErrorMessage(error, "Couldn't load your automations."), "error");
      });
  }, [businessId, connectionId, show]);

  useEffect(() => {
    if (!connectionId) return;
    let cancelled = false;
    instagramAutomationsApi
      .list(businessId, connectionId)
      .then((list) => !cancelled && setAutomations(list))
      .catch(() => !cancelled && setAutomations([]));
    return () => {
      cancelled = true;
    };
  }, [businessId, connectionId]);

  // Activity: polled only while the browser tab is visible and the
  // activity is on screen, so an idle page costs nothing.
  const wantsActivity = tab === "overview";
  useEffect(() => {
    if (!connectionId || !wantsActivity || builder) return;
    let cancelled = false;
    const fetchActivity = () => {
      if (document.visibilityState !== "visible") return;
      instagramAutomationsApi
        .executions(businessId, undefined, { limit: 300, connectionId })
        .then((result) => {
          if (cancelled) return;
          setExecutions((result.executions || []).filter((item) => !item.connection_id || item.connection_id === connectionId));
        })
        .catch(() => undefined);
    };
    fetchActivity();
    const timer = window.setInterval(fetchActivity, 20000);
    document.addEventListener("visibilitychange", fetchActivity);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", fetchActivity);
    };
  }, [businessId, connectionId, wantsActivity, tab, builder]);

  // ── Navigation ──

  const goTab = useCallback(
    (next: WorkspaceTab) => {
      setBuilder(null);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("tab");
      else params.set("tab", next);
      params.delete("status");
      params.delete("username");
      params.delete("new");
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function openBuilder(state: NonNullable<BuilderState>) {
    if (!canBuild) return;
    setBuilder(state);
    window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const visibleTabs = useMemo(() => TABS.filter((item) => !item.minRole || can(item.minRole)), [can]);

  // Tabs opened so far (kept mounted). Updated while rendering, which React
  // allows for state derived from props: no extra effect pass, no flicker.
  const [visited, setVisited] = useState<Set<WorkspaceTab>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));

  // Load the heavier tabs' code ahead of time so they open instantly.
  const preload = useCallback((value: WorkspaceTab) => {
    if (value === "publish") void import("../InstagramPublishPanel");
    if (value === "insights") void import("../InstagramInsightsPanel");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      preload("insights");
      preload("publish");
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [preload]);
  const liveCount = automations?.filter((item) => item.status === "active").length ?? 0;

  // ── Render ──

  if (connectionsError && !connections) {
    return (
      <div className={styles.empty}>
        <h3>Instagram couldn&apos;t be loaded</h3>
        <p>{connectionsError}</p>
      </div>
    );
  }
  if (!connections) return <Skeleton height={420} />;
  if (!connection || !connectionId) {
    return <ConnectScreen businessId={businessId} agentId={agentId} onConnected={() => setReload((value) => value + 1)} />;
  }

  const username = profile?.username || connection.instagram_username;
  const avatarUrl = profile?.profile_picture_url ?? connection.profile_picture_url ?? null;
  const aiAvailable = Boolean(profile?.ai_allowed && profile?.ai_enabled);
  const aiLabel = !profile ? null : !profile.ai_allowed ? "AI not in plan" : profile.ai_enabled ? "AI agent ON" : "AI agent OFF";

  return (
    <div className={styles.workspace} ref={topRef}>
      <header className={styles.hero}>
        <span className={styles.avatarRing}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={`@${username}`} />
          ) : (
            <span className={styles.avatarFallback}>{username.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
        <div className={styles.identity}>
          <div className={styles.handleRow}>
            <h1 className={styles.handle}>@{username}</h1>
          </div>
          {profile?.profile_name && <span className={styles.displayName}>{profile.profile_name}</span>}
          <div className={styles.counts}>
            {profile?.media_count != null && (
              <span>
                <strong>{compactNumber(profile.media_count)}</strong> posts
              </span>
            )}
            {profile?.followers_count != null && (
              <span>
                <strong>{compactNumber(profile.followers_count)}</strong> followers
              </span>
            )}
            {profile?.follows_count != null && (
              <span>
                <strong>{compactNumber(profile.follows_count)}</strong> following
              </span>
            )}
          </div>
          <div className={styles.pills}>
            <span className={`${styles.pill} ${styles.pillOn}`}>
              <i aria-hidden /> Connected
            </span>
            <span className={`${styles.pill} ${liveCount ? styles.pillOn : styles.pillOff}`}>
              <i aria-hidden /> {liveCount} {liveCount === 1 ? "automation" : "automations"} live
            </span>
            {aiLabel && (
              <button
                type="button"
                className={`${styles.pill} ${styles.pillButton} ${!profile?.ai_allowed ? styles.pillWarn : profile?.ai_enabled ? styles.pillOn : styles.pillOff}`}
                onClick={() => goTab("settings")}
                title="AI agent settings"
              >
                <i aria-hidden /> {aiLabel}
              </button>
            )}
          </div>
        </div>
        <div className={styles.heroActions}>
          {connections.length > 1 && (
            <select
              className={styles.accountSwitch}
              aria-label="Instagram account"
              value={connectionId}
              onChange={(event) => {
                setChosenId(event.target.value);
                setProfile(null);
                setAutomations(null);
                setExecutions([]);
                setBuilder(null);
              }}
            >
              {connections.map((item) => (
                <option key={item.id} value={item.id}>
                  @{item.instagram_username}
                </option>
              ))}
            </select>
          )}
          {canBuild && !builder && (
            <button type="button" className={styles.primaryCta} onClick={() => openBuilder({ editing: null, preset: null })}>
              <span className={styles.ctaPlus} aria-hidden>
                <Icon name="plus" size={16} style={{ strokeWidth: 2.4 }} />
              </span>
              New automation
            </button>
          )}
        </div>
      </header>

      {!automationsIncluded && (
        <div className={`${styles.notice} ${styles.noticeWarn}`} role="status">
          Instagram automations aren&apos;t included in your plan right now, so new automations can&apos;t be created. Contact support to turn
          them on.
        </div>
      )}

      {builder && canBuild && (
        <AutomationBuilder
          key={builder.editing?.id ?? builder.preset?.id ?? "new"}
          businessId={businessId}
          connectionId={connectionId}
          username={username}
          avatarUrl={avatarUrl}
          aiAvailable={aiAvailable}
          editing={builder.editing}
          presetMedia={builder.preset}
          onClose={() => setBuilder(null)}
          onSaved={() => {
            setBuilder(null);
            loadAutomations();
            goTab("automations");
          }}
          onOpenSettings={() => goTab("settings")}
        />
      )}

      {/* The tabs stay mounted (just hidden) while the builder is open and once
          visited, so switching is instant: no refetch, no skeleton flash. */}
      <div className={styles.tabsArea} hidden={Boolean(builder && canBuild)}>
        <nav className={styles.tabs} aria-label="Instagram sections">
          {visibleTabs.map((item) => (
            <button
              key={item.value}
              type="button"
              className={tab === item.value ? styles.tabActive : styles.tab}
              aria-current={tab === item.value ? "page" : undefined}
              onClick={() => goTab(item.value)}
              onMouseEnter={() => preload(item.value)}
              onFocus={() => preload(item.value)}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
              {item.value === "automations" && automations && automations.length > 0 && <span className={styles.tabCount}>{automations.length}</span>}
            </button>
          ))}
        </nav>

        {automations === null && ["overview", "automations", "posts", "activity"].includes(tab) ? (
          <Skeleton height={320} />
        ) : (
          <>
            <TabPane value="overview" tab={tab} visited={visited}>
              <OverviewTab
                businessId={businessId}
                connectionId={connectionId}
                automations={automations ?? []}
                executions={executions}
                canBuild={canBuild}
                onNew={() => openBuilder({ editing: null, preset: null })}
                onGo={goTab}
              />
            </TabPane>
            <TabPane value="automations" tab={tab} visited={visited}>
              <AutomationsTab
                businessId={businessId}
                automations={automations ?? []}
                canBuild={canBuild}
                onNew={() => openBuilder({ editing: null, preset: null })}
                onEdit={(item) => openBuilder({ editing: item, preset: null })}
                onChanged={loadAutomations}
              />
            </TabPane>
            <TabPane value="posts" tab={tab} visited={visited}>
              <PostsTab
                businessId={businessId}
                connectionId={connectionId}
                username={username}
                avatarUrl={avatarUrl}
                automations={automations ?? []}
                canBuild={canBuild}
                onAutomate={(item) => openBuilder({ editing: null, preset: item })}
                onEdit={(item) => openBuilder({ editing: item, preset: null })}
              />
            </TabPane>
            <TabPane value="activity" tab={tab} visited={visited}>
              <ActivityTab businessId={businessId} connectionId={connectionId} automations={automations ?? []} active={tab === "activity" && !builder} />
            </TabPane>
            <TabPane value="publish" tab={tab} visited={visited}>
              <PublishPanel businessId={businessId} />
            </TabPane>
            <TabPane value="insights" tab={tab} visited={visited}>
              <InsightsPanel businessId={businessId} />
            </TabPane>
            <TabPane value="settings" tab={tab} visited={visited}>
              <SettingsTab
                businessId={businessId}
                connectionId={connectionId}
                profile={profile}
                canAdmin={canAdmin}
                canManage={canBuild}
                onAiChanged={(enabled) => setProfile((current) => (current ? { ...current, ai_enabled: enabled } : current))}
                onDisconnected={() => {
                  setChosenId(null);
                  setProfile(null);
                  setAutomations(null);
                  setConnections(null);
                  goTab("overview");
                  setReload((value) => value + 1);
                }}
              />
            </TabPane>
          </>
        )}
      </div>
    </div>
  );
}

/** A tab's content: mounted the first time it is opened, then kept (hidden)
 * so coming back to it is instant and it keeps its scroll, filters and data. */
function TabPane({ value, tab, visited, children }: { value: WorkspaceTab; tab: WorkspaceTab; visited: Set<WorkspaceTab>; children: React.ReactNode }) {
  if (!visited.has(value) && value !== tab) return null;
  return (
    <div className={styles.tabPane} hidden={value !== tab}>
      {children}
    </div>
  );
}
