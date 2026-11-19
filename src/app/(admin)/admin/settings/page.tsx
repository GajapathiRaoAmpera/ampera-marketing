"use client";

import { useState } from "react";
import { adminApi, type SettingValue, type SettingWithOverrides, type TierId } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Button, EmptyState, Skeleton, Tabs } from "@/components/ui";
import { CreateSettingModal } from "@/components/features/admin/CreateSettingModal";
import { TrialDefaultPanel } from "@/components/features/admin/TrialPanel";
import { SettingValueEditor, type SettingChange } from "@/components/features/admin/SettingValueEditor";
import { PageHeader, Panel, TIER_NAME } from "@/components/features/admin/AdminUi";
import styles from "./page.module.scss";

type View = TierId | "platform" | "compare";

const TIERS: TierId[] = ["trial", "free", "pro", "enterprise", "expired"];
const AI_AND_AUTOMATION = [
  "ai_replies_enabled",
  "instagram_automations_enabled",
  "max_ai_replies_per_month",
  "max_automated_replies_per_month",
];

const PLATFORM_MAX: Record<string, Record<string, number>> = {
  private_replies: { minute: 12, hour: 750, day: 10000 },
  public_replies: { minute: 5, hour: 300, day: 3000 },
  dms: { minute: 16, hour: 1000, day: 10000 },
};
const KINDS: Array<[string, string]> = [
  ["private_replies", "Private replies"],
  ["public_replies", "Public replies"],
  ["dms", "Automated DMs"],
];

const BLURB: Record<View, string> = {
  trial: "Accounts waiting for approval. These are hard, lifetime allowances: a taste of the product, nothing more.",
  free: "Approved accounts on the Free plan. Anything left empty follows the platform default.",
  pro: "Accounts on the Pro plan. Anything left empty follows the platform default.",
  enterprise: "Accounts on the Enterprise plan. Anything left empty follows the platform default.",
  expired: "Accounts whose free period is over and have no paid plan. Locked down by default until they subscribe; loosen anything here to give them a little room.",
  platform: "What every plan gets unless it sets its own value. Change this with care: it affects everyone who has not been given a value of their own.",
  compare: "Every plan side by side. Bold means the plan has its own value.",
};

function show(value: SettingValue, type: string): string {
  if (type === "bool") return value ? "On" : "Locked";
  return value === null ? "No limit" : Number(value).toLocaleString();
}

export default function PlansPage() {
  const list = useAsync(() => adminApi.listSettings(), []);
  const [view, setView] = useState<View>("free");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const settings = list.data ?? [];

  async function change(setting: SettingWithOverrides, change: SettingChange) {
    if (view === "compare") return;
    if (view === "platform") {
      await adminApi.updateGlobalSetting(setting.key, change.kind === "set" ? change.value : null);
    } else if (change.kind === "set") {
      await adminApi.updatePlanSettingOverride(setting.key, view, change.value);
    } else if (change.kind === "unlimited") {
      await adminApi.setPlanSettingUnlimited(setting.key, view);
    } else {
      await adminApi.updatePlanSettingOverride(setting.key, view, null);
    }
    list.refresh();
  }

  const tier = TIERS.includes(view as TierId) ? (view as TierId) : null;
  const inView = (category: string) => settings.filter((item) => item.category === category);

  const rows = (items: SettingWithOverrides[], rate = false) => (
    <ul className={styles.rows}>
      {items.map((item) => {
        const custom = tier ? item.plan_values[tier]?.custom : false;
        const value = tier ? item.plan_values[tier].value : item.effective_global;
        const kindWindow = item.key.match(/^ig_(.+)_per_(minute|hour|day)$/);
        const max = rate && kindWindow ? PLATFORM_MAX[kindWindow[1]]?.[kindWindow[2]] : undefined;
        return (
          <li key={item.key} className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{item.label}</div>
              <div className={styles.rowDesc}>{item.description}</div>
              <div className={styles.rowSource}>
                {view === "platform" ? "Applies to every plan without its own value" : custom ? `Set for the ${TIER_NAME[tier!]} plan` : "Follows the platform default"}
              </div>
            </div>
            <div className={styles.rowControl}>
              <SettingValueEditor
                type={item.type}
                label={item.label}
                value={value}
                isCustom={Boolean(custom)}
                emptyMeans={rate ? "platform maximum" : "unlimited"}
                resetLabel="Follow default"
                placeholder={max ? `Up to ${max.toLocaleString()}` : undefined}
                max={max}
                onChange={(next) => change(item, next)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <PageHeader
        title="Plans & limits"
        description="Decide what each plan includes. An account follows its plan unless you override it on its own page."
        actions={
          <Button variant="secondary" onClick={() => setIsCreateOpen(true)}>
            New setting
          </Button>
        }
      />

      <div className={styles.tabs}>
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            ...TIERS.map((id) => ({ value: id as View, label: TIER_NAME[id] })),
            { value: "platform", label: "Platform default" },
            { value: "compare", label: "Compare" },
          ]}
        />
      </div>
      <p className={styles.blurb}>{BLURB[view]}</p>

      {list.isLoading ? (
        <Skeleton height={400} />
      ) : settings.length === 0 ? (
        <EmptyState title="No settings yet" />
      ) : view === "compare" ? (
        <Compare settings={settings} />
      ) : (
        <>
          {(view === "free" || view === "platform") && <TrialDefaultPanel />}
          <Panel title="AI and automation" description="What the AI and the automations may do, and how much.">
            {rows(AI_AND_AUTOMATION.map((key) => settings.find((s) => s.key === key)).filter((s): s is SettingWithOverrides => Boolean(s)))}
          </Panel>
          <Panel title="Channels" description="Which messaging channels the account can use. Off shows as locked.">
            {rows(inView("channel"))}
          </Panel>
          <Panel title="Usage limits">
            {rows(inView("limit").filter((s) => !AI_AND_AUTOMATION.includes(s.key) && s.key !== "free_trial_days"))}
          </Panel>
          <Panel title="Tools">
            {rows(inView("feature").filter((s) => !AI_AND_AUTOMATION.includes(s.key)))}
          </Panel>
          {KINDS.map(([kind, label]) => (
            <Panel
              key={kind}
              title={`Instagram sending speed: ${label.toLowerCase()}`}
              description="The most the account's automations send. Empty is the Instagram-safe platform maximum, the highest any cap can be."
            >
              {rows(
                (["minute", "hour", "day"] as const)
                  .map((window) => settings.find((s) => s.key === `ig_${kind}_per_${window}`))
                  .filter((s): s is SettingWithOverrides => Boolean(s)),
                true
              )}
            </Panel>
          ))}
        </>
      )}

      <CreateSettingModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreated={list.refresh} />
    </>
  );
}

function Compare({ settings }: { settings: SettingWithOverrides[] }) {
  const groups: Array<[string, string]> = [
    ["feature", "Features and AI"],
    ["channel", "Channels"],
    ["limit", "Limits"],
    ["rate", "Instagram sending speed"],
  ];
  return (
    <div className={styles.compareWrap}>
      <table className={styles.compare}>
        <thead>
          <tr>
            <th scope="col">Setting</th>
            <th scope="col">Platform</th>
            {TIERS.map((id) => (
              <th key={id} scope="col">
                {TIER_NAME[id]}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map(([category, title]) => (
          <tbody key={category}>
            <tr className={styles.groupRow}>
              <th colSpan={6} scope="colgroup">
                {title}
              </th>
            </tr>
            {settings
              .filter((item) => item.category === category)
              .map((item) => (
                <tr key={item.key}>
                  <th scope="row">{item.label}</th>
                  <td>{show(item.effective_global, item.type)}</td>
                  {TIERS.map((id) => {
                    const cell = item.plan_values[id];
                    return (
                      <td key={id} className={cell.custom ? styles.custom : styles.inherited}>
                        {show(cell.value, item.type)}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
