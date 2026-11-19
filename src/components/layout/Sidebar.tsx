"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { useEntitlements } from "@/context/EntitlementsContext";
import { useBusiness } from "@/context/BusinessContext";
import type { BusinessRole } from "@/types/api";
import { Avatar } from "@/components/ui";
import { BrandLockup } from "./BrandLockup";
import styles from "./Sidebar.module.scss";
import {
  HomeIcon,
  InboxIcon,
  WhatsAppIcon,
  InstagramIcon,
  MessengerIcon,
  FireIcon,
  LogoutIcon,
  ChevronDownIcon,
  PanelLeftIcon,
  LockIcon,
} from "./icons";

// minRole is the lowest role that can actually use the page (see
// lib/permissions.ts); lower roles don't see the entry. Omitted = everyone.
interface NavItem {
  // The plan feature this entry needs; shown with a lock when it is off.
  feature?: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  minRole?: BusinessRole;
}

interface SubNavItem {
  href: string;
  label: string;
  badge?: string;
  exact?: boolean;
  minRole?: BusinessRole;
}

interface NavGroup {
  feature?: string;
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  children: SubNavItem[];
}

const workNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <HomeIcon /> },
  { href: "/inbox", label: "Inbox", icon: <InboxIcon /> },
  // Hot leads + Follow-ups merged into one tabbed page at /hot-leads.
  { href: "/hot-leads", label: "Leads", icon: <FireIcon /> },
];

const channelGroups: NavGroup[] = [
  {
    id: "whatsapp",
    feature: "whatsapp_enabled",
    href: "/channels/whatsapp",
    label: "WhatsApp",
    icon: <WhatsAppIcon />,
    // Everything WhatsApp is a tab on its own page, so no submenu.
    children: [],
  },
  {
    id: "instagram",
    feature: "instagram_enabled",
    href: "/channels/instagram",
    label: "Instagram",
    icon: <InstagramIcon />,
    // Everything Instagram is a tab on its own page, so no submenu.
    children: [],
  },
  {
    id: "messenger",
    feature: "messenger_enabled",
    href: "/channels/messenger",
    label: "Messenger",
    icon: <MessengerIcon />,
    // Everything Messenger is a tab on its own page, so no submenu.
    children: [],
  },
];

// Which connected channel each entry stands for (see connected_channels in
// the entitlements response). Only connected ones are listed in the sidebar.
const CHANNEL_KEY: Record<string, string> = {
  "/channels/whatsapp": "whatsapp",
  "/channels/instagram": "instagram",
  "/channels/messenger": "messenger",
  "/channels/voice": "voice",
  "/channels/widget": "widget",
  "/channels/telegram": "telegram",
  "/channels/discord": "discord",
  "/channels/sms": "sms",
  "/channels/twitter": "twitter",
};

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapsed,
}: {
  isOpen: boolean;
  onClose: () => void;
  // Desktop-only icon-rail collapse, independent of isOpen/onClose (that
  // pair is the mobile slide-in drawer). Owned by DashboardShell, not here,
  // since the content pane's left offset needs to react to it too.
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { can } = useBusiness();
  const { isEnabled, entitlements, isLoading: entitlementsLoading } = useEntitlements();
  const isLocked = (feature?: string) => Boolean(feature) && !isEnabled(feature as string);
  const allowed = (minRole?: BusinessRole) => !minRole || can(minRole);
  const [groupVisibility, setGroupVisibility] = useState<Record<string, boolean>>({});

  function toggleGroup(groupId: string, expanded: boolean) {
    setGroupVisibility((current) => ({ ...current, [groupId]: !expanded }));
  }

  // Channels this business has set up. Unknown (could not be loaded) shows
  // every channel, so nobody loses their way to a page.
  const connected = entitlements?.connected_channels;
  const showChannel = (href: string) => !connected || connected.includes(CHANNEL_KEY[href]) || isRouteActive(pathname, href);

  function renderItem(item: NavItem) {
    const active = item.exact ? pathname === item.href : isRouteActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={clsx(styles.navItem, active && styles.navItemActive)}
        aria-current={active ? "page" : undefined}
        onClick={onClose}
        title={isCollapsed ? item.label : undefined}
      >
        <span className={styles.navIcon}>{item.icon}</span>
        <span className={styles.navLabel}>{item.label}</span>
        {isLocked(item.feature) && (
          <span className={styles.lockMark} title="Not included in your plan">
            <LockIcon size={13} />
          </span>
        )}
      </Link>
    );
  }

  function renderSection(title: string, allItems: NavItem[], sectionClassName?: string) {
    const items = allItems.filter((item) => allowed(item.minRole));
    if (items.length === 0) return null;
    const sectionId = `nav-${title.toLowerCase()}`;
    return (
      <section className={clsx(styles.navSection, sectionClassName)} aria-labelledby={sectionId}>
        <h2 className={styles.sectionLabel} id={sectionId}>{title}</h2>
        <div className={styles.sectionItems}>{items.map(renderItem)}</div>
      </section>
    );
  }

  function renderChannelGroup(fullGroup: NavGroup) {
    // Show only the pages this role can use; if none, the group is hidden. Its
    // main link goes to the first page they can open.
    const children = fullGroup.children.filter((item) => allowed(item.minRole));
    if (children.length === 0) return null;
    const group: NavGroup = {
      ...fullGroup,
      children,
      href: children.some((item) => item.href === fullGroup.href) ? fullGroup.href : children[0].href,
    };
    const groupActive = isRouteActive(pathname, group.href)
      || group.children.some((item) => isRouteActive(pathname, item.href));

    // Collapsed: no room for a submenu, so a group is just its icon linking
    // to the group's own main page (same shape as a plain NavItem) instead
    // of an expand/collapse row with nowhere to expand into.
    if (isCollapsed) {
      return (
        <Link
          key={group.id}
          href={group.href}
          className={clsx(styles.navItem, groupActive && styles.navItemActive)}
          aria-current={pathname === group.href ? "page" : undefined}
          onClick={onClose}
          title={group.label}
        >
          <span className={styles.navIcon}>{group.icon}</span>
          <span className={styles.navLabel}>{group.label}</span>
        {isLocked(group.feature) && (
          <span className={styles.lockMark} title="Not included in your plan">
            <LockIcon size={13} />
          </span>
        )}
        </Link>
      );
    }

    const expanded = groupVisibility[group.id] ?? groupActive;
    const subNavId = `nav-${group.id}-tools`;

    return (
      <div className={styles.navGroup} key={group.id}>
        <div className={clsx(styles.navGroupRow, groupActive && styles.navGroupRowActive)}>
          <Link
            href={group.href}
            className={styles.navGroupLink}
            aria-current={pathname === group.href ? "page" : undefined}
            onClick={onClose}
          >
            <span className={styles.navIcon}>{group.icon}</span>
            <span className={styles.navLabel}>{group.label}</span>
        {isLocked(group.feature) && (
          <span className={styles.lockMark} title="Not included in your plan">
            <LockIcon size={13} />
          </span>
        )}
          </Link>
          <button
            type="button"
            className={styles.groupToggle}
            aria-label={`${expanded ? "Hide" : "Show"} ${group.label} tools`}
            aria-expanded={expanded}
            aria-controls={subNavId}
            onClick={() => toggleGroup(group.id, expanded)}
          >
            <span className={clsx(styles.chevron, expanded && styles.chevronOpen)}>
              <ChevronDownIcon />
            </span>
          </button>
        </div>

        {expanded && (
          <div className={styles.subNav} id={subNavId}>
            {group.children.map((item) => {
              const active = item.exact ? pathname === item.href : isRouteActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(styles.subNavItem, active && styles.subNavItemActive)}
                  aria-current={active ? "page" : undefined}
                  onClick={onClose}
                >
                  <span className={styles.subNavMarker} />
                  <span className={styles.navLabel}>{item.label}</span>
                  {item.badge && <span className={styles.betaTag}>{item.badge}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {isOpen && <div className={styles.mobileOverlay} onClick={onClose} />}
      <aside
        className={clsx(styles.sidebar, isOpen && styles.open, isCollapsed && styles.collapsed)}
        aria-label="Main navigation"
      >
        <div className={styles.brandRow}>
          <BrandLockup compact logoOnly={isCollapsed} />
          <button
            type="button"
            className={styles.collapseToggle}
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeftIcon size={16} />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Workspace">
          {renderSection("Work", workNav)}

          <section className={styles.navSection} aria-labelledby="nav-channels">
            <h2 className={styles.sectionLabel} id="nav-channels">Channels</h2>
            <div className={styles.sectionItems}>
              {!entitlementsLoading && (
                <>
                  {/* Demo: Meta products only (WhatsApp, Instagram, Messenger). */}
                  {channelGroups
                    .filter((group) => showChannel(group.href))
                    .map((group) => (group.children.length === 0 ? renderItem({ ...group, minRole: undefined }) : renderChannelGroup(group)))}
                </>
              )}
            </div>
          </section>
        </nav>

        {user && (
          <div className={styles.footer}>
            <div className={styles.userRow}>
              <Avatar name={user.name} size="sm" />
              <div className={styles.userInfo}>
                <div className={styles.userName}>{user.name}</div>
                <div className={styles.userEmail}>{user.email}</div>
              </div>
              <button
                type="button"
                className={styles.logoutButton}
                onClick={() => logout()}
                aria-label="Log out"
                title={isCollapsed ? "Log out" : undefined}
              >
                <LogoutIcon size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
