"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { agentApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { FlowIcon } from "@/components/layout/icons";
import { FlowCreateForm } from "@/components/features/flows/FlowCreateForm";
import { FlowList } from "@/components/features/flows/FlowList";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";
import styles from "./page.module.scss";

function Automations() {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: agents, isLoading: agentsLoading } = useAsync(() => agentApi.list(), []);
  const hasAgent = !agentsLoading && (agents?.length ?? 0) > 0;

  const pills: WorkspacePill[] = [{ label: hasAgent ? "Ready to build" : "Set up an agent first", tone: hasAgent ? "on" : "warn" }];

  return (
    <ChannelWorkspace
      color="#e8590c"
      icon={<FlowIcon size={34} />}
      name="Automations"
      identity="Automations"
      subtitle="Replies that fire by themselves, without the AI"
      pills={pills}
      action={hasAgent ? { label: "New flow", goTo: "new" } : undefined}
      connected={agentsLoading ? null : true}
      landing={{ headline: "", text: "", steps: [], panel: null }}
      tabs={[
        {
          value: "flows",
          label: "Flows",
          icon: "shuffle",
          intro: "Greeting messages and branching replies that start on a keyword or a first message. Use them for fixed answers like opening hours, or to hand a chat to the AI at the right moment.",
          render: () => (
            <>
              {!agentsLoading && !hasAgent && <div className={styles.noAgentHint}>You need at least one agent set up before you can create a flow.</div>}
              <FlowList key={refreshKey} />
            </>
          ),
        },
        {
          value: "new",
          label: "New flow",
          icon: "plus",
          minRole: "manager",
          intro: "Pick the agent and the channel, write the opening message and add the choices people can tap.",
          render: () => (agents ? <FlowCreateForm agents={agents} onCreated={() => {
                setRefreshKey((k) => k + 1);
                router.replace(pathname, { scroll: false });
              }} /> : <Skeleton height={240} />),
        },
      ]}
    />
  );
}

export default function TemplateFlowsPage() {
  return <ChannelGate channel="automations">{() => <Automations />}</ChannelGate>;
}
