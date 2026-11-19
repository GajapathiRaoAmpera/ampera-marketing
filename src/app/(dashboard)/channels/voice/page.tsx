"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { voiceCallsApi, type VoiceStatus } from "@/lib/api";
import { Skeleton } from "@/components/ui";
import { PhoneIcon } from "@/components/layout/icons";
import { OverviewTab, type VoiceTab } from "@/components/features/voice/OverviewTab";
import { CallsTab } from "@/components/features/voice/CallsTab";
import { CampaignsTab } from "@/components/features/voice/CampaignsTab";
import { RulesTab } from "@/components/features/voice/RulesTab";
import { DncTab } from "@/components/features/voice/DncTab";
import { MessagesTab } from "@/components/features/voice/MessagesTab";
import { SetupGuide } from "@/components/features/voice/SetupGuide";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";

// The phone number and the voice and testing screens were separate pages; they are tabs here now.
const NumberScreen = dynamic(() => import("./number/page"), { loading: () => <Skeleton height={360} /> });
const TestingScreen = dynamic(() => import("./test/page"), { loading: () => <Skeleton height={360} /> });

function VoiceChannel({ agentId }: { agentId?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState<string>();

  const loadStatus = useCallback(() => {
    voiceCallsApi
      .status()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setIsStatusLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // The workspace keeps the tab in the address (?tab=), so moving between tabs is a link change.
  function navigate(next: VoiceTab) {
    setCampaignFilter(undefined);
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  }

  const canCall = Boolean(status?.connected && status.agent_id);
  const providerName = status?.provider_name ?? "Twilio";

  const pills: WorkspacePill[] = [
    { label: `${providerName} connected`, tone: "on" },
    { label: canCall ? "AI agent answering calls" : "No AI agent on the number", tone: canCall ? "on" : "warn", goTo: "overview" },
    { label: status?.record_calls ? "Recording calls" : "Not recording", tone: status?.record_calls ? "on" : "off", title: "Calls are recorded only if you turn this on, and callers are told." },
  ];

  return (
    <ChannelWorkspace
      color="#f22f46"
      icon={<PhoneIcon size={34} />}
      name="Voice calling"
      identity={status?.from_number ?? "Voice calling"}
      subtitle={`${providerName} · your AI agent answers every call`}
      pills={pills}
      connected={isStatusLoading ? null : Boolean(status?.connected)}
      legacyTabs={{ connection: "overview", test: "voice" }}
      landing={{
        headline: "Let your AI agent answer every phone call.",
        text: "Connect a phone number. Your agent picks up, answers from your knowledge base, qualifies the caller and tells you what happened. It can also call your contacts.",
        steps: [
          { title: "Connect a number", text: "Use your own number from Twilio or Plivo." },
          { title: "Choose the voice", text: "Pick the language and voice, and what the agent says first." },
          { title: "Make a test call", text: "Call the number, or have the agent call you, before real customers do." },
        ],
        panel: <SetupGuide key="none" status={status} agentId={agentId} onNavigate={navigate} onChanged={loadStatus} />,
      }}
      tabs={[
        {
          value: "overview",
          label: "Overview",
          icon: "overview",
          render: () => (
            <>
              <SetupGuide key={status?.connected ? status.from_number : "none"} status={status} agentId={agentId} onNavigate={navigate} onChanged={loadStatus} />
              <OverviewTab status={status} onNavigate={navigate} />
              <p style={{ margin: 0 }}>
                Want to script exactly what the agent says? Try the <Link href="/channels/voice/studio">call flow builder</Link> (beta).
              </p>
            </>
          ),
        },
        {
          value: "calls",
          label: "Calls",
          icon: "phone",
          intro: "Every call, in and out, with a summary, the transcript and the recording if you record.",
          render: () => <CallsTab key={campaignFilter ?? "all"} campaignId={campaignFilter} />,
        },
        { value: "messages", label: "Messages", icon: "mail", intro: "Messages callers left, and texts the agent sent after a call.", render: () => <MessagesTab /> },
        {
          value: "campaigns",
          label: "Campaigns",
          icon: "share",
          minRole: "manager",
          intro: "Have the agent call a list of contacts, for example to remind, qualify or follow up. Calls respect your hours and the do-not-call list.",
          render: () => (
            <CampaignsTab
              canCall={canCall}
              onViewCalls={(id) => {
                setCampaignFilter(id);
                router.replace(`${pathname}?tab=calls`, { scroll: false });
              }}
            />
          ),
        },
        {
          value: "rules",
          label: "Rules",
          icon: "shield",
          minRole: "admin",
          intro: "When the agent may call, how often it retries, and who it may call.",
          render: () => <RulesTab connected={Boolean(status?.connected)} capabilities={status?.capabilities ?? []} providerName={providerName} />,
        },
        { value: "dnc", label: "Do not call", icon: "stop", intro: "Numbers the agent must never call. Anyone who asks to stop is added automatically.", render: () => <DncTab /> },
        {
          value: "number",
          label: "Phone number",
          icon: "phone",
          minRole: "admin",
          intro: "The number your AI agent answers and calls from, and the provider account behind it.",
          render: () => <NumberScreen />,
        },
        {
          value: "voice",
          label: "Voice & testing",
          icon: "play",
          minRole: "admin",
          intro: "Choose the language and voice, rehearse a conversation before real customers call, and set when the agent calls.",
          render: () => <TestingScreen />,
        },
      ]}
    />
  );
}

export default function VoiceChannelPage() {
  return <ChannelGate channel="voice calling">{(_businessId, agentId) => <VoiceChannel agentId={agentId} />}</ChannelGate>;
}
