"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { WhatsAppSettings } from "@/lib/api/whatsapp-studio";
import { Skeleton } from "@/components/ui";
import { Icon, IconTile, type IconName } from "@/components/ui/Icon/Icon";
import { ButtonMenus } from "../../flows/menu/ButtonMenus";
import { ActiveFlowsPanel } from "../ActiveFlowsPanel";
import { AiCard, GroupsCard, VoiceCard } from "./WhatsAppSettingsTab";
import { AwayCard, HoursCard, MissedCallCard } from "./AutomationCards";
import type { RepliesSection } from "./HomeTab";
import styles from "../../instagram/workspace/workspace.module.scss";
import local from "./whatsapp.module.scss";

const FormsScreen = dynamic(() => import("@/app/(dashboard)/channels/whatsapp-studio/forms/page"), { loading: () => <Skeleton height={360} /> });

const SECTIONS: Array<{ value: RepliesSection; icon: IconName; label: string; detail: string }> = [
  { value: "menus", icon: "overview", label: "Clickable menus", detail: "Buttons customers tap. Best for common questions and taking orders." },
  { value: "ai", icon: "bot", label: "AI agent", detail: "Answers anything in the customer's own words and language." },
  { value: "hours", icon: "clock", label: "Hours & away", detail: "Opening hours, an away message and a reply to missed calls." },
  { value: "flows", icon: "bolt", label: "Flows & forms", detail: "Bigger multi-step flows and forms. For advanced needs." },
];

interface Props {
  businessId: string;
  agentId?: string;
  section: RepliesSection;
  onSection: (section: RepliesSection) => void;
  settings: WhatsAppSettings | null;
  onSettings: (next: WhatsAppSettings) => void;
  canAdmin: boolean;
  canManage: boolean;
}

/** Everything that answers customers automatically, in one place. */
export function AutoRepliesTab({ businessId, agentId, section, onSection, settings, onSettings, canAdmin, canManage }: Props) {
  return (
    <div className={styles.panel}>
      <div className={local.sectionPicker} role="tablist" aria-label="Auto-reply types">
        {SECTIONS.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={section === item.value} className={section === item.value ? local.sectionOn : local.section} onClick={() => onSection(item.value)}>
            <IconTile name={item.icon} tone={section === item.value ? "green" : "slate"} size="sm" />
            <span>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </span>
          </button>
        ))}
      </div>

      {section === "menus" && (
        <>
          <ButtonMenus agentId={agentId} channel="whatsapp" canEdit={canManage} />
          <p className={local.footnote}>
            Menus answer before the AI. When a customer types something that isn&apos;t a button, the menu repeats once, then steps aside so the AI (or your team) can answer.
          </p>
        </>
      )}

      {section === "ai" &&
        (settings ? (
          <>
            <AiCard businessId={businessId} settings={settings} canAdmin={canAdmin} onChanged={onSettings} />
            <VoiceCard agentId={agentId} aiOn={settings.ai_enabled && settings.ai_allowed} canAdmin={canAdmin} />
            <GroupsCard businessId={businessId} settings={settings} canAdmin={canAdmin} canManage={canManage} onChanged={onSettings} />
          </>
        ) : (
          <p className={styles.muted}>AI settings couldn&apos;t be loaded. Reconnect your number in Settings and try again.</p>
        ))}

      {section === "hours" &&
        (settings ? (
          <>
            <HoursCard businessId={businessId} settings={settings} canAdmin={canAdmin} onChanged={onSettings} />
            <AwayCard businessId={businessId} settings={settings} canAdmin={canAdmin} onChanged={onSettings} />
            <MissedCallCard businessId={businessId} settings={settings} canAdmin={canAdmin} onChanged={onSettings} />
          </>
        ) : (
          <p className={styles.muted}>These settings couldn&apos;t be loaded. Reconnect your number in Settings and try again.</p>
        ))}

      {section === "flows" && (
        <>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <h3 className={styles.titleWithIcon}>
                  <IconTile name="bolt" tone="green" size="sm" /> Flow builder
                </h3>
                <p>
                  Draw a flow on a canvas when a menu isn&apos;t enough: ask for details and save the answers, branch on what they said, wait before following up,
                  call your own system, or show a WhatsApp form. Flows run before menus and the AI.
                </p>
              </div>
              <Link href="/channels/whatsapp-studio/builder" className={local.linkButton}>
                Open flow builder <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </section>
          <ActiveFlowsPanel businessId={businessId} />
          <div className={local.embedded}>
            <FormsScreen />
          </div>
        </>
      )}
    </div>
  );
}
