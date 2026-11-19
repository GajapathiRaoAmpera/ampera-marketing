"use client";

import dynamic from "next/dynamic";
import { useEntitlements } from "@/context/EntitlementsContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { Skeleton } from "@/components/ui";
import { BuildingIcon } from "@/components/layout/icons";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";

const ProfileScreen = dynamic(() => import("./screens/ProfileScreen"), { loading: () => <Skeleton height={360} /> });
const TeamScreen = dynamic(() => import("./screens/TeamScreen"), { loading: () => <Skeleton height={360} /> });
const BillingScreen = dynamic(() => import("./screens/BillingScreen"), { loading: () => <Skeleton height={360} /> });
const AppsScreen = dynamic(() => import("./screens/AppsScreen"), { loading: () => <Skeleton height={360} /> });
const DeveloperScreen = dynamic(() => import("./screens/DeveloperScreen"), { loading: () => <Skeleton height={360} /> });

function BusinessWorkspace() {
  const { business } = useActiveBusiness();
  const { entitlements } = useEntitlements();

  const pills: WorkspacePill[] = [];
  if (entitlements?.plan_name) pills.push({ label: `${entitlements.plan_name} plan`, tone: "on", goTo: "billing" });
  if (entitlements?.awaiting_approval) pills.push({ label: "Awaiting approval", tone: "warn" });

  return (
    <ChannelWorkspace
      color="#0f9d8a"
      icon={<BuildingIcon size={34} />}
      name="Business"
      identity={business?.name ?? "Your business"}
      subtitle="The facts, people, plan and connections behind your assistant"
      pills={pills}
      connected
      landing={{ headline: "", text: "", steps: [], panel: null }}
      tabs={[
        {
          value: "profile",
          label: "Profile",
          icon: "bulb",
          minRole: "admin",
          intro: "The facts your assistant uses in every conversation: what you do, hours, prices, policies. Start with your website and we organise it for you to approve.",
          render: () => <ProfileScreen />,
        },
        {
          value: "team",
          label: "Team",
          icon: "team",
          intro: "Who can use this business and what each person may do. Owners and admins manage access; agents answer chats; viewers only look.",
          render: () => <TeamScreen />,
        },
        {
          value: "apps",
          label: "Connected apps",
          icon: "plug",
          minRole: "admin",
          intro: "Chat channels and the stores your assistant can pull live products and orders from. Connect what you use; add more any time.",
          render: () => <AppsScreen />,
        },
        {
          value: "billing",
          label: "Plans & billing",
          icon: "gauge",
          minRole: "owner",
          intro: "Your plan, what is included, and how much you have used this month.",
          render: () => <BillingScreen />,
        },
        {
          value: "developer",
          label: "Developer",
          icon: "key",
          minRole: "admin",
          intro: "For developers: webhooks to your own systems, API keys for Zapier, Make or n8n, and rules that connect your channels.",
          render: () => <DeveloperScreen />,
        },
      ]}
      legacyTabs={{ webhooks: "developer" }}
    />
  );
}

export default function BusinessHub() {
  return <ChannelGate channel="a business">{() => <BusinessWorkspace />}</ChannelGate>;
}
