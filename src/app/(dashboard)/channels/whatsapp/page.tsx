import WhatsAppChannelPageClient from "./WhatsAppChannelPageClient";

export default function WhatsAppChannelPage() {
  return <WhatsAppChannelPageClient whatsappConfigId={process.env.NEXT_WHATSAPP_CONFIG_ID} />;
}
