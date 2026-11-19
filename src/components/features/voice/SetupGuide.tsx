"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { voiceCallsApi, ApiError, type VoiceStatus } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { VoiceTab } from "./OverviewTab";
import { AgentIcon, CheckMark, IncomingIcon, LaunchIcon, NumberIcon, RulesIcon, VoiceWaveIcon } from "./VoiceIcons";
import styles from "./VoiceCenter.module.scss";

export const NUMBER_PAGE = "/channels/voice/number";

interface SetupGuideProps {
  status: VoiceStatus | null;
  agentId?: string | null;
  onNavigate: (tab: VoiceTab) => void;
  onChanged: () => void;
}

/** Steps this app can't verify itself; the person completes them by doing them. Remembered per phone number. */
type ManualStep = "inbound" | "voice" | "rules" | "first_call";

function storageKey(number?: string) {
  return `voice_setup_guide:${number ?? "none"}`;
}

function readDone(number?: string): ManualStep[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(number)) ?? "{}");
    return Array.isArray(parsed.done) ? parsed.done : [];
  } catch {
    return [];
  }
}

/**
 * Voice setup as one slim track: six icons joined by a line that fills as
 * steps are finished, and a single row underneath for the item in focus.
 *
 * While steps remain it opens on the next one to do. Once everything is
 * done it stays, as "Your setup": the same six items, each still one click
 * from being changed or removed. Nothing set here is ever locked in.
 */
export function SetupGuide({ status, agentId, onNavigate, onChanged }: SetupGuideProps) {
  const { show } = useToast();
  const number = status?.connected ? status.from_number : undefined;
  // Mounted only after the status has loaded in the browser, so reading storage here is safe.
  const [manual, setManual] = useState<ManualStep[]>(() => readDone(number));
  const [busy, setBusy] = useState<"" | "link" | "unlink">("");
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  // Which item's row is showing; null follows the next step to do.
  const [picked, setPicked] = useState<string | null>(null);

  function setDone(step: ManualStep, done: boolean) {
    if (manual.includes(step) === done) return;
    const next = done ? [...manual, step] : manual.filter((item) => item !== step);
    setManual(next);
    try {
      localStorage.setItem(storageKey(number), JSON.stringify({ done: next }));
    } catch {
      // Storage unavailable: progress still shows for this visit.
    }
  }

  async function linkAgent() {
    if (!agentId) return;
    setBusy("link");
    try {
      await voiceCallsApi.linkAgent(agentId);
      show("Agent linked. It will answer the next call.", "success");
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't link the agent.", "error");
    } finally {
      setBusy("");
    }
  }

  async function unlinkAgent() {
    setBusy("unlink");
    try {
      await voiceCallsApi.unlinkAgent();
      show("Agent removed from this number.", "default");
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't remove the agent.", "error");
    } finally {
      setBusy("");
    }
  }

  const isConnected = Boolean(status?.connected);
  const isLinked = Boolean(status?.agent_id && status.agent_id === agentId);
  const linkedElsewhere = Boolean(status?.agent_id && status.agent_id !== agentId);
  const provider = status?.provider_name ?? "your provider";
  const has = (step: ManualStep) => manual.includes(step);

  // Each item: what to do while it is open (`todo`), and how to change or
  // remove it once it is set (`manage`).
  const steps = [
    {
      key: "number",
      label: "Number",
      icon: <NumberIcon />,
      done: isConnected,
      title: isConnected ? "Phone number" : "Connect a phone number",
      detail: isConnected ? `${status?.from_number} on ${provider}.` : "Pick your phone provider and enter your number. About 2 minutes.",
      todo: (
        <Link href={NUMBER_PAGE}>
          <Button size="sm">Set up number</Button>
        </Link>
      ),
      manage: (
        <Link href={NUMBER_PAGE}>
          <Button size="sm" variant="secondary">Change or remove number</Button>
        </Link>
      ),
    },
    {
      key: "agent",
      label: "Agent",
      icon: <AgentIcon />,
      done: isLinked,
      title: isLinked ? "AI agent" : "Link your AI agent",
      detail: isLinked
        ? "This business's agent answers and places the calls."
        : linkedElsewhere
          ? "A different business's agent is on this number right now."
          : "One click. Without it, nobody answers.",
      todo: (
        <>
          <Button size="sm" onClick={linkAgent} isLoading={busy === "link"} disabled={!agentId}>
            {linkedElsewhere ? "Use this business's agent" : "Link agent"}
          </Button>
          {linkedElsewhere && <Button size="sm" variant="ghost" onClick={() => setIsConfirmingUnlink(true)}>Remove agent</Button>}
        </>
      ),
      manage: (
        <>
          <Link href="/agent-config">
            <Button size="sm" variant="secondary">Edit agent</Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={() => setIsConfirmingUnlink(true)}>Remove from number</Button>
        </>
      ),
    },
    {
      key: "inbound",
      label: "Incoming calls",
      icon: <IncomingIcon />,
      done: has("inbound"),
      title: has("inbound") ? "Incoming calls" : "Receive incoming calls",
      detail: has("inbound")
        ? `You marked the two addresses as pasted into ${provider}.`
        : `Paste two addresses into ${provider}. Skip if you only call out.`,
      todo: (
        <>
          <Link href={`${NUMBER_PAGE}#incoming`}>
            <Button size="sm">Show addresses</Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={() => setDone("inbound", true)}>Mark as done</Button>
        </>
      ),
      manage: (
        <>
          <Link href={`${NUMBER_PAGE}#incoming`}>
            <Button size="sm" variant="secondary">Show addresses</Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={() => setDone("inbound", false)}>Mark as not done</Button>
        </>
      ),
    },
    {
      key: "voice",
      label: "Voice",
      icon: <VoiceWaveIcon />,
      done: has("voice"),
      title: has("voice") ? "Voice and language" : "Pick a voice and test it",
      detail: has("voice") ? "Change how your agent sounds, or run another test call." : "Choose the voice and language, then call yourself.",
      todo: (
        <Link href="/channels/voice/test" onClick={() => setDone("voice", true)}>
          <Button size="sm">Voice &amp; testing</Button>
        </Link>
      ),
      manage: (
        <Link href="/channels/voice/test">
          <Button size="sm" variant="secondary">Change voice</Button>
        </Link>
      ),
    },
    {
      key: "rules",
      label: "Rules",
      icon: <RulesIcon />,
      done: has("rules"),
      title: has("rules") ? "Call rules" : "Set your call rules",
      detail: has("rules") ? "Hours, transfers, voicemail and retries can be changed any time." : "Hours, transfers and voicemail. Defaults work too.",
      todo: <Button size="sm" onClick={() => { setDone("rules", true); onNavigate("rules"); }}>Open rules</Button>,
      manage: <Button size="sm" variant="secondary" onClick={() => onNavigate("rules")}>Edit rules</Button>,
    },
    {
      key: "first_call",
      label: "Calling",
      icon: <LaunchIcon />,
      done: has("first_call"),
      title: has("first_call") ? "Campaigns" : "Make your first calls",
      detail: has("first_call") ? "Start a new campaign, or pause and cancel running ones." : "Call a list of contacts with a campaign.",
      todo: <Button size="sm" onClick={() => { setDone("first_call", true); onNavigate("campaigns"); }}>New campaign</Button>,
      manage: <Button size="sm" variant="secondary" onClick={() => onNavigate("campaigns")}>Manage campaigns</Button>,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const isComplete = doneCount === steps.length;
  const currentIndex = isComplete ? steps.length - 1 : steps.findIndex((step) => !step.done);
  const pickedIndex = steps.findIndex((step) => step.key === picked);
  // With steps left, the row follows the next one to do. With none left it
  // stays closed until an item is clicked.
  const activeIndex = pickedIndex >= 0 ? pickedIndex : isComplete ? -1 : currentIndex;
  const active = activeIndex >= 0 ? steps[activeIndex] : null;
  // Everything after "connect a number" needs a number first.
  const isLocked = (index: number) => index > 0 && !isConnected;
  const stateOf = (index: number) =>
    steps[index].done ? "done" : isLocked(index) ? "locked" : index === currentIndex ? "current" : "todo";

  return (
    <section className={styles.track} aria-label={isComplete ? "Your setup" : "Getting started"}>
      <div className={styles.trackHead}>
        <span className={styles.trackKicker}>{isComplete ? "Your setup" : "Getting started"}</span>
        <span className={styles.trackCount}>
          {isComplete ? "Click anything to change it" : <><strong>{doneCount}</strong> of {steps.length} done</>}
        </span>
      </div>

      {/* The line reaches as far as the next step to do. */}
      <ol className={styles.trackRail} style={{ ["--reach" as string]: currentIndex / (steps.length - 1) }}>
        {steps.map((step, index) => (
          <li key={step.key}>
            <button
              type="button"
              className={styles.trackNode}
              data-state={stateOf(index)}
              data-active={index === activeIndex || undefined}
              aria-expanded={index === activeIndex}
              aria-label={`${step.label}: ${step.done ? "set up, open to change" : step.title}`}
              // Clicking the open item again closes it once setup is complete.
              onClick={() => setPicked(isComplete && index === activeIndex ? null : step.key)}
            >
              {/* While steps remain a tick shows progress; afterwards each item keeps its own icon. */}
              <span className={styles.trackDot}>{step.done && !isComplete ? <CheckMark /> : step.icon}</span>
              <span className={styles.trackLabel}>{step.label}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Keyed so each item's row eases in as it replaces the last. */}
      {active && (
        <div key={active.key} className={styles.trackDetail}>
          <div className={styles.trackText}>
            <div className={styles.trackTitle}>
              {active.done
                ? <span className={styles.trackDone}><CheckMark size={14} /> Set up</span>
                : <span className={styles.trackStepNo}>Step {activeIndex + 1}</span>}
              {active.title}
            </div>
            <div className={styles.trackHint}>
              {isLocked(activeIndex) ? "Connect a phone number first, then this opens up." : active.detail}
            </div>
          </div>
          {!isLocked(activeIndex) && <div className={styles.trackActions}>{active.done ? active.manage : active.todo}</div>}
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmingUnlink}
        title="Remove the agent from this number?"
        confirmLabel="Remove agent"
        danger
        onConfirm={unlinkAgent}
        onClose={() => setIsConfirmingUnlink(false)}
      >
        The number stays connected, but nobody answers incoming calls and no calls are placed until you link an agent again. Your agent itself is not deleted.
      </ConfirmDialog>
    </section>
  );
}
