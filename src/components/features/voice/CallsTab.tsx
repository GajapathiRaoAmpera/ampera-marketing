"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton, Table } from "@/components/ui";
import {
  DISPOSITION_LABELS, dispositionLabel, dispositionTone, formatDuration, voiceCenterApi,
  type CallLogFilters, type CallRow,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { QuickCall } from "./QuickCall";
import styles from "./VoiceCenter.module.scss";

const PAGE_SIZE = 25;

function statusText(call: CallRow): string {
  if (call.status === "in-progress") return "In progress";
  if (call.status === "completed") return call.connected ? "Completed" : "No conversation";
  return call.status.replace("-", " ");
}

export function CallsTab({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [filters, setFilters] = useState<CallLogFilters>({ campaign_id: campaignId });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ calls: CallRow[]; total: number } | null>(null);
  const [callBack, setCallBack] = useState<CallRow | null>(null);
  const [failed, setFailed] = useState(false);

  const query = useMemo<CallLogFilters>(() => ({ ...filters, q: search.trim() || undefined }), [filters, search]);

  const load = useCallback(() => {
    return voiceCenterApi.callLog({ ...query, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((value) => { setResult(value); setFailed(false); })
      .catch(() => setFailed(true));
  }, [query, page]);

  useEffect(() => {
    // Wait for typing to pause before searching.
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  function setFilter(patch: CallLogFilters) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  async function toggleStar(call: CallRow) {
    try {
      await voiceCenterApi.reviewCall(call.id, { starred: !call.starred });
      setResult((current) => current && {
        ...current, calls: current.calls.map((row) => (row.id === call.id ? { ...row, starred: !row.starred } : row)),
      });
    } catch {
      show("Couldn't update that call.", "error");
    }
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const isFiltered = Boolean(search.trim() || filters.direction || filters.disposition || filters.days || filters.starred);

  function clearFilters() {
    setSearch("");
    setFilters({ campaign_id: filters.campaign_id });
    setPage(0);
  }

  return (
    <Card>
      {filters.campaign_id && (
        <div className={styles.callout} style={{ marginBottom: "var(--space-4)" }}>
          Showing calls from one campaign.{" "}
          <button className={styles.linkButton} onClick={() => setFilter({ campaign_id: undefined })}>Show all calls</button>
        </div>
      )}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGrow}>
          <Input
            label="Search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Number, name, tag or what happened"
          />
        </div>
        <div style={{ width: 150 }}>
          <Select label="Direction" value={filters.direction ?? ""} onChange={(e) => setFilter({ direction: e.target.value || undefined })}>
            <option value="">All calls</option>
            <option value="inbound">Incoming</option>
            <option value="outbound">Outgoing</option>
          </Select>
        </div>
        <div style={{ width: 200 }}>
          <Select label="Outcome" value={filters.disposition ?? ""} onChange={(e) => setFilter({ disposition: e.target.value || undefined })}>
            <option value="">Any outcome</option>
            {Object.entries(DISPOSITION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        </div>
        <div style={{ width: 150 }}>
          <Select label="Period" value={filters.days ?? ""} onChange={(e) => setFilter({ days: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">All time</option>
            <option value={1}>Today</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </Select>
        </div>
        <Button variant={filters.starred ? "primary" : "secondary"} onClick={() => setFilter({ starred: !filters.starred })}>
          ★ Starred
        </Button>
        <Button
          variant="secondary"
          disabled={!result || result.total === 0}
          onClick={() => window.location.assign(voiceCenterApi.exportUrl(query))}
        >
          Export CSV
        </Button>
      </div>

      <div style={{ marginTop: "var(--space-5)" }}>
        {failed ? (
          <EmptyState
            title="Couldn't load your calls"
            description="Check your connection and try again."
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        ) : !result ? (
          <Skeleton height={280} />
        ) : result.calls.length === 0 ? (
          <EmptyState
            title="No calls match"
            description={isFiltered
              ? "Try a wider period or clear the filters."
              : "Incoming and outgoing calls appear here with their outcome as soon as they finish."}
            action={isFiltered ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            <Table<CallRow>
              rows={result.calls}
              rowKey={(call) => call.id}
              onRowClick={(call) => router.push(`/channels/voice/calls/${call.id}`)}
              columns={[
                {
                  key: "star", header: "", width: "36px",
                  render: (call) => (
                    <button
                      className={clsx(styles.starButton, call.starred && styles.starOn)}
                      aria-label={call.starred ? "Remove star" : "Star this call"}
                      onClick={(e) => { e.stopPropagation(); void toggleStar(call); }}
                    >★</button>
                  ),
                },
                {
                  key: "who", header: "Caller",
                  render: (call) => (
                    <div className={styles.numberCell}>
                      <span>{call.name || call.number}</span>
                      <span className={styles.muted}>
                        {call.direction === "inbound" ? "Incoming" : "Outgoing"}{call.name ? ` · ${call.number}` : ""}
                        {call.attempt > 1 ? ` · attempt ${call.attempt}` : ""}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "outcome", header: "Outcome",
                  render: (call) => (
                    <div className={styles.badgeRow}>
                      {call.disposition
                        ? <Badge variant={dispositionTone(call.disposition)}>{dispositionLabel(call.disposition)}</Badge>
                        : <Badge variant="neutral">{statusText(call)}</Badge>}
                      {call.after_hours && <Badge variant="info">After hours</Badge>}
                      {call.returning_caller && <Badge variant="neutral">Returning</Badge>}
                      {call.lead_label === "hot" && <Badge variant="danger">Hot lead</Badge>}
                      {call.retry_at && <Badge variant="neutral">Retry queued</Badge>}
                      {call.callback_scheduled && <Badge variant="success">Callback booked</Badge>}
                    </div>
                  ),
                },
                { key: "summary", header: "What happened", render: (call) => <div className={styles.outcomeCell}>{call.outcome}</div> },
                { key: "duration", header: "Length", width: "80px", render: (call) => formatDuration(call.connected ? call.duration_seconds : null) || "–" },
                { key: "quality", header: "Quality", width: "70px", render: (call) => call.qa_score ?? "–" },
                {
                  key: "when", header: "When", width: "150px",
                  render: (call) => call.started_at ? new Date(call.started_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "",
                },
                {
                  key: "action", header: "", width: "100px",
                  render: (call) => (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setCallBack(call); }}>
                      Call back
                    </Button>
                  ),
                },
              ]}
            />
            <div className={styles.pager}>
              <span>{result.total} calls</span>
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                Page {page + 1} of {pages}
                <Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
              </span>
            </div>
          </>
        )}
      </div>

      {callBack && (
        <QuickCall
          isOpen
          onClose={() => setCallBack(null)}
          onPlaced={load}
          number={callBack.number}
          name={callBack.name}
          context={callBack.outcome ? `Following up on an earlier call. What happened then: ${callBack.outcome}` : ""}
        />
      )}
    </Card>
  );
}
