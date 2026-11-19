"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/lib/utils/browser";
import Link from "next/link";
import { templateFlowsApi } from "@/lib/api";
import { whatsappStudioApi, type WhatsAppSettings, type WhatsAppStudioOverview } from "@/lib/api/whatsapp-studio";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Skeleton } from "@/components/ui";
import { Icon, IconTile, type IconName } from "@/components/ui/Icon/Icon";
import { InsightsPanel } from "./InsightsPanel";
import styles from "../../instagram/workspace/workspace.module.scss";
import local from "./whatsapp.module.scss";

export type WhatsAppTab = "home" | "replies" | "contacts" | "campaigns" | "templates" | "shop" | "settings";
export type RepliesSection = "menus" | "ai" | "hours" | "flows";

interface Props {
  businessId: string;
  agentId?: string;
  overview: WhatsAppStudioOverview | null;
  settings: WhatsAppSettings | null;
  onGo: (tab: WhatsAppTab, section?: RepliesSection) => void;
}

/** Status at a glance, who answers customers and in what order, and how people find the number. */
export function HomeTab({ businessId, agentId, overview, settings, onGo }: Props) {
  const [menus, setMenus] = useState<number | null>(null);
  const [flows, setFlows] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (agentId) {
      templateFlowsApi
        .list(agentId)
        .then((list) => !cancelled && setMenus(list.filter((flow) => flow.channel === "whatsapp" && flow.active).length))
        .catch(() => !cancelled && setMenus(0));
    }
    whatsappStudioApi
      .flows(businessId)
      .then((result) => !cancelled && setFlows(result.flows.filter((flow) => flow.published_version).length))
      .catch(() => !cancelled && setFlows(0));
    return () => {
      cancelled = true;
    };
  }, [agentId, businessId]);

  const aiOn = Boolean(settings?.ai_enabled && settings?.ai_allowed);
  const usage = overview?.usage;
  const steps: Array<{ done: boolean; label: string; detail: string; icon: IconName; go: () => void }> = [
    { done: Boolean(overview?.readiness.official_connection), label: "Connect your number", detail: "Your official WhatsApp Business number is linked.", icon: "plug", go: () => onGo("settings") },
    { done: (menus ?? 0) > 0 || aiOn, label: "Choose who answers", detail: "Turn on a clickable menu, the AI agent, or both.", icon: "bolt", go: () => onGo("replies") },
    { done: (overview?.readiness.approved_templates ?? 0) > 0, label: "Get a message template approved", detail: "Needed to message people first, or after 24 hours of silence.", icon: "book", go: () => onGo("templates") },
    { done: (overview?.counts.opted_in_contacts ?? 0) > 0, label: "Add subscribed contacts", detail: "Campaigns only go to people who agreed.", icon: "team", go: () => onGo("contacts") },
    { done: Boolean(settings?.upi_id), label: "Take payments by UPI (optional)", detail: "Customers pay with any UPI app. No gateway needed.", icon: "key", go: () => onGo("settings") },
  ];
  const done = steps.filter((step) => step.done).length;

  return (
    <div className={styles.panel}>
      <div className={styles.stats}>
        <Stat label="Contacts" value={overview?.counts.contacts} hint={`${(overview?.counts.opted_in_contacts ?? 0).toLocaleString()} subscribed`} />
        <Stat label="Lists" value={overview?.counts.segments} hint="For campaigns" />
        <Stat label="Approved templates" value={overview?.readiness.approved_templates} hint="Ready to send" />
        <Stat label="Messages this month" value={usage?.used} hint={usage?.limit == null ? "No limit on your plan" : `${(usage.remaining ?? 0).toLocaleString()} of ${usage.limit.toLocaleString()} left`} />
      </div>

      {done < steps.length && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h3>Finish setting up</h3>
              <p>{done} of {steps.length} done</p>
            </div>
          </div>
          <div className={local.steps}>
            {steps.map((step) => (
              <button key={step.label} type="button" className={step.done ? local.stepDone : local.step} onClick={step.go}>
                <span className={local.stepIcon}>{step.done ? <Icon name="check" size={16} style={{ strokeWidth: 2.6 }} /> : <Icon name={step.icon} size={16} />}</span>
                <span className={local.stepText}>
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <InsightsPanel businessId={businessId} />

      <div className={local.homeGrid}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h3>When a customer messages you</h3>
              <p>Each message goes down this list, and the first one that fits answers it.</p>
            </div>
          </div>
          <ol className={local.chain}>
            <ChainStep
              icon="bolt"
              title="Advanced flows"
              status={flows === null ? null : flows > 0 ? `${flows} live` : "None"}
              on={(flows ?? 0) > 0}
              detail="Multi-step flows with forms, conditions and delays. Optional; most businesses don't need one."
              action="Open"
              onAction={() => onGo("replies", "flows")}
            />
            <ChainStep
              icon="overview"
              title="Clickable menus"
              status={!agentId ? "Needs an agent" : menus === null ? null : menus > 0 ? `${menus} live` : "None yet"}
              on={(menus ?? 0) > 0}
              detail="Buttons customers tap: answers, products to order, links, or your team. Opens for new customers and on “hi” or “menu”."
              action={(menus ?? 0) > 0 ? "Edit" : "Create one"}
              onAction={() => onGo("replies", "menus")}
            />
            <ChainStep
              icon="bot"
              title="AI agent"
              status={!settings ? null : !settings.ai_allowed ? "Not in plan" : aiOn ? "On" : "Off"}
              on={aiOn}
              detail="Answers anything else in the customer's language, using your products and knowledge base. Can send product photos."
              action={aiOn ? "Settings" : "Turn on"}
              onAction={() => onGo("replies", "ai")}
            />
            <ChainStep
              icon="clock"
              title="Business hours"
              status={!settings ? null : settings.automation.hours.enabled ? (settings.automation.away.enabled ? "Away message on" : "Hours on") : "Always open"}
              on={Boolean(settings?.automation.hours.enabled)}
              detail="Set when you're open. Outside those hours, customers get an away message, and menus and the AI still work."
              action="Set hours"
              onAction={() => onGo("replies", "hours")}
            />
            <ChainStep
              icon="inbox"
              title="You and your team"
              status="Always"
              on
              detail="Anything not answered waits in the inbox. You can take over any chat there and the AI stops for it."
              action="Open inbox"
              href="/inbox"
            />
          </ol>
        </section>

        <ShareCard phone={settings?.number?.phone_number ?? null} />
      </div>
    </div>
  );
}

function ChainStep({ icon, title, status, on, detail, action, onAction, href }: { icon: IconName; title: string; status: string | null; on: boolean; detail: string; action: string; onAction?: () => void; href?: string }) {
  return (
    <li className={local.chainStep}>
      <IconTile name={icon} tone={on ? "green" : "slate"} size="sm" />
      <div className={local.chainText}>
        <div className={local.chainTitle}>
          <strong>{title}</strong>
          {status === null ? <Skeleton width={48} height={18} /> : <span className={`${styles.pill} ${on ? styles.pillOn : styles.pillOff}`}><i aria-hidden /> {status}</span>}
        </div>
        <p>{detail}</p>
      </div>
      {href ? (
        <Link href={href} className={local.linkButton}>{action}</Link>
      ) : (
        <button type="button" className={local.linkButton} onClick={onAction}>{action}</button>
      )}
    </li>
  );
}

/** wa.me link + QR so customers can start a chat: on the website, Instagram bio, packaging, shop counter. */
function ShareCard({ phone }: { phone: string | null }) {
  const { show } = useToast();
  const [message, setMessage] = useState("Hi! I'd like to know more.");
  const [qr, setQr] = useState<{ url: string; qr_data_uri: string; download_filename: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!phone) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      whatsappStudioApi
        .shareQr(phone, message.trim())
        .then((result) => { if (!cancelled) { setQr(result); setFailed(false); } })
        .catch(() => !cancelled && setFailed(true));
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phone, message]);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="share" tone="green" size="sm" /> Get more chats
          </h3>
          <p>A link and QR code that open a chat with you. Put them on your website, Instagram bio, bills and shop counter.</p>
        </div>
      </div>
      {!phone ? (
        <p className={styles.muted}>Connect your number to get your chat link.</p>
      ) : (
        <div className={local.share}>
          <div className={local.qrBox}>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr.qr_data_uri} alt="QR code that opens a WhatsApp chat with you" />
            ) : failed ? (
              <span className={styles.muted}>QR unavailable</span>
            ) : (
              <Skeleton width={150} height={150} />
            )}
          </div>
          <div className={local.shareFields}>
            <Input label="Message filled in for them" value={message} maxLength={200} onChange={(event) => setMessage(event.target.value)} helperText="They can change it before sending. A menu keyword like “menu” opens your menu straight away." />
            <Input label="Your chat link" value={qr?.url ?? ""} readOnly />
          </div>
        </div>
      )}
      {phone && (
        <div className={local.shareActions}>
          <Button
            variant="secondary"
            disabled={!qr}
            leftIcon={<Icon name="link" size={15} />}
            onClick={() => qr && copyText(qr.url).then(() => show("Link copied.", "success"))}
          >
            Copy link
          </Button>
          {qr && (
            <a className={local.linkButton} href={qr.qr_data_uri} download={qr.download_filename}>
              Download QR
            </a>
          )}
          {qr && (
            <a className={local.linkButton} href={qr.url} target="_blank" rel="noreferrer">
              Test it <Icon name="external" size={14} />
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value?: number; hint: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{typeof value === "number" ? value.toLocaleString() : "–"}</span>
      <span className={styles.statHint}>{hint}</span>
    </div>
  );
}
