"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, knowledgeGapsApi, type KnowledgeGapsListResponse } from "@/lib/api";
import { useBusiness } from "@/context/BusinessContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useToast } from "@/context/ToastContext";
import { Button, EmptyState, Icon, IconTile, InfoTip, Skeleton } from "@/components/ui";
import { getChannelMeta } from "@/lib/utils/channel-meta";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date";
import type { KnowledgeGap, KnowledgeGapStatus } from "@/types/api";
import styles from "@/app/(dashboard)/knowledge-gaps/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

const TABS: Array<{ value: KnowledgeGapStatus; label: string }> = [
  { value: "open", label: "To answer" },
  { value: "resolved", label: "Answered" },
  { value: "dismissed", label: "Dismissed" },
];

/** "919876543210" → "+91 98765 43210"-ish; long ids are shortened. */
function customerLabel(userKey?: string | null): string {
  if (!userKey) return "A customer";
  if (/^\d{10,15}$/.test(userKey)) return `+${userKey}`;
  return userKey.length > 18 ? `${userKey.slice(0, 8)}…${userKey.slice(-4)}` : userKey;
}

export default function KnowledgeGapsPage() {
  const embedded = useEmbedded();
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { can } = useBusiness();
  const canEdit = can("manager");
  const [tab, setTab] = useState<KnowledgeGapStatus>("open");
  const [pages, setPages] = useState<Record<string, KnowledgeGapsListResponse>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const key = `${businessId}|${tab}|${reload}`;
  const page = pages[key];

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    knowledgeGapsApi
      .page(businessId, tab)
      .then((result) => !cancelled && setPages((all) => ({ ...all, [key]: result })))
      .catch((error) => !cancelled && setFailed((all) => ({ ...all, [key]: error instanceof ApiError ? error.userMessage : "Couldn't load knowledge gaps." })));
    return () => {
      cancelled = true;
    };
  }, [businessId, tab, key]);

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="Knowledge gaps show up here as customers ask questions your AI can't answer yet." />;
  }

  // Shown while the next tab loads, so the page doesn't blank out.
  const latest = Object.entries(pages).filter(([k]) => k.startsWith(`${businessId}|`)).pop()?.[1];
  const counts = (page ?? latest)?.counts;
  const gaps = page?.knowledge_gaps;

  return (
    <div className={styles.page}>
      {!embedded && (
        <header className={styles.header}>
          <IconTile name="bulb" tone="amber" size="lg" />
          <div className={styles.headerText}>
            <h1>
              Knowledge gaps
              <InfoTip help="Every time a customer asks something your knowledge base and products have no answer for, it's listed here, on every channel. Answer it once and the AI uses your answer from the next message on." />
            </h1>
            <p>Questions customers asked that your AI couldn&apos;t answer from your information. Answer them to make it smarter.</p>
          </div>
        </header>
      )}

      <div className={styles.tabs} role="tablist">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={tab === item.value ? styles.tabOn : styles.tab}
            onClick={() => setTab(item.value)}
          >
            {item.label}
            {counts && <span className={styles.count}>{counts[item.value] ?? 0}</span>}
          </button>
        ))}
      </div>

      {failed[key] && !gaps ? (
        <div className={styles.error}>
          {failed[key]}{" "}
          <Button size="sm" variant="secondary" onClick={() => setReload((v) => v + 1)}>
            Try again
          </Button>
        </div>
      ) : !gaps ? (
        <div className={styles.list}>
          <Skeleton height={150} />
          <Skeleton height={150} />
        </div>
      ) : gaps.length === 0 ? (
        <div className={styles.empty}>
          <IconTile name={tab === "open" ? "check" : "book"} tone={tab === "open" ? "green" : "slate"} size="lg" />
          <h3>{tab === "open" ? "Nothing to answer right now" : tab === "resolved" ? "No answered gaps yet" : "Nothing dismissed"}</h3>
          <p>
            {tab === "open"
              ? "Your AI found an answer for every question customers asked. New gaps appear here the moment one comes in."
              : tab === "resolved"
                ? "Questions you answer here are saved into your knowledge base and listed in this tab."
                : "Questions you dismiss are kept here, out of the way."}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {gaps.map((gap) => (
            <GapCard key={gap.id} businessId={businessId} gap={gap} canEdit={canEdit} onChanged={() => setReload((v) => v + 1)} />
          ))}
        </div>
      )}
    </div>
  );
}

function GapCard({ businessId, gap, canEdit, onChanged }: { businessId: string; gap: KnowledgeGap; canEdit: boolean; onChanged: () => void }) {
  const { show } = useToast();
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const [showTimes, setShowTimes] = useState(false);
  const [busy, setBusy] = useState(false);
  const occurrences = [...(gap.occurrences ?? [])].reverse();
  const channels = gap.channels?.length ? gap.channels : Array.from(new Set(occurrences.map((o) => o.channel).filter(Boolean) as string[]));

  async function saveAnswer() {
    if (answer.trim().length < 2) return;
    setBusy(true);
    try {
      await knowledgeGapsApi.answer(businessId, gap.id, answer.trim());
      show("Saved to your knowledge base. The AI will use this answer from now on.", "success");
      onChanged();
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't save the answer.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: KnowledgeGapStatus) {
    setBusy(true);
    try {
      await knowledgeGapsApi.updateStatus(businessId, gap.id, status);
      show(status === "dismissed" ? "Dismissed." : status === "open" ? "Moved back to “To answer”." : "Marked as answered.", "default");
      onChanged();
    } catch {
      show("Couldn't update this. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.questionWrap}>
          <span className={styles.quote} aria-hidden>
            <Icon name="comment" size={18} />
          </span>
          <h3 className={styles.question}>{gap.question_text || "(question not recorded)"}</h3>
        </div>
        <span className={styles.times} title="Times asked">
          {gap.occurrence_count}× asked
        </span>
      </div>

      <div className={styles.meta}>
        {channels.map((channel) => {
          const meta = getChannelMeta(channel);
          return (
            <span key={channel} className={styles.channel} style={{ color: meta.color }}>
              {meta.icon} <span>{meta.label}</span>
            </span>
          );
        })}
        <span className={styles.metaItem} title={formatDateTime(gap.last_asked_at)}>
          <Icon name="clock" size={14} /> Last asked {formatRelativeTime(gap.last_asked_at)}
        </span>
        {gap.created_at && (
          <span className={styles.metaItem} title={formatDateTime(gap.created_at)}>
            <Icon name="calendar" size={14} /> First asked {formatRelativeTime(gap.created_at)}
          </span>
        )}
      </div>

      {gap.status !== "resolved" && (
        <div className={styles.why}>
          <Icon name="alert" size={16} />
          <div>
            <strong>Why the AI couldn&apos;t answer</strong>
            <span>{gap.last_reason_text || "Nothing in your knowledge base or products covered this question."}</span>
          </div>
        </div>
      )}

      {gap.status === "resolved" && gap.answer && (
        <div className={styles.answered}>
          <Icon name="check" size={16} />
          <div>
            <strong>Your answer (in your knowledge base)</strong>
            <span>{gap.answer}</span>
          </div>
        </div>
      )}

      {occurrences.length > 0 && (
        <div>
          <button type="button" className={styles.timesToggle} onClick={() => setShowTimes((v) => !v)} aria-expanded={showTimes}>
            <span className={showTimes ? styles.chevOpen : styles.chev}>⌄</span>
            {showTimes ? "Hide" : "Show"} who asked and when ({occurrences.length})
          </button>
          {showTimes && (
            <ul className={styles.occurrences}>
              {occurrences.map((item, index) => {
                const meta = getChannelMeta(item.channel || "");
                return (
                  <li key={`${item.conversation_key}-${index}`}>
                    <span className={styles.occWho}>
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                      {customerLabel(item.user_key)} on {meta.label}
                    </span>
                    {item.text && item.text !== gap.question_text && <q className={styles.occText}>{item.text}</q>}
                    <span className={styles.occWhen} title={formatDateTime(item.asked_at)}>
                      {formatRelativeTime(item.asked_at)}
                    </span>
                    {item.conversation_key && (
                      <Link className={styles.occLink} href={`/inbox?c=${encodeURIComponent(item.conversation_key)}`}>
                        Open chat <Icon name="arrowRight" size={13} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {canEdit && answering && (
        <div className={styles.answerBox}>
          <label htmlFor={`answer-${gap.id}`}>
            Your answer
            <InfoTip help="Write it the way you'd reply to a customer. It's saved as a Q&A in your knowledge base, so the AI can answer this (and similar questions) on every channel." />
          </label>
          <textarea
            id={`answer-${gap.id}`}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="e.g. Yes, we ship to Dubai. Delivery takes 5–7 days and costs AED 25."
            autoFocus
          />
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={() => setAnswering(false)}>
              Cancel
            </Button>
            <Button size="sm" isLoading={busy} disabled={answer.trim().length < 2} onClick={() => void saveAnswer()} leftIcon={<Icon name="book" size={15} />}>
              Save to knowledge base
            </Button>
          </div>
        </div>
      )}

      {canEdit && !answering && (
        <div className={styles.actions}>
          {gap.status === "open" && (
            <>
              <Button size="sm" onClick={() => setAnswering(true)} leftIcon={<Icon name="pen" size={15} />}>
                Answer this
              </Button>
              <Link href="/knowledge-base" className={styles.secondaryLink}>
                Upload a document instead
              </Link>
              <span className={styles.spacer} />
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("resolved")}>
                Already covered
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("dismissed")}>
                Dismiss
              </Button>
            </>
          )}
          {gap.status !== "open" && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void setStatus("open")}>
              Move back to “To answer”
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
