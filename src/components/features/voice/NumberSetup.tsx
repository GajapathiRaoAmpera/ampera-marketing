"use client";

import Link from "next/link";
import { copyText } from "@/lib/utils/browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Badge, Button, Card, EmptyState, Input, Skeleton, Switch } from "@/components/ui";
import { voiceCallsApi, voiceCenterApi, ApiError, type VoiceProviderOption, type VoiceStatus } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { CheckMark } from "./VoiceIcons";
import styles from "./VoiceCenter.module.scss";

interface NumberSetupProps {
  status: VoiceStatus | null;
  agentId?: string | null;
  onChanged: () => void;
}

type Market = "india" | "global";
type WizardStep = 1 | 2 | 3;

const WIZARD_STEPS = ["Choose provider", "Enter details", "Incoming calls"];

const FIT_BADGE: Record<VoiceProviderOption["india_fit"], { label: string; variant: "success" | "info" | "neutral" }> = {
  best: { label: "Built for India", variant: "success" },
  good: { label: "Works well in India", variant: "info" },
  limited: { label: "Costly in India", variant: "neutral" },
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await copyText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show("Couldn't copy. Select the address and copy it by hand.", "error");
    }
  }

  return (
    <div className={styles.listRow}>
      <div className={styles.listMain}>
        <div className={styles.listTitle}>{label}</div>
        <code className={styles.url}>{value}</code>
      </div>
      <Button size="sm" variant="secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
    </div>
  );
}

/** The two addresses a provider needs so incoming calls reach the agent. */
function IncomingAddresses({ status, help }: { status: VoiceStatus; help?: string }) {
  if (!status.webhooks) return <Skeleton height={120} />;
  return (
    <>
      <div className={styles.sectionHint}>
        {help || "Set these two addresses on your phone number in your provider's console."} Outgoing calls work without this.
      </div>
      <div className={styles.list} style={{ marginTop: "var(--space-3)" }}>
        <CopyRow label="When a call comes in (POST)" value={status.webhooks.answer} />
        <CopyRow label="When a call ends or its status changes (POST)" value={status.webhooks.status} />
      </div>
      {status.provider !== "twilio" && (
        <p className={styles.muted} style={{ marginTop: "var(--space-3)" }}>
          These addresses contain a secret key for your account. Don&apos;t share them.
        </p>
      )}
    </>
  );
}

/**
 * Everything about the phone number in one place. With no number it is a
 * three-screen wizard, one decision per screen. With a number it shows that
 * number and what can be changed, and the same wizard replaces it.
 */
export function NumberSetup({ status, agentId, onChanged }: NumberSetupProps) {
  const { show } = useToast();
  const isConnected = Boolean(status?.connected);
  const isLinked = Boolean(status?.agent_id && status.agent_id === agentId);
  const capabilities = status?.capabilities ?? [];

  const [catalog, setCatalog] = useState<{ reviewed: string; providers: VoiceProviderOption[] } | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Open while there is no number, or while the person is replacing theirs.
  const [isReplacing, setIsReplacing] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [market, setMarket] = useState<Market>("india");
  const [chosen, setChosen] = useState("");
  const [number, setNumber] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "connect" | "link" | "record">("");
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);

  useEffect(() => {
    let canceled = false;
    voiceCenterApi.providers()
      .then((value) => { if (!canceled) { setCatalog(value); setCatalogFailed(false); } })
      .catch(() => { if (!canceled) setCatalogFailed(true); });
    return () => { canceled = true; };
  }, [attempt]);

  const loadCatalog = useCallback(() => {
    setCatalogFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  const current = catalog?.providers.find((provider) => provider.key === status?.provider);
  const selected = catalog?.providers.find((provider) => provider.key === chosen);
  const visible = useMemo(() => (catalog?.providers ?? []).filter((provider) =>
    // Twilio is listed for India too: it works there, at a higher price.
    market === "india" ? provider.market !== "global" || provider.key === "twilio" : provider.market !== "india"),
  [catalog, market]);
  const connectable = visible.filter((provider) => provider.connectable);
  const comingLater = visible.filter((provider) => !provider.connectable);

  const cleanNumber = number.replace(/[\s\-().]/g, "");
  const isNumberValid = /^\+[1-9]\d{7,14}$/.test(cleanNumber);
  const isFormComplete = Boolean(selected && isNumberValid && selected.fields.every((field) => credentials[field.key]?.trim()));

  function startWizard() {
    setIsReplacing(true);
    setStep(1);
    setChosen("");
    setNumber("");
    setCredentials({});
    setError("");
  }

  async function connect() {
    if (!selected) return;
    setBusy("connect");
    setError("");
    try {
      await voiceCallsApi.connect(selected.key, cleanNumber, credentials);
      // A number with no agent behind it rings out, so link this business's agent in the same breath.
      if (agentId) {
        try {
          await voiceCallsApi.linkAgent(agentId);
        } catch {
          show("Number connected, but the agent couldn't be linked. Use “Link agent” below.", "warning");
        }
      }
      setIsReplacing(true);  // keep the wizard open on its last screen now that a number exists
      setStep(3);
      onChanged();
    } catch (err) {
      // Shown beside the form, where the fix is, not only in a passing toast.
      setError(err instanceof ApiError ? err.userMessage : "Couldn't connect. Check the details and try again.");
    } finally {
      setBusy("");
    }
  }

  async function run(kind: "link" | "record", action: () => Promise<unknown>, success: string, failure: string) {
    setBusy(kind);
    try {
      await action();
      show(success, "success");
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : failure, "error");
    } finally {
      setBusy("");
    }
  }

  async function disconnect() {
    try {
      await voiceCallsApi.disconnect();
      show("Voice calling disconnected.", "default");
      onChanged();
    } catch {
      show("Couldn't disconnect. Please try again.", "error");
    }
  }

  // ── The wizard ──
  if (!isConnected || isReplacing) {
    return (
      <div className={styles.wizard}>
        <ol className={styles.wizardRail}>
          {WIZARD_STEPS.map((label, index) => {
            const position = (index + 1) as WizardStep;
            return (
              <li key={label} data-state={position < step ? "done" : position === step ? "current" : "todo"}>
                <span className={styles.wizardDot} aria-hidden>{position < step ? <CheckMark size={14} /> : position}</span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>

        <Card className={styles.wizardPanel}>
          {step === 1 && (
            <>
              <h2 className={styles.wizardTitle}>Which phone provider do you use?</h2>
              <p className={styles.wizardLead}>
                The provider gives you the phone number and carries the calls. Pick the one your number is with. No account yet? Choose one, sign up on its site, then come back.
              </p>

              <div className={styles.segmented} role="tablist" aria-label="Where you call">
                {([["india", "I call people in India"], ["global", "I call other countries"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={market === value}
                    data-active={market === value || undefined}
                    onClick={() => { setMarket(value); setChosen(""); }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {catalogFailed ? (
                <EmptyState title="Couldn't load providers" description="Check your connection and try again." action={<Button onClick={loadCatalog}>Try again</Button>} />
              ) : !catalog ? (
                <Skeleton height={220} />
              ) : (
                <>
                  <div className={styles.choiceList} role="radiogroup" aria-label="Phone provider">
                    {connectable.map((provider) => (
                      <button
                        key={provider.key}
                        type="button"
                        role="radio"
                        aria-checked={chosen === provider.key}
                        className={clsx(styles.choice, chosen === provider.key && styles.choiceOn)}
                        onClick={() => { setChosen(provider.key); setCredentials({}); setError(""); }}
                      >
                        <span className={styles.choiceRadio} aria-hidden />
                        <span className={styles.choiceBody}>
                          <span className={styles.choiceName}>
                            {provider.name}
                            {market === "india" && <Badge variant={FIT_BADGE[provider.india_fit].variant}>{FIT_BADGE[provider.india_fit].label}</Badge>}
                            {isConnected && provider.key === status?.provider && <Badge variant="brand">Your current provider</Badge>}
                          </span>
                          <span className={styles.choiceNote}>{provider.summary}</span>
                          <span className={styles.choiceNote}>{provider.pricing} · Free trial: {provider.trial}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {comingLater.length > 0 && (
                    <p className={styles.muted} style={{ marginTop: "var(--space-3)" }}>
                      Not connectable yet: {comingLater.map((provider) => provider.name).join(", ")}. Prices are indicative, last reviewed {catalog.reviewed}.
                    </p>
                  )}
                </>
              )}

              <div className={styles.wizardFooter}>
                {isConnected ? <Button variant="ghost" onClick={() => setIsReplacing(false)}>Cancel</Button> : <span />}
                <Button onClick={() => setStep(2)} disabled={!selected}>Continue</Button>
              </div>
            </>
          )}

          {step === 2 && selected && (
            <>
              <h2 className={styles.wizardTitle}>Enter your {selected.name} details</h2>
              <p className={styles.wizardLead}>
                {selected.url
                  ? <>You&apos;ll find these in your <a href={selected.url} target="_blank" rel="noopener noreferrer">{selected.name} account ↗</a>. </>
                  : <>You&apos;ll find these in your {selected.name} account. </>}
                {selected.setup}
              </p>

              <form className={styles.wizardForm} onSubmit={(e) => { e.preventDefault(); if (isFormComplete) void connect(); }}>
                <Input
                  label={`Your phone number on ${selected.name}`}
                  type="tel"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder={market === "india" ? "+918012345678" : "+15551234567"}
                  errorText={number && !isNumberValid ? "Include the country code, for example +91" : undefined}
                  helperText="With the country code, no spaces needed."
                  required
                />
                {selected.fields.map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                    value={credentials[field.key] ?? ""}
                    onChange={(e) => setCredentials((value) => ({ ...value, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    helperText={field.help}
                    required
                  />
                ))}
                {error && <div className={styles.errorBox} role="alert">{error}</div>}
                <p className={styles.muted}>We check these with {selected.name} before saving. Secrets are stored encrypted.</p>
                <div className={styles.wizardFooter}>
                  <Button type="button" variant="ghost" onClick={() => { setStep(1); setError(""); }}>Back</Button>
                  <Button type="submit" isLoading={busy === "connect"} disabled={!isFormComplete}>Connect number</Button>
                </div>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <div className={styles.wizardSuccess} aria-hidden><CheckMark size={24} /></div>
              <h2 className={styles.wizardTitle}>{status?.from_number ?? "Your number"} is connected</h2>
              <p className={styles.wizardLead}>
                You can make outgoing calls right now. One last thing if you also want your agent to answer incoming calls:
              </p>
              {status ? <IncomingAddresses status={status} help={current?.inbound_help} /> : <Skeleton height={120} />}
              <div className={styles.wizardFooter}>
                <Button variant="ghost" onClick={() => setIsReplacing(false)}>Number settings</Button>
                <Link href="/channels/voice">
                  <Button>Go to call center</Button>
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // ── A number is connected ──
  return (
    <div className={styles.stack}>
      <Card>
        <div className={styles.ruleHeader}>
          <div>
            <div className={styles.numberLine}>
              {status?.from_number} <Badge variant="brand">{status?.provider_name ?? "Twilio"}</Badge>
            </div>
            <div className={styles.sectionHint}>
              {isLinked
                ? "Connected. Your agent answers and places calls on this number."
                : status?.agent_id
                  ? "Connected, but a different business's agent is answering this number."
                  : "Connected, but no agent is answering yet."}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", flexShrink: 0 }}>
            <Button variant="secondary" onClick={startWizard}>Change number or provider</Button>
            <Button variant="outline-danger" onClick={() => setIsConfirmingDisconnect(true)}>Disconnect</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className={styles.ruleHeader}>
          <div>
            <div className={styles.sectionTitle}>AI agent on this number</div>
            <div className={styles.sectionHint}>
              {isLinked
                ? "This business's agent answers incoming calls and places outgoing ones."
                : status?.agent_id
                  ? "An agent from a different business is on this number. Switch to this business's agent, or remove it."
                  : "No agent is linked, so calls are not answered or placed."}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", flexShrink: 0 }}>
            {!isLinked && agentId && (
              <Button
                isLoading={busy === "link"}
                onClick={() => run("link", () => voiceCallsApi.linkAgent(agentId), "Agent linked. It will answer the next call.", "Couldn't link the agent.")}
              >
                {status?.agent_id ? "Use this business's agent" : "Link agent"}
              </Button>
            )}
            {isLinked && (
              <Link href="/agent-config">
                <Button variant="secondary">Edit agent</Button>
              </Link>
            )}
            {status?.agent_id && <Button variant="outline-danger" onClick={() => setIsConfirmingUnlink(true)}>Remove agent</Button>}
          </div>
        </div>
      </Card>

      <Card id="incoming">
        <div className={styles.sectionTitle}>Receive incoming calls</div>
        {status && <IncomingAddresses status={status} help={current?.inbound_help} />}
      </Card>

      <Card>
        <div className={styles.ruleHeader}>
          <div>
            <div className={styles.sectionTitle}>Record calls</div>
            <div className={styles.sectionHint}>
              {capabilities.includes("recording")
                ? `Recordings are playable from each call's page${status?.provider === "plivo" ? " (Plivo records real-time calls)" : ""}. Tell callers they are being recorded where the law requires it; you can add that line under Rules.`
                : `Call recording isn't available on ${status?.provider_name}. Every call still gets a full transcript and summary. Recording needs a Twilio or Plivo number.`}
            </div>
          </div>
          <Switch
            checked={Boolean(status?.record_calls)}
            disabled={busy === "record" || !capabilities.includes("recording")}
            aria-label="Record calls"
            onChange={(value) => run(
              "record",
              () => voiceCallsApi.updateStreamingSettings({ streaming_enabled: Boolean(status?.streaming_enabled), record_calls: value }),
              value ? "Call recording on." : "Call recording off.",
              "Couldn't update call recording.",
            )}
          />
        </div>
      </Card>

      <ConfirmDialog
        isOpen={isConfirmingDisconnect}
        title="Disconnect this number?"
        confirmLabel="Disconnect"
        danger
        onConfirm={disconnect}
        onClose={() => setIsConfirmingDisconnect(false)}
      >
        Your agent will stop answering and placing calls on {status?.from_number}. Calls already queued will not be placed. Your call history, rules and do-not-call list are kept.
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={isConfirmingUnlink}
        title="Remove the agent from this number?"
        confirmLabel="Remove agent"
        danger
        onConfirm={() => run("link", () => voiceCallsApi.unlinkAgent(), "Agent removed from this number.", "Couldn't remove the agent.")}
        onClose={() => setIsConfirmingUnlink(false)}
      >
        The number stays connected, but nobody answers incoming calls and no calls are placed until you link an agent again. Your agent itself is not deleted.
      </ConfirmDialog>
    </div>
  );
}
