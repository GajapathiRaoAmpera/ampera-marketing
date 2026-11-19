import type { ReactNode } from "react";
import {
  WhatsAppIcon,
  InstagramIcon,
  MessengerIcon,
  WidgetIcon,
  TelegramIcon,
  DiscordIcon,
  SmsIcon,
  XIcon,
} from "@/components/layout/icons";
import type { ConversationChannel } from "@/types/api";

interface ChannelMeta {
  label: string;
  icon: ReactNode;
  color: string;
}

const CHANNEL_META: Record<string, ChannelMeta> = {
  whatsapp: { label: "WhatsApp", icon: <WhatsAppIcon size={14} />, color: "var(--color-whatsapp)" },
  whatsapp_group: { label: "WhatsApp Group", icon: <WhatsAppIcon size={14} />, color: "var(--color-whatsapp)" },
  instagram: { label: "Instagram", icon: <InstagramIcon size={14} />, color: "var(--color-instagram)" },
  messenger: { label: "Messenger", icon: <MessengerIcon size={14} />, color: "var(--color-messenger)" },
  widget: { label: "Website Widget", icon: <WidgetIcon size={14} />, color: "var(--color-brand-500)" },
  telegram: { label: "Telegram", icon: <TelegramIcon size={14} />, color: "#229ED9" },
  discord: { label: "Discord", icon: <DiscordIcon size={14} />, color: "#5865F2" },
  sms: { label: "SMS", icon: <SmsIcon size={14} />, color: "var(--color-text-secondary)" },
  twitter: { label: "X", icon: <XIcon size={14} />, color: "var(--color-text-primary)" },
};

export function getChannelMeta(channel: string): ChannelMeta {
  return CHANNEL_META[channel] ?? { label: channel, icon: null, color: "var(--color-text-tertiary)" };
}

export const CHANNEL_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All channels" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "messenger", label: "Messenger" },
  // Demo: Meta channels only.
];
