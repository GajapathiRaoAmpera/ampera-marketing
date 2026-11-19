"use client";

import { hotLeadsApi, followUpsApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { FireIcon } from "@/components/layout/icons";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";
import { HotLeadsTab } from "./_tabs/HotLeadsTab";
import { FollowUpsTab } from "./_tabs/FollowUpsTab";
import { TaggedTab } from "./_tabs/TaggedTab";

// Hot leads and follow-ups answer one question, "who needs my attention today?", so they are tabs
// of one page. Each keeps its own layout (a ranked grid, an action queue, a tag list).
function Leads({ businessId }: { businessId: string }) {
  // Counts are fetched here, not inside each tab, so the badges show whichever tab is open.
  const { data: hotLeads } = useAsync(() => hotLeadsApi.list(businessId), [businessId]);
  const { data: followUps } = useAsync(() => followUpsApi.list(businessId), [businessId]);
  const hot = hotLeads?.length ?? 0;
  const pending = (followUps ?? []).filter((f) => f.status === "pending").length;

  const pills: WorkspacePill[] = [
    { label: hot ? `${hot} hot lead${hot === 1 ? "" : "s"}` : "No hot leads right now", tone: hot ? "warn" : "off", goTo: "hot-leads" },
    { label: pending ? `${pending} follow-up${pending === 1 ? "" : "s"} due` : "No follow-ups due", tone: pending ? "warn" : "off", goTo: "follow-ups" },
  ];

  return (
    <ChannelWorkspace
      color="#f2542d"
      icon={<FireIcon size={34} />}
      name="Leads"
      identity="Leads"
      subtitle="Customers worth your attention right now"
      pills={pills}
      connected
      landing={{ headline: "", text: "", steps: [], panel: null }}
      tabs={[
        {
          value: "hot-leads",
          label: hot ? `Hot leads · ${hot}` : "Hot leads",
          icon: "fire",
          intro: "People showing strong buying signals in their chats, ranked by score. Open one to reply yourself, or let the assistant keep going.",
          render: () => <HotLeadsTab businessId={businessId} />,
        },
        {
          value: "follow-ups",
          label: pending ? `Follow-ups · ${pending}` : "Follow-ups",
          icon: "bell",
          intro: "Customers who went quiet, or whose last message is still waiting for a reply. Send a nudge or dismiss it.",
          render: () => <FollowUpsTab businessId={businessId} />,
        },
        {
          value: "tagged",
          label: "Tagged",
          icon: "check",
          intro: "Everyone you or an automation has put a tag on, grouped by tag, for example “vip” or “asked-for-quote”.",
          render: () => <TaggedTab businessId={businessId} />,
        },
      ]}
    />
  );
}

export default function LeadsPage() {
  return <ChannelGate channel="leads">{(businessId) => <Leads businessId={businessId} />}</ChannelGate>;
}
