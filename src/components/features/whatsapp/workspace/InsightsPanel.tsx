"use client";

import { useEffect, useState } from "react";
import { whatsappStudioApi, type WhatsAppInsights } from "@/lib/api/whatsapp-studio";
import { Skeleton, Tabs } from "@/components/ui";
import { IconTile } from "@/components/ui/Icon/Icon";
import styles from "../../instagram/workspace/workspace.module.scss";
import local from "./whatsapp.module.scss";

const money = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];
const WHO: Array<{ key: keyof WhatsAppInsights["answered_by"]; label: string; color: string }> = [
  { key: "ai", label: "AI agent", color: "#7c3aed" },
  { key: "menu", label: "Clickable menus", color: "#25d366" },
  { key: "flow", label: "Flows", color: "#0ea5e9" },
  { key: "team", label: "You and your team", color: "#f59e0b" },
  { key: "away", label: "Away message", color: "#94a3b8" },
  { key: "other", label: "Other automatic", color: "#cbd5e1" },
];

/** What WhatsApp did for the business: chats, who answered, orders and what campaigns earned. */
export function InsightsPanel({ businessId }: { businessId: string }) {
  const [range, setRange] = useState("30");
  const [data, setData] = useState<WhatsAppInsights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whatsappStudioApi
      .insights(businessId, Number(range))
      .then((result) => !cancelled && (setData(result), setFailed(false)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [businessId, range]);

  const answeredTotal = data ? Object.values(data.answered_by).reduce((sum, value) => sum + value, 0) : 0;
  const peak = Math.max(1, ...(data?.per_day.map((day) => day.received) ?? [1]));

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="chart" tone="green" size="sm" /> How it&apos;s going
          </h3>
          <p>Conversations, who answered them, and what they brought in.</p>
        </div>
        <div className={local.rangeTabs}>
          <Tabs value={range} onChange={(value) => { setData(null); setRange(value); }} options={RANGES} />
        </div>
      </div>

      {failed ? (
        <p className={styles.muted}>Couldn&apos;t load your numbers. Try again in a moment.</p>
      ) : !data ? (
        <Skeleton height={200} />
      ) : (
        <>
          <div className={styles.stats}>
            <Figure label="People who wrote" value={data.chats.toLocaleString()} hint={`${data.new_contacts.toLocaleString()} new contacts`} />
            <Figure label="Messages from customers" value={data.messages_received.toLocaleString()} hint={`${data.messages_sent.toLocaleString()} sent back`} />
            <Figure label="Orders paid" value={data.orders.paid.toLocaleString()} hint={`${data.orders.created.toLocaleString()} started`} />
            <Figure label="Sales" value={money(data.orders.revenue_minor)} hint={data.ads.chats ? `${money(data.ads.revenue_minor)} from ads` : "Paid orders"} />
          </div>

          {data.per_day.length > 1 && (
            <div className={local.sparkWrap} role="img" aria-label="Customer messages per day">
              {data.per_day.map((day) => (
                <span key={day.date} className={local.sparkBar} title={`${day.date}: ${day.received} from customers`} style={{ height: `${Math.max(6, (day.received / peak) * 100)}%` }} />
              ))}
            </div>
          )}

          <div className={local.insightColumns}>
            <div>
              <h4 className={local.miniHeading}>Who answered</h4>
              {answeredTotal === 0 ? (
                <p className={styles.muted}>No replies in this period yet.</p>
              ) : (
                <>
                  <div className={local.stack} role="img" aria-label="Share of replies by who sent them">
                    {WHO.filter((item) => data.answered_by[item.key] > 0).map((item) => (
                      <span key={item.key} style={{ width: `${(data.answered_by[item.key] / answeredTotal) * 100}%`, background: item.color }} title={`${item.label}: ${data.answered_by[item.key]}`} />
                    ))}
                  </div>
                  <ul className={local.legend}>
                    {WHO.filter((item) => data.answered_by[item.key] > 0).map((item) => (
                      <li key={item.key}>
                        <i style={{ background: item.color }} aria-hidden /> {item.label}
                        <strong>{Math.round((data.answered_by[item.key] / answeredTotal) * 100)}%</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div>
              <h4 className={local.miniHeading}>Campaigns</h4>
              {data.campaigns.length === 0 ? (
                <p className={styles.muted}>No campaigns in this period.</p>
              ) : (
                <ul className={styles.miniList}>
                  {data.campaigns.map((campaign) => (
                    <li key={campaign.id}>
                      <span>
                        <strong style={{ fontSize: "var(--font-size-sm)" }}>{campaign.name}</strong>
                        <span className={styles.muted} style={{ display: "block", fontSize: "var(--font-size-xs)" }}>
                          {campaign.sent.toLocaleString()} sent · {campaign.read.toLocaleString()} read · {campaign.buyers} bought
                        </span>
                      </span>
                      <strong>{money(campaign.revenue_minor)}</strong>
                    </li>
                  ))}
                </ul>
              )}
              <p className={local.footnote}>Sales count paid orders from people a campaign reached, within 7 days of the message.</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statHint}>{hint}</span>
    </div>
  );
}
