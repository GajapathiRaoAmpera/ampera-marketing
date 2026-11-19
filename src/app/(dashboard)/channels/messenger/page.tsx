"use client";

import { useCallback, useState } from "react";
import { ApiError, messengerApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, Select } from "@/components/ui";
import { MessengerIcon } from "@/components/layout/icons";
import { MessengerConnectPanel } from "@/components/features/messenger/MessengerConnectPanel";
import { ManualMessengerConnectForm } from "@/components/features/messenger/ManualMessengerConnectForm";
import { AnalyticsTab } from "@/components/features/messenger/tabs/AnalyticsTab";
import { ChatSetupTab } from "@/components/features/messenger/tabs/ChatSetupTab";
import { ContactsTab } from "@/components/features/messenger/tabs/ContactsTab";
import { GrowTab } from "@/components/features/messenger/tabs/GrowTab";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";

function MessengerChannel({ agentId }: { agentId?: string }) {
  const { show } = useToast();
  const { data, isLoading, refresh } = useAsync(() => messengerApi.listConnections(), []);
  const [selected, setSelected] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const pages = (data ?? []).filter((item) => item.active);
  const page = pages.find((item) => item.page_id === selected) ?? pages[0];

  const handleConnect = useCallback(async () => {
    setIsRedirecting(true);
    try {
      const { url } = await messengerApi.connect();
      window.location.href = url;
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't start Messenger connect. Please try again.", "error");
      setIsRedirecting(false);
    }
  }, [show]);

  const pills: WorkspacePill[] = page
    ? [
        { label: page.webhook_subscribed ? "Receiving messages" : "Not receiving messages", tone: page.webhook_subscribed ? "on" : "warn", title: "Whether Facebook is sending this Page's messages to the assistant.", goTo: "home" },
        ...(pages.length > 1 ? [{ label: `${pages.length} Pages`, tone: "on" as const }] : []),
      ]
    : [];

  // Every tab is about one Page. Remounting per Page keeps one Page's unsaved edits off another.
  const forPage = (render: (pageId: string) => React.ReactNode) => (page ? <div key={page.page_id}>{render(page.page_id)}</div> : null);

  return (
    <ChannelWorkspace
      color="#0084ff"
      icon={<MessengerIcon size={34} />}
      name="Messenger"
      identity={page?.page_name ?? "Messenger"}
      subtitle={page?.page_category ?? undefined}
      pills={pills}
      connected={isLoading ? null : Boolean(page)}
      legacyTabs={{ connection: "home" }}
      toolbar={
        pages.length > 1 && page ? (
          <Select label="Facebook Page" value={page.page_id} onChange={(e) => setSelected(e.target.value)}>
            {pages.map((item) => (
              <option key={item.page_id} value={item.page_id}>
                {item.page_name}
              </option>
            ))}
          </Select>
        ) : undefined
      }
      landing={{
        headline: "Answer your Facebook Page's messages automatically.",
        text: "Connect a Facebook Page and your assistant replies on Messenger. You can take over any chat yourself.",
        steps: [
          { title: "Connect with Facebook", text: "Log in and choose the Page. You must be an admin of it." },
          { title: "Set how it chats", text: "Greeting, buttons and menu, and when the assistant should step aside." },
          { title: "Grow it", text: "Share a chat link or QR code, auto-reply to comments, and message people again." },
        ],
        panel: (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
            <Button onClick={handleConnect} isLoading={isRedirecting}>
              Connect with Facebook
            </Button>
            <ManualMessengerConnectForm agentId={agentId} onConnected={refresh} />
          </div>
        ),
      }}
      tabs={[
        {
          value: "home",
          label: "Home",
          icon: "overview",
          minRole: "admin",
          render: () => <MessengerConnectPanel agentId={agentId} onChanged={refresh} />,
        },
        {
          value: "setup",
          label: "Chat setup",
          icon: "gear",
          minRole: "admin",
          intro: "What people see when they open the chat (greeting, menu, buttons) and how the assistant behaves.",
          render: () => forPage((id) => <ChatSetupTab pageId={id} />),
        },
        {
          value: "contacts",
          label: "Contacts",
          icon: "team",
          intro: "Everyone who has messaged your Page, and how long you can still reply (Messenger allows 24 hours after their last message).",
          render: () => forPage((id) => <ContactsTab pageId={id} />),
        },
        {
          value: "grow",
          label: "Grow",
          icon: "share",
          minRole: "manager",
          intro: "Bring people into the chat with links and QR codes, answer comments on your posts, and message people again with a broadcast.",
          render: () => forPage((id) => <GrowTab pageId={id} />),
        },
        {
          value: "analytics",
          label: "Analytics",
          icon: "chart",
          intro: "How Messenger is performing for your Page.",
          render: () => forPage((id) => <AnalyticsTab pageId={id} />),
        },
      ]}
    />
  );
}

export default function MessengerChannelPage() {
  return <ChannelGate channel="Messenger">{(_businessId, agentId) => <MessengerChannel agentId={agentId} />}</ChannelGate>;
}
