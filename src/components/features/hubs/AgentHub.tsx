"use client";

import dynamic from "next/dynamic";
import { agentApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useEntitlements } from "@/context/EntitlementsContext";
import { Skeleton } from "@/components/ui";
import { BotIcon } from "@/components/layout/icons";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { ChannelWorkspace, type WorkspacePill, type WorkspaceTab } from "@/components/features/channels/workspace/ChannelWorkspace";

const AgentScreen = dynamic(() => import("./screens/AgentScreen"), { loading: () => <Skeleton height={360} /> });
const KnowledgeScreen = dynamic(() => import("./screens/KnowledgeScreen"), { loading: () => <Skeleton height={360} /> });
const ProductsScreen = dynamic(() => import("./screens/ProductsScreen"), { loading: () => <Skeleton height={360} /> });
const GapsScreen = dynamic(() => import("./screens/GapsScreen"), { loading: () => <Skeleton height={360} /> });

function AgentWorkspace({ agentId }: { agentId?: string }) {
  const { isEnabled } = useEntitlements();
  const { data: agent, isLoading } = useAsync(() => (agentId ? agentApi.get(agentId) : Promise.resolve(null)), [agentId]);
  const running = agent?.status === "running";

  const pills: WorkspacePill[] = agent
    ? [{ label: running ? "Answering customers" : "Paused: not replying", tone: running ? "on" : "warn", title: "Pause or resume it from any channel's Home tab." }]
    : [];

  const tabs: WorkspaceTab[] = [
    {
      value: "agent",
      label: "Agent",
      icon: "bot",
      minRole: "admin",
      intro: "Who your assistant is: its name, tone, language and the rules it follows on every channel. Changes apply from the next customer message. Use Test chat to try it.",
      render: () => <AgentScreen />,
    },
    {
      value: "knowledge",
      label: "Knowledge",
      icon: "book",
      minRole: "manager",
      intro: "What your assistant knows. Upload documents or link web pages, and it answers from them instead of guessing.",
      render: () => <KnowledgeScreen />,
    },
    ...(isEnabled("product_catalog_enabled")
      ? [
          {
            value: "products",
            label: "Products",
            icon: "box" as const,
            minRole: "manager" as const,
            intro: "Everything you sell. The assistant answers price and availability questions and sends the product photo when asked.",
            render: () => <ProductsScreen />,
          },
        ]
      : []),
    {
      value: "gaps",
      label: "Gaps",
      icon: "bulb",
      minRole: "manager",
      intro: "Questions customers asked that the assistant couldn't answer. Answer one here once and it uses your answer from then on.",
      render: () => <GapsScreen />,
    },
  ];

  return (
    <ChannelWorkspace
      color="#7c5cfc"
      icon={<BotIcon size={34} />}
      name="AI Agent"
      identity={agent?.name ?? "AI Agent"}
      subtitle="The assistant that answers your customers on every channel"
      pills={pills}
      connected={isLoading ? null : true}
      landing={{ headline: "", text: "", steps: [], panel: null }}
      tabs={tabs}
      legacyTabs={{ persona: "agent" }}
    />
  );
}

export default function AgentHub() {
  return <ChannelGate channel="an AI agent">{(_businessId, agentId) => <AgentWorkspace agentId={agentId} />}</ChannelGate>;
}
