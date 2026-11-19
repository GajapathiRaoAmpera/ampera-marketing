"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  adminApi,
  ApiError,
  type AdminUserDetail,
  type AssignablePlanId,
  type BillingInterval,
  type TierId,
  type UserEffectiveSetting,
} from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, EmptyState, Modal, Select, Skeleton, Tabs, Textarea } from "@/components/ui";
import { ApproveDialog } from "@/components/features/admin/ApproveDialog";
import { AccountTrialPanel } from "@/components/features/admin/TrialPanel";
import { SettingValueEditor, type SettingChange } from "@/components/features/admin/SettingValueEditor";
import {
  AccountStatusPill,
  Meter,
  PageHeader,
  Panel,
  Pill,
  TIER_NAME,
  TierPill,
  adminStyles,
  formatDate,
} from "@/components/features/admin/AdminUi";
import styles from "./page.module.scss";

type TabId = "overview" | "features" | "limits" | "speed" | "businesses";

// The most Instagram itself allows, per kind and window. An empty cap means this.
const PLATFORM_MAX = {
  private_replies: { minute: 12, hour: 750, day: 10000 },
  public_replies: { minute: 5, hour: 300, day: 3000 },
  dms: { minute: 16, hour: 1000, day: 10000 },
} as const;
const KIND_LABEL = {
  private_replies: ["Private replies", "The DM sent when someone comments"],
  public_replies: ["Public replies", "Replies posted under a comment"],
  dms: ["Automated DMs", "Follow-up messages inside a conversation"],
} as const;
const WINDOWS = ["minute", "hour", "day"] as const;

const AI_AND_AUTOMATION = ["ai_replies_enabled", "instagram_automations_enabled"];
// The account-level controls an admin reaches for most, shown on the Overview.
const ACCESS_KEYS = [
  "max_instagram_connections",
  "max_instagram_connections_per_business",
  "max_whatsapp_connections",
  "ai_replies_enabled",
  "instagram_automations_enabled",
];

function sourceLabel(setting: UserEffectiveSetting, planId: TierId): string {
  if (setting.source === "user") return "Custom for this account";
  if (setting.source === "plan") return `From the ${TIER_NAME[planId]} plan`;
  return "Platform default";
}

export default function AccountPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { show } = useToast();
  const userId = params.id;

  const account = useAsync(() => adminApi.getUser(userId), [userId]);
  const settings = useAsync(() => adminApi.getUserEffectiveSettings(userId), [userId]);
  // ?tab=features opens straight onto a tab, so a link can point at one.
  const requested = useSearchParams().get("tab");
  const [tab, setTab] = useState<TabId>(
    (["overview", "features", "limits", "speed", "businesses"] as const).find((id) => id === requested) ?? "overview"
  );
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [isTrialOpen, setIsTrialOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPlan, setNewPlan] = useState<AssignablePlanId>("free");
  const [newInterval, setNewInterval] = useState<BillingInterval | "">("monthly");

  const user = account.data;

  function reload() {
    account.refresh();
    settings.refresh();
  }

  async function act(action: () => Promise<unknown>, done: string, failed: string) {
    setBusy(true);
    try {
      await action();
      show(done, "success");
      reload();
      return true;
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : failed, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changeSetting(setting: UserEffectiveSetting, change: SettingChange) {
    if (change.kind === "set") await adminApi.setUserSettingOverride(setting.key, userId, change.value);
    else if (change.kind === "unlimited") await adminApi.setUserSettingOverride(setting.key, userId, null);
    else await adminApi.removeUserSettingOverride(setting.key, userId);
    show(
      change.kind === "clear" ? `"${setting.label}" now follows the plan again.` : `"${setting.label}" updated.`,
      "success"
    );
    reload();
  }

  if (account.isLoading || !user) {
    if (!account.isLoading && !user) {
      return (
        <EmptyState
          title="Account not found"
          action={<Button onClick={() => router.push("/admin/users")}>Back to accounts</Button>}
        />
      );
    }
    return <Skeleton height={420} />;
  }

  const pending = user.approval_status === "pending";
  const plan = user.plan_id;
  const all = settings.data ?? [];
  const byCategory = (category: string) => all.filter((item) => item.category === category);

  return (
    <>
      <PageHeader
        onBack={() => router.push("/admin/users")}
        backLabel="All accounts"
        title={user.name || user.email}
        description={user.name ? user.email : undefined}
        actions={
          <>
            {pending && <Button onClick={() => setIsApproveOpen(true)}>Approve…</Button>}
            {user.disabled ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => act(() => adminApi.enableUser(userId), "Account resumed.", "Couldn't resume this account.")}
              >
                Resume account
              </Button>
            ) : (
              !user.is_platform_admin && (
                <Button variant="outline-danger" onClick={() => setIsPauseOpen(true)}>
                  Pause account
                </Button>
              )
            )}
          </>
        }
      />

      <div className={styles.pills}>
        <AccountStatusPill user={user} />
        <TierPill tier={plan} />
        {user.is_platform_admin && <Pill tone="brand">Platform admin</Pill>}
        <span className={styles.joined}>Joined {formatDate(user.created_at)}</span>
      </div>

      {pending && (
        <div className={adminStyles.callout}>
          <div className={adminStyles.calloutText}>
            <div className={adminStyles.calloutTitle}>Waiting for your approval</div>
            <div className={adminStyles.calloutBody}>
              Until approved this account can use 3 AI replies and 10 automated replies, for life, and nothing more.
            </div>
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        <Tabs<TabId>
          variant="underline"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "features", label: "Features" },
            { value: "limits", label: "Limits" },
            { value: "speed", label: "Sending speed" },
            { value: "businesses", label: `Businesses (${user.businesses.length})` },
          ]}
        />
      </div>

      {tab === "overview" && (
        <Panel
          title="Accounts and AI access"
          description="How many Instagram and WhatsApp accounts this customer can connect, and whether they get the AI agent. Changes apply to this account only."
        >
          <SettingList
            items={ACCESS_KEYS.map((key) => all.find((item) => item.key === key)).filter(
              (item): item is UserEffectiveSetting => Boolean(item)
            )}
            plan={plan}
            loading={settings.isLoading}
            onChange={changeSetting}
            usage={user.usage}
          />
        </Panel>
      )}

      {tab === "overview" && (
        <Overview
          user={user}
          pending={pending}
          newPlan={newPlan}
          onNewPlan={setNewPlan}
          newInterval={newInterval}
          onNewInterval={setNewInterval}
          busy={busy}
          onChangePlan={() =>
            act(
              () => adminApi.changePlan(userId, newPlan, newPlan !== "free" && newInterval ? newInterval : undefined),
              `Moved to the ${TIER_NAME[newPlan]} plan.`,
              "Couldn't change the plan."
            )
          }
          onBackToTrial={() => setIsTrialOpen(true)}
          onTrialChanged={reload}
        />
      )}

      {tab === "features" && (
        <>
          <Panel
            title="AI and automation"
            description="Turn these off and the customer sees them locked. The AI uses the platform's OpenAI / Gemini keys, never the customer's."
          >
            <SettingList
              items={all.filter((item) => AI_AND_AUTOMATION.includes(item.key))}
              plan={plan}
              loading={settings.isLoading}
              onChange={changeSetting}
            />
          </Panel>
          <Panel title="Channels" description="Which messaging channels this account can connect and use.">
            <SettingList items={byCategory("channel")} plan={plan} loading={settings.isLoading} onChange={changeSetting} />
          </Panel>
          <Panel title="Tools">
            <SettingList
              items={byCategory("feature").filter((item) => !AI_AND_AUTOMATION.includes(item.key))}
              plan={plan}
              loading={settings.isLoading}
              onChange={changeSetting}
            />
          </Panel>
        </>
      )}

      {tab === "limits" && (
        <Panel
          title="Limits"
          description="How much this account may use. Set a number only for this account to override its plan; leave the plan's value alone otherwise."
        >
          <SettingList
            items={byCategory("limit")}
            plan={plan}
            loading={settings.isLoading}
            onChange={changeSetting}
            usage={user.usage}
          />
        </Panel>
      )}

      {tab === "speed" && (
        <>
          <p className={styles.speedIntro}>
            The most this account&apos;s automations may send per minute, hour and day. The account holder can set their
            own limits lower, never higher. Empty means the platform maximum, which is Instagram-safe and is the highest
            any cap can be.
          </p>
          {(Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>).map((kind) => (
            <Panel key={kind} title={KIND_LABEL[kind][0]} description={KIND_LABEL[kind][1]}>
              <SettingList
                items={WINDOWS.map((window) => all.find((item) => item.key === `ig_${kind}_per_${window}`)).filter(
                  (item): item is UserEffectiveSetting => Boolean(item)
                )}
                plan={plan}
                loading={settings.isLoading}
                onChange={changeSetting}
                rateMax={(item) => PLATFORM_MAX[kind][item.key.endsWith("minute") ? "minute" : item.key.endsWith("hour") ? "hour" : "day"]}
              />
            </Panel>
          ))}
        </>
      )}

      {tab === "businesses" && (
        <Panel title="Businesses" flush>
          {user.businesses.length === 0 ? (
            <EmptyState title="No businesses yet" />
          ) : (
            <ul className={styles.businesses}>
              {user.businesses.map((business) => (
                <li key={business.id}>
                  <Link href={`/admin/businesses/${business.id}`} className={styles.businessRow}>
                    <span className={styles.businessName}>{business.name}</span>
                    {business.agent_status && (
                      <Pill tone={business.agent_status === "running" ? "active" : "pending"}>{business.agent_status}</Pill>
                    )}
                    <span className={styles.businessDate}>Created {formatDate(business.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <ApproveDialog
        account={isApproveOpen ? { id: userId, name: user.name, email: user.email } : null}
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onDone={() => {
          setIsApproveOpen(false);
          reload();
        }}
      />

      <Modal
        isOpen={isTrialOpen}
        onClose={() => setIsTrialOpen(false)}
        title="Send back to the trial tier?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsTrialOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={busy}
              onClick={async () => {
                const ok = await act(() => adminApi.unapproveUser(userId), "Back on the trial tier.", "Couldn't change this account.");
                if (ok) setIsTrialOpen(false);
              }}
            >
              Send back to trial
            </Button>
          </>
        }
      >
        <p className={styles.modalCopy}>
          The account drops to 3 AI replies and 10 automated replies <strong>for life</strong>. Any it already used while
          on the trial still count, so it may have none left until you approve it again.
        </p>
      </Modal>

      <Modal
        isOpen={isPauseOpen}
        onClose={() => setIsPauseOpen(false)}
        title="Pause this account?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsPauseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={busy}
              onClick={async () => {
                if (!reason.trim()) {
                  show("A reason is required.", "error");
                  return;
                }
                const ok = await act(
                  () => adminApi.disableUser(userId, reason.trim()),
                  "Account paused.",
                  "Couldn't pause this account."
                );
                if (ok) {
                  setIsPauseOpen(false);
                  setReason("");
                }
              }}
            >
              Pause account
            </Button>
          </>
        }
      >
        <p className={styles.modalCopy}>
          This person can no longer sign in, and the action is logged. You can resume the account at any time.
        </p>
        <Textarea
          label="Reason (required)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Reported for spam"
          rows={3}
        />
      </Modal>
    </>
  );
}

// ----------------------------------------------------------------------------

const INTERVAL_OPTIONS: Array<{ value: BillingInterval; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly (3 months)" },
  { value: "half_yearly", label: "Half-yearly (6 months)" },
  { value: "annual", label: "Annual (12 months)" },
];

function Overview({
  user, pending, newPlan, onNewPlan, newInterval, onNewInterval, busy, onChangePlan, onBackToTrial, onTrialChanged,
}: {
  user: AdminUserDetail;
  pending: boolean;
  newPlan: AssignablePlanId;
  onNewPlan: (plan: AssignablePlanId) => void;
  newInterval: BillingInterval | "";
  onNewInterval: (interval: BillingInterval | "") => void;
  busy: boolean;
  onChangePlan: () => void;
  onBackToTrial: () => void;
  onTrialChanged: () => void;
}) {
  return (
    <div className={adminStyles.twoCol}>
      <div>
        <Panel
          title="Used so far"
          description={pending ? "A trial allowance is for life; it never resets." : "Resets on the 1st of each month."}
        >
          <div className={adminStyles.stack}>
            <Meter label="AI replies" meter={user.usage.ai_replies} note="Replies the AI wrote, on any channel. These cost LLM tokens." />
            <Meter label="Automated replies" meter={user.usage.automated_replies} note="Comment and DM automations. No AI involved." />
          </div>
        </Panel>

        <Panel title="Activity">
          <dl className={styles.facts}>
            <div>
              <dt>Messages today</dt>
              <dd>{user.messages_today.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Last 7 days</dt>
              <dd>{user.messages_week.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Last 30 days</dt>
              <dd>{user.messages_month.toLocaleString()}</dd>
            </div>
            <div>
              <dt>LLM tokens, 30 days</dt>
              <dd>{user.token_usage_month.total_tokens.toLocaleString()}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <div>
        <AccountTrialPanel userId={user.id} onChanged={onTrialChanged} />

        <Panel title="Plan">
          {pending ? (
            <p className={styles.planText}>
              On the <strong>trial tier</strong> until approved. Approving puts the account on a plan and lifts the trial limits.
            </p>
          ) : (
            <>
              <p className={styles.planText}>
                Currently on <strong>{TIER_NAME[user.plan_id]}</strong>. Its numbers come from the plan, unless you override them for
                this account.
              </p>
              <div className={styles.planChange}>
                <Select
                  label="Move to"
                  value={newPlan}
                  onChange={(event) => onNewPlan(event.target.value as AssignablePlanId)}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
                {newPlan !== "free" && (
                  <Select
                    label="Billing cycle"
                    value={newInterval}
                    onChange={(event) => onNewInterval(event.target.value as BillingInterval | "")}
                  >
                    {INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value="">No end date</option>
                  </Select>
                )}
                <Button
                  variant="secondary"
                  disabled={busy || (newPlan === user.plan_id && !newInterval)}
                  onClick={onChangePlan}
                >
                  Change plan
                </Button>
              </div>
              {newPlan !== "free" && newInterval && (
                <p className={styles.planText}>
                  The plan runs for one {newInterval.replace("_", "-")} cycle from today and then counts down to lapse.
                </p>
              )}
              <Button variant="ghost" size="sm" onClick={onBackToTrial}>
                Send back to the trial tier
              </Button>
            </>
          )}
        </Panel>

        <Panel title="Account">
          <dl className={styles.facts}>
            <div>
              <dt>Email</dt>
              <dd>{user.email_verified ? "Verified" : "Not verified"}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{formatDate(user.created_at)}</dd>
            </div>
            {user.approved_at && (
              <div>
                <dt>Approved</dt>
                <dd>{formatDate(user.approved_at)}</dd>
              </div>
            )}
            <div>
              <dt>Businesses</dt>
              <dd>{user.businesses.length}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

function SettingList({
  items, plan, loading, onChange, usage, rateMax,
}: {
  items: UserEffectiveSetting[];
  plan: TierId;
  loading: boolean;
  onChange: (setting: UserEffectiveSetting, change: SettingChange) => Promise<void>;
  usage?: AdminUserDetail["usage"];
  rateMax?: (setting: UserEffectiveSetting) => number;
}) {
  if (loading) return <Skeleton height={120} />;
  if (items.length === 0) return <EmptyState title="Nothing here" />;

  return (
    <ul className={styles.settings}>
      {items.map((item) => {
        const meter =
          usage && item.key === "max_ai_replies_per_month"
            ? usage.ai_replies
            : usage && item.key === "max_automated_replies_per_month"
              ? usage.automated_replies
              : null;
        const rate = item.category === "rate";
        return (
          <li key={item.key} className={styles.setting}>
            <div className={styles.settingText}>
              <div className={styles.settingLabel}>
                {item.label}
                {item.type === "bool" && !item.effective_value && <span className={styles.locked}>Locked for the customer</span>}
              </div>
              <div className={styles.settingDesc}>{item.description}</div>
              <div className={styles.settingSource}>{sourceLabel(item, plan)}</div>
              {meter && (
                <div className={styles.settingMeter}>
                  <Meter label="Used" meter={meter} />
                </div>
              )}
            </div>
            <div className={styles.settingControl}>
              <SettingValueEditor
                type={item.type}
                label={item.label}
                value={item.effective_value}
                isCustom={item.source === "user"}
                emptyMeans={rate ? "platform maximum" : "unlimited"}
                resetLabel={item.source === "user" ? "Follow the plan" : "Use default"}
                placeholder={rate && rateMax ? `Up to ${rateMax(item).toLocaleString()}` : undefined}
                max={rate && rateMax ? rateMax(item) : undefined}
                onChange={(change) => onChange(item, change)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
