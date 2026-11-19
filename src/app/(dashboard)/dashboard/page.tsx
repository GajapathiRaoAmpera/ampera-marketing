"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  dashboardApi,
  instagramAutomationsApi,
  ragApi,
  type InstagramAccountCommentMetrics,
  type InstagramAutomation,
  type InstagramConnection,
} from "@/lib/api";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useBusiness } from "@/context/BusinessContext";
import { useEntitlements } from "@/context/EntitlementsContext";
import { Button, EmptyState, Icon, IconTile, InfoTip, Skeleton, type IconName, type Tone } from "@/components/ui";
import { getChannelMeta } from "@/lib/utils/channel-meta";
import { formatRelativeTime } from "@/lib/utils/date";
import type { DashboardAttention } from "@/types/api";
import styles from "./page.module.scss";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const CHANNEL_HREF: Record<string, string> = {
  instagram: "/channels/instagram",
  whatsapp: "/channels/whatsapp",
  messenger: "/channels/messenger",
  telegram: "/channels/telegram",
  sms: "/channels/sms",
  twitter: "/channels/twitter",
  discord: "/channels/discord",
  voice: "/channels/voice",
  widget: "/channels/widget",
};

interface InstagramSummary {
  connection: InstagramConnection;
  automations: InstagramAutomation[];
  metrics: InstagramAccountCommentMetrics | null;
}

export default function DashboardPage() {
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { user } = useAuth();
  const { can } = useBusiness();
  const { entitlements, isEnabled } = useEntitlements();
  const channels = useMemo(() => entitlements?.connected_channels ?? [], [entitlements]);
  const hasInstagram = channels.includes("instagram");
  const aiIncluded = isEnabled("ai_replies_enabled");

  const { data, isLoading, error } = useAsync(() => (businessId ? dashboardApi.home(businessId) : Promise.resolve(null)), [businessId]);

  // Instagram details, only when Instagram is connected.
  const [instagram, setInstagram] = useState<InstagramSummary | null>(null);
  useEffect(() => {
    if (!businessId || !hasInstagram) return;
    let cancelled = false;
    (async () => {
      try {
        const connections = await instagramAutomationsApi.connections(businessId);
        const connection = connections[0];
        if (!connection) return;
        const [automations, metrics] = await Promise.all([
          instagramAutomationsApi.list(businessId, connection.id).catch(() => [] as InstagramAutomation[]),
          instagramAutomationsApi.commentMetrics(businessId, connection.id, 7).catch(() => null),
        ]);
        if (!cancelled) setInstagram({ connection, automations, metrics });
      } catch {
        // The Instagram card just shows less.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, hasInstagram]);

  // Whether the knowledge base has anything in it, for the setup guide.
  const [docCount, setDocCount] = useState<number | null>(null);
  useEffect(() => {
    if (!businessId || !aiIncluded) return;
    let cancelled = false;
    ragApi
      .list(businessId)
      .then((docs) => !cancelled && setDocCount(docs.length))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId, aiIncluded]);

  if (businessLoading) return <Skeleton height={420} />;
  if (hasNoBusinesses || !businessId) {
    return (
      <EmptyState
        title="Let's set up your business"
        description="Create your business profile first. Then connect a channel and you're ready."
        action={
          <Link href="/onboarding">
            <Button>Create your business</Button>
          </Link>
        }
      />
    );
  }

  const today = data?.today;
  const attention = data?.attention_required ?? null;
  const recent = data?.recent_conversations ?? [];
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const instagramLive = instagram?.automations.filter((item) => item.status === "active").length ?? 0;
  const aiUsed = aiIncluded && (Boolean(today?.ai_resolutions) || instagram?.connection.ai_enabled !== false);

  const steps = [
    { done: channels.length > 0, label: "Connect a channel", detail: "Instagram, WhatsApp or your website", href: "/channels", icon: "plug" as IconName },
    ...(hasInstagram
      ? [{ done: instagramLive > 0, label: "Turn on an Instagram automation", detail: "Reply to comments and DMs automatically", href: "/channels/instagram?new=1", icon: "bolt" as IconName }]
      : []),
    ...(aiUsed
      ? [{ done: (docCount ?? 0) > 0, label: "Teach your AI about your business", detail: "Upload a price list, FAQ or brochure", href: "/knowledge-base", icon: "book" as IconName }]
      : []),
  ];
  const stepsDone = steps.filter((step) => step.done).length;
  const showSteps = can("manager") && stepsDone < steps.length;

  const stats: Array<{ label: string; value: number | undefined; icon: IconName; tone: Tone; href?: string; info: string; hide?: boolean }> = [
    { label: "New conversations", value: today?.new_conversations, icon: "inbox", tone: "blue", href: "/inbox", info: "People who started talking to you today, on any channel." },
    { label: "Active now", value: today?.active_conversations, icon: "comment", tone: "violet", href: "/inbox", info: "Conversations with messages in the last day that aren't closed." },
    { label: "Need a person", value: today?.human_required_count, icon: "team", tone: "red", href: "/inbox", info: "Customers who asked for a human, or that the AI handed over. Reply from the inbox." },
    { label: "Hot leads", value: today?.hot_leads_count, icon: "fire", tone: "orange", href: "/hot-leads", info: "People showing strong buying signals (price, availability, ready to order)." },
    { label: "Answered by AI", value: today?.ai_resolutions, icon: "bot", tone: "teal", info: "Conversations today that the AI answered without anyone stepping in.", hide: !aiUsed },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1 className={styles.greeting}>
            {greeting()}, {firstName}
          </h1>
          <p className={styles.subtitle}>
            {channels.length === 0
              ? "Connect your first channel to start replying to customers automatically."
              : `Here's what's happening across ${channels.length === 1 ? getChannelMeta(channels[0]).label : `your ${channels.length} channels`} today.`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/inbox" className={styles.ghostAction}>
            <Icon name="inbox" size={16} /> Open inbox
          </Link>
          {hasInstagram && can("manager") && (
            <Link href="/channels/instagram?new=1" className={styles.primaryAction}>
              <Icon name="plus" size={16} /> New automation
            </Link>
          )}
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {showSteps && (
        <section className={styles.setup}>
          <div className={styles.setupHead}>
            <div>
              <h2>Finish setting up</h2>
              <p>
                {stepsDone} of {steps.length} done
              </p>
            </div>
            <div className={styles.setupBar}>
              <span style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
            </div>
          </div>
          <div className={styles.steps}>
            {steps.map((step) => (
              <Link key={step.label} href={step.href} className={step.done ? styles.stepDone : styles.step}>
                <span className={styles.stepIcon}>{step.done ? <Icon name="check" size={16} style={{ strokeWidth: 2.6 }} /> : <Icon name={step.icon} size={16} />}</span>
                <span className={styles.stepText}>
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </span>
                {!step.done && <Icon name="arrowRight" size={16} />}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className={styles.sectionHead}>
          <h2>Today</h2>
        </div>
        <div className={styles.statGrid}>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={104} />)
            : stats
                .filter((stat) => !stat.hide)
                .map((stat) => {
                  const body = (
                    <>
                      <span className={styles.statTop}>
                        <IconTile name={stat.icon} tone={stat.tone} size="sm" />
                        <InfoTip help={stat.info} />
                      </span>
                      <span className={styles.statValue}>{typeof stat.value === "number" ? stat.value.toLocaleString() : "–"}</span>
                      <span className={styles.statLabel}>{stat.label}</span>
                    </>
                  );
                  return stat.href ? (
                    <Link key={stat.label} href={stat.href} className={styles.stat}>
                      {body}
                    </Link>
                  ) : (
                    <div key={stat.label} className={styles.stat}>
                      {body}
                    </div>
                  );
                })}
        </div>
      </section>

      <section>
        <div className={styles.sectionHead}>
          <h2>Your channels</h2>
          {can("admin") && (
            <Link href="/channels" className={styles.sectionLink}>
              Add a channel <Icon name="plus" size={14} />
            </Link>
          )}
        </div>
        {channels.length === 0 ? (
          <Link href="/channels" className={styles.noChannels}>
            <IconTile name="plug" tone="blue" size="lg" />
            <span>
              <strong>Connect your first channel</strong>
              <span>Instagram, WhatsApp, Messenger, your website and more. It takes about a minute.</span>
            </span>
            <Icon name="arrowRight" size={18} />
          </Link>
        ) : (
          <div className={styles.channelGrid}>
            {channels.map((channel) =>
              channel === "instagram" ? (
                <InstagramCard key={channel} summary={instagram} />
              ) : (
                <GenericChannelCard key={channel} channel={channel} conversations={recent.filter((c) => c.channel === channel).length} />
              )
            )}
          </div>
        )}
      </section>

      <div className={styles.twoCol}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Recent conversations</h2>
            <Link href="/inbox" className={styles.sectionLink}>
              Inbox <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton height={220} />
          ) : recent.length === 0 ? (
            <p className={styles.muted}>No conversations yet. They&apos;ll appear here as customers message you on any channel.</p>
          ) : (
            <ul className={styles.convoList}>
              {recent.slice(0, 6).map((c) => {
                const meta = getChannelMeta(c.channel);
                const name = c.customer?.name ?? c.customer?.phone ?? "Customer";
                return (
                  <li key={c.conversation_key}>
                    <Link href={`/inbox?c=${encodeURIComponent(c.conversation_key)}`} className={styles.convo}>
                      <span className={styles.convoAvatar} style={{ color: meta.color }}>
                        {name.slice(0, 1).toUpperCase()}
                        <span className={styles.convoChannel}>{meta.icon}</span>
                      </span>
                      <span className={styles.convoText}>
                        <strong>{name}</strong>
                        <span>{c.last_message ?? "No messages yet"}</span>
                      </span>
                      <span className={styles.convoMeta}>
                        <span>{formatRelativeTime(c.last_activity)}</span>
                        <span className={c.ai_enabled ? styles.tagAi : styles.tagHuman}>{c.ai_enabled ? "AI" : "You"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Needs attention</h2>
          </div>
          {isLoading ? <Skeleton height={180} /> : <Attention items={attention} showGaps={aiUsed} />}
        </section>
      </div>
    </div>
  );
}

function InstagramCard({ summary }: { summary: InstagramSummary | null }) {
  const meta = getChannelMeta("instagram");
  if (!summary) {
    return (
      <Link href="/channels/instagram" className={styles.channelCard}>
        <span className={styles.channelTop} style={{ color: meta.color }}>
          {meta.icon} <strong>Instagram</strong>
        </span>
        <Skeleton height={60} />
      </Link>
    );
  }
  const live = summary.automations.filter((item) => item.status === "active").length;
  const m = summary.metrics;
  const aiOn = summary.connection.ai_enabled !== false;
  return (
    <Link href="/channels/instagram" className={styles.channelCard}>
      <span className={styles.channelTop}>
        <span className={styles.channelName} style={{ color: meta.color }}>
          {meta.icon} <strong>@{summary.connection.instagram_username}</strong>
        </span>
        <span className={live ? styles.dotOn : styles.dotOff}>{live ? `${live} live` : "No automations on"}</span>
      </span>
      <span className={styles.channelStats}>
        <span>
          <strong>{m?.comments_received ?? "–"}</strong>
          comments (7 days)
        </span>
        <span>
          <strong>{m?.replied ?? "–"}</strong>
          answered
        </span>
        <span>
          <strong className={m?.missed ? styles.bad : ""}>{m?.missed ?? "–"}</strong>
          missed
        </span>
      </span>
      <span className={styles.channelFoot}>
        <span>AI agent {aiOn ? "on" : "off"}</span>
        <span className={styles.open}>
          Open <Icon name="arrowRight" size={14} />
        </span>
      </span>
    </Link>
  );
}

function GenericChannelCard({ channel, conversations }: { channel: string; conversations: number }) {
  const meta = getChannelMeta(channel);
  return (
    <Link href={CHANNEL_HREF[channel] ?? "/channels"} className={styles.channelCard}>
      <span className={styles.channelTop}>
        <span className={styles.channelName} style={{ color: meta.color }}>
          {meta.icon} <strong>{meta.label}</strong>
        </span>
        <span className={styles.dotOn}>Connected</span>
      </span>
      <span className={styles.channelStats}>
        <span>
          <strong>{conversations}</strong>
          recent conversations
        </span>
      </span>
      <span className={styles.channelFoot}>
        <span>Replies in your inbox</span>
        <span className={styles.open}>
          Open <Icon name="arrowRight" size={14} />
        </span>
      </span>
    </Link>
  );
}

function Attention({ items, showGaps }: { items: DashboardAttention | null; showGaps: boolean }) {
  const entries = items
    ? [
        { label: items.waiting_for_human.length === 1 ? "customer waiting for a person" : "customers waiting for a person", count: items.waiting_for_human.length, href: "/inbox", icon: "team" as IconName, tone: "red" as Tone },
        { label: items.hot_leads.length === 1 ? "hot lead to follow up" : "hot leads to follow up", count: items.hot_leads.length, href: "/hot-leads", icon: "fire" as IconName, tone: "orange" as Tone },
        { label: items.follow_ups_due.length === 1 ? "follow-up due" : "follow-ups due", count: items.follow_ups_due.length, href: "/hot-leads?tab=follow-ups", icon: "calendar" as IconName, tone: "blue" as Tone },
        ...(showGaps
          ? [{ label: "questions your AI couldn't answer", count: items.open_knowledge_gaps_count, href: "/knowledge-gaps", icon: "bulb" as IconName, tone: "amber" as Tone }]
          : []),
      ].filter((item) => item.count > 0)
    : [];

  if (entries.length === 0) {
    return (
      <div className={styles.allClear}>
        <IconTile name="check" tone="green" size="lg" />
        <strong>You&apos;re all caught up</strong>
        <span>Nothing needs you right now.</span>
      </div>
    );
  }
  return (
    <ul className={styles.attentionList}>
      {entries.map((item) => (
        <li key={item.label}>
          <Link href={item.href} className={styles.attentionRow}>
            <IconTile name={item.icon} tone={item.tone} size="sm" />
            <span className={styles.attentionText}>
              <strong>{item.count}</strong> {item.label}
            </span>
            <Icon name="arrowRight" size={16} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
