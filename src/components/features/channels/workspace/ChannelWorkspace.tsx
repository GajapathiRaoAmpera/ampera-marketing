"use client";

import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import type { BusinessRole } from "@/types/api";
import { Skeleton } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { EmbeddedProvider } from "@/components/layout/Embedded";
import styles from "../../instagram/workspace/workspace.module.scss";
import local from "./channelWorkspace.module.scss";

export interface WorkspaceTab {
  value: string;
  label: string;
  icon: IconName;
  /** Lowest team role that sees this tab. */
  minRole?: BusinessRole;
  /** One line on what the tab is for and when to use it, shown above it. */
  intro?: string;
  render: () => ReactNode;
}

export interface WorkspacePill {
  label: string;
  tone: "on" | "off" | "warn";
  title?: string;
  /** Opens this tab when the pill is clicked. */
  goTo?: string;
}

export interface ConnectLanding {
  headline: string;
  text: string;
  steps: { title: string; text: string }[];
  /** The form or button that actually connects. */
  panel: ReactNode;
}

interface Props {
  /** Brand colour; tints the badge, the call-to-action and the intro lines. */
  color: string;
  icon: ReactNode;
  name: string;
  /** Who the channel is connected as (a handle, number or server name). */
  identity?: string;
  subtitle?: string;
  pills?: WorkspacePill[];
  /** The main thing to do on this channel, top right. */
  action?: { label: string; goTo?: string; onClick?: () => void };
  /** A warning shown above the tabs, e.g. an expired login. */
  alert?: ReactNode;
  /** Sits above the tabs, e.g. a picker for which Page or server the tabs are about. */
  toolbar?: ReactNode;
  /** null while loading. */
  connected: boolean | null;
  landing: ConnectLanding;
  tabs: WorkspaceTab[];
  /** Old ?tab= values mapped to current tabs, so saved links keep working. */
  legacyTabs?: Record<string, string>;
}

/**
 * The shape every channel page shares: a header saying who you are connected as and whether
 * it is healthy, a few task-named tabs (each with a line on what it is for), and, before
 * connecting, a plain three-step landing instead of a bare form. The tab lives in ?tab=, so
 * it survives a refresh and can be linked to.
 */
export function ChannelWorkspace({ color, icon, name, identity, subtitle, pills = [], action, alert, toolbar, connected, landing, tabs, legacyTabs = {} }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = useBusiness();

  const visibleTabs = useMemo(() => tabs.filter((item) => !item.minRole || can(item.minRole)), [tabs, can]);
  const first = visibleTabs[0]?.value ?? "";
  const requested = searchParams.get("tab") ?? "";
  const mapped = legacyTabs[requested] ?? requested;
  const tab = visibleTabs.some((item) => item.value === mapped) ? mapped : first;

  const go = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === first) params.delete("tab");
      else params.set("tab", next);
      router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`, { scroll: false });
    },
    [first, pathname, router, searchParams]
  );

  // A tab's contents are built when it is first opened and kept, so switching back is instant
  // and nothing the person typed is lost.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([tab]));
  if (tab && !visited.has(tab)) setVisited(new Set(visited).add(tab));

  const brand = { "--channel-color": color } as CSSProperties;

  if (connected === null) return <Skeleton height={420} />;

  if (!connected) {
    return (
      <div className={styles.workspace} style={brand}>
        <section className={`${styles.connect} ${local.connect}`}>
          <div className={styles.connectText}>
            <span className={styles.pill}>
              {icon} {name}
            </span>
            <h1>{landing.headline}</h1>
            <p>{landing.text}</p>
          </div>
          <ol className={styles.connectSteps}>
            {landing.steps.map((step) => (
              <li key={step.title}>
                <div>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className={styles.card}>{landing.panel}</div>
      </div>
    );
  }

  const intro = visibleTabs.find((item) => item.value === tab)?.intro;

  return (
    <div className={styles.workspace} style={brand}>
      <header className={`${styles.hero} ${local.heroTint}`}>
        <span className={local.badge}>{icon}</span>
        <div className={styles.identity}>
          <h1 className={styles.handle}>{identity || name}</h1>
          {subtitle && <span className={styles.displayName}>{subtitle}</span>}
          {pills.length > 0 && (
            <div className={styles.pills}>
              {pills.map((pill) => {
                const tone = pill.tone === "on" ? styles.pillOn : pill.tone === "warn" ? styles.pillWarn : styles.pillOff;
                return pill.goTo ? (
                  <button key={pill.label} type="button" title={pill.title} className={`${styles.pill} ${styles.pillButton} ${tone}`} onClick={() => go(pill.goTo!)}>
                    <i aria-hidden /> {pill.label}
                  </button>
                ) : (
                  <span key={pill.label} title={pill.title} className={`${styles.pill} ${tone}`}>
                    <i aria-hidden /> {pill.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {action && can("manager") && (
          <div className={styles.heroActions}>
            <button type="button" className={`${styles.primaryCta} ${local.cta}`} onClick={() => (action.onClick ? action.onClick() : action.goTo && go(action.goTo))}>
              <span className={styles.ctaPlus} aria-hidden>
                <Icon name="plus" size={16} style={{ strokeWidth: 2.4 }} />
              </span>
              {action.label}
            </button>
          </div>
        )}
      </header>

      {alert && (
        <div className={`${styles.notice} ${styles.noticeWarn}`} role="alert">
          {alert}
        </div>
      )}

      <div className={styles.tabsArea}>
        {toolbar}
        {visibleTabs.length > 1 && (
          <nav className={styles.tabs} aria-label={`${name} sections`}>
            {visibleTabs.map((item) => (
              <button key={item.value} type="button" className={tab === item.value ? styles.tabActive : styles.tab} aria-current={tab === item.value ? "page" : undefined} onClick={() => go(item.value)}>
                <Icon name={item.icon} size={17} />
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {intro && <p className={local.tabIntro}>{intro}</p>}

        {visibleTabs.map((item) =>
          visited.has(item.value) || item.value === tab ? (
            <div key={item.value} className={`${styles.tabPane} ${local.pane}`} hidden={item.value !== tab}>
              <EmbeddedProvider value>{item.render()}</EmbeddedProvider>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

/** Small helper: a labelled block with an optional explanation, used inside tabs. */
export function Block({ title, hint, right, children }: { title: string; hint?: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className={local.block}>
      <div className={local.blockHead}>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
