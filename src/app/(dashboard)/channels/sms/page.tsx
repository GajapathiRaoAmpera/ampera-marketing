"use client";

import { useState } from "react";
import { ApiError, smsApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Select, Skeleton } from "@/components/ui";
import { SmsIcon } from "@/components/layout/icons";
import { CopyField, SetupSteps } from "@/components/features/channels/ChannelFrame";
import { ConnectionDetailCard } from "@/components/features/channels/ConnectionDetailCard";
import { ChannelAnalyticsTab, ChannelChatSetup, ChannelContacts, ChannelGrow } from "@/components/features/channels/ChannelHubTabs";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { Block, ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";
import styles from "@/components/features/messenger/Messenger.module.scss";

function SmsChannel({ agentId }: { agentId?: string }) {
  const { show } = useToast();
  const { data: status, isLoading, refresh } = useAsync(() => smsApi.status(), []);
  const { data: providers } = useAsync(() => smsApi.providers(), []);
  const [providerKey, setProviderKey] = useState("twilio");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [fromNumber, setFromNumber] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  // Twilio accounts that don't own the number (or use a messaging service) need the URL pasted by hand.
  const [needsManualWebhook, setNeedsManualWebhook] = useState(false);

  const fail = (err: unknown, fallback: string) => show(err instanceof ApiError ? err.userMessage : fallback, "error");
  const provider = providers?.find((item) => item.key === providerKey) ?? providers?.[0];
  const numberLooksValid = /^\+[1-9]\d{6,14}$/.test(fromNumber.trim());
  const credentialsFilled = !!provider && provider.fields.every((field) => (credentials[field.key] ?? "").trim());

  async function connect() {
    setIsConnecting(true);
    try {
      if (!provider) return;
      const cleaned = Object.fromEntries(provider.fields.map((field) => [field.key, (credentials[field.key] ?? "").trim()]));
      const result = await smsApi.connect(provider.key, cleaned, fromNumber.trim());
      if (agentId) await smsApi.linkAgent(agentId);
      setNeedsManualWebhook(!result.webhook_configured);
      setCredentials({});
      setFromNumber("");
      show(
        result.webhook_configured ? "Your number is connected and receiving texts." : `Connected. One more step is needed in ${provider.name}, see below.`,
        result.webhook_configured ? "success" : "warning"
      );
      refresh();
    } catch (err) {
      fail(err, "Couldn't connect. Check your details and try again.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function linkAgent() {
    if (!agentId) return;
    setIsLinking(true);
    try {
      await smsApi.linkAgent(agentId);
      show("This business's assistant now answers texts.", "success");
      refresh();
    } catch (err) {
      fail(err, "Couldn't link the assistant.");
    } finally {
      setIsLinking(false);
    }
  }

  async function disconnect() {
    try {
      await smsApi.disconnect();
      show("SMS disconnected.", "default");
      refresh();
    } catch (err) {
      fail(err, "Couldn't disconnect. Please try again.");
      throw err;
    }
  }

  const isTwilio = (status?.provider ?? "twilio") === "twilio";
  const providerName = status?.provider_name ?? "Twilio";
  const linkedElsewhere = !!agentId && status?.agent_id !== agentId;
  const noAssistant = !status?.agent_id || linkedElsewhere;

  const pills: WorkspacePill[] = [
    { label: `${providerName} SMS`, tone: "on" },
    { label: noAssistant ? "No assistant linked" : "Assistant answering", tone: noAssistant ? "warn" : "on", goTo: "home" },
  ];

  const connectPanel = !provider ? (
    <Skeleton height={240} />
  ) : (
    <div className={styles.stack}>
      <Select
        label="SMS provider"
        aria-label="SMS provider"
        value={provider.key}
        onChange={(e) => {
          setProviderKey(e.target.value);
          setCredentials({});
        }}
      >
        {(providers ?? []).map((item) => (
          <option key={item.key} value={item.key}>
            {item.name}
            {item.india_fit === "best" || item.india_fit === "good" ? " (works well in India)" : ""}
          </option>
        ))}
      </Select>
      <SetupSteps
        steps={[
          <>
            Sign in to your <strong>{provider.name}</strong> account and buy or pick a phone number that can send SMS.
          </>,
          <>Copy the details asked for below from your {provider.name} console.</>,
          provider.key === "twilio" ? (
            <>Paste them here with the number. We point the number at your assistant automatically.</>
          ) : (
            <>Paste them here with the number, then add the address we show you to {provider.name} so incoming texts reach your assistant.</>
          ),
        ]}
      />
      {!provider.delivery_receipts && <p className={styles.hint}>Delivery status per text is shown for Twilio only. Sending, receiving, opt-outs and broadcasts work the same on {provider.name}.</p>}
      <p className={styles.hint}>Operators in India require DLT registration for business SMS. Without it, delivery to Indian numbers is unreliable, so set that up with your provider first.</p>
      <div className={styles.row}>
        {provider.fields.map((field) => (
          <Input
            key={`${provider.key}-${field.key}`}
            label={field.label}
            type={field.secret ? "password" : "text"}
            autoComplete="off"
            placeholder={field.placeholder}
            helperText={field.help}
            value={credentials[field.key] ?? ""}
            onChange={(e) => setCredentials((current) => ({ ...current, [field.key]: e.target.value }))}
          />
        ))}
      </div>
      <div className={styles.row}>
        <Input
          label={`${provider.name} phone number`}
          placeholder="+14155550123"
          value={fromNumber}
          onChange={(e) => setFromNumber(e.target.value)}
          errorText={fromNumber && !numberLooksValid ? "Include the country code, e.g. +14155550123." : undefined}
        />
        <Button onClick={connect} isLoading={isConnecting} disabled={!credentialsFilled || !numberLooksValid}>
          Connect number
        </Button>
      </div>
    </div>
  );

  return (
    <ChannelWorkspace
      color="#6d5dfc"
      icon={<SmsIcon size={34} />}
      name="SMS"
      identity={status?.from_number ?? "SMS"}
      subtitle={`${providerName} SMS`}
      pills={pills}
      connected={isLoading ? null : Boolean(status?.connected)}
      legacyTabs={{ connection: "home" }}
      landing={{
        headline: "Answer text messages on your own number.",
        text: "Connect a number from Twilio, Plivo, Telnyx or SignalWire. Your assistant replies to texts, honours STOP, and can send keyword campaigns.",
        steps: [
          { title: "Pick your provider", text: "Texts go through your own account with them and are billed by them." },
          { title: "Paste your details", text: "Copy the account details and the number from the provider's console." },
          { title: "Start texting", text: "Incoming texts reach your assistant; delivery status shows in your inbox (Twilio)." },
        ],
        panel: connectPanel,
      }}
      tabs={[
        {
          value: "home",
          label: "Home",
          icon: "overview",
          render: () => (
            <>
              {noAssistant && (
                <div className={styles.notice} role="alert">
                  <p>
                    {status?.agent_id ? "This number is answering with a different business's assistant." : "No assistant is linked, so texts won't be answered yet."}{" "}
                    <button type="button" className={styles.linkButton} onClick={linkAgent} disabled={isLinking || !agentId}>
                      {isLinking ? "Linking…" : "Use this business's assistant"}
                    </button>
                  </p>
                </div>
              )}
              <Block
                title={!isTwilio ? `Receive texts from ${providerName}` : needsManualWebhook ? "Finish in Twilio" : "If texts aren't being answered"}
                hint={
                  !isTwilio
                    ? status?.inbound_help ?? `Paste this address into ${providerName} as the address for incoming messages.`
                    : needsManualWebhook
                      ? "We couldn't set this for you. In Twilio, open Phone Numbers, choose your number, and under Messaging paste this as the “A message comes in” webhook (HTTP POST)."
                      : "In Twilio, open Phone Numbers, choose your number, and check that “A message comes in” points to this address (HTTP POST)."
                }
              >
                {status?.webhook_url && <CopyField label="Webhook address" value={status.webhook_url} onCopied={() => show("Copied.", "success")} />}
              </Block>
              <Block title="Good to know">
                <p className={styles.hint}>
                  Anyone who replies STOP is opted out and skipped by broadcasts until they reply START.
                  {isTwilio ? " Delivery status for each text appears in your inbox." : ""}
                </p>
              </Block>
              <ConnectionDetailCard
                identity={status?.from_number ?? "Your number"}
                subtitle={`${providerName} SMS`}
                connectedAt={status?.connected_at ?? undefined}
                agentId={status?.agent_id ?? undefined}
                onDisconnect={disconnect}
                disconnectConfirmation="Incoming texts will stop being answered. Your contacts and chat setup are kept."
              />
            </>
          ),
        },
        { value: "setup", label: "Chat setup", icon: "gear", minRole: "manager", intro: "What the assistant says first and how it behaves in a text conversation.", render: () => <ChannelChatSetup channel="sms" /> },
        { value: "contacts", label: "Contacts", icon: "team", intro: "Everyone who has texted this number, including who has opted out.", render: () => <ChannelContacts channel="sms" /> },
        { value: "grow", label: "Grow", icon: "share", minRole: "manager", intro: "Keyword campaigns: people text a word to your number and get a reply or join a list.", render: () => <ChannelGrow channel="sms" /> },
        { value: "analytics", label: "Analytics", icon: "chart", intro: "Texts received and sent, and how many were delivered.", render: () => <ChannelAnalyticsTab channel="sms" /> },
      ]}
    />
  );
}

export default function SmsChannelPage() {
  return <ChannelGate channel="SMS">{(_businessId, agentId) => <SmsChannel agentId={agentId} />}</ChannelGate>;
}
