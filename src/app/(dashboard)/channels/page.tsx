import Link from "next/link";
import {
  BotIcon,
  DiscordIcon,
  InstagramIcon,
  MessengerIcon,
  SmsIcon,
  TelegramIcon,
  TwilioIcon,
  XIcon,
  WebChatIcon,
  WhatsAppIcon,
} from "@/components/layout/icons";
import styles from "./page.module.scss";

const CHANNELS = [
  {
    id: "whatsapp",
    href: "/channels/whatsapp",
    name: "WhatsApp",
    eyebrow: "Messaging",
    description: "Reply instantly, launch campaigns and build customer journeys on the channel people open every day.",
    icon: <WhatsAppIcon size={32} />,
    badge: "Most popular",
    cta: "Set up WhatsApp",
    capabilities: ["AI replies", "Campaigns", "Flows"],
  },
  {
    id: "instagram",
    href: "/channels/instagram",
    name: "Instagram",
    eyebrow: "Social commerce",
    description: "Turn DMs and comments into helpful, personal conversations that keep your audience moving.",
    icon: <InstagramIcon size={32} />,
    badge: "Built for growth",
    cta: "Connect Instagram",
    capabilities: ["DM replies", "Comment automation"],
  },
  {
    id: "messenger",
    href: "/channels/messenger",
    name: "Messenger",
    eyebrow: "Facebook",
    description: "Give every Facebook Page visitor a fast answer without making your team watch another inbox.",
    icon: <MessengerIcon size={32} />,
    badge: "Easy setup",
    cta: "Connect Messenger",
    capabilities: ["Page messages", "Shared inbox"],
  },
  {
    id: "voice",
    href: "/channels/voice",
    name: "Voice Calling",
    eyebrow: "Powered by Twilio",
    description: "Let your AI agent answer calls, qualify leads and schedule follow-ups in a natural conversation.",
    icon: <TwilioIcon size={32} />,
    badge: "Real-time",
    cta: "Set up voice",
    capabilities: ["Inbound calls", "Outbound calls", "Recording"],
  },
  {
    id: "widget",
    href: "/channels/widget",
    name: "Website Widget",
    eyebrow: "Your website",
    description: "Welcome visitors with an on-brand assistant that answers questions and captures intent around the clock.",
    icon: <WebChatIcon size={32} />,
    badge: "Fully customizable",
    cta: "Design your widget",
    capabilities: ["Lead form", "Live handover", "24/7 chat"],
  },
  {
    id: "telegram",
    href: "/channels/telegram",
    name: "Telegram",
    eyebrow: "Messaging",
    description: "Run a bot that answers in private chats and groups, with buttons, commands and trackable links.",
    icon: <TelegramIcon size={32} />,
    badge: "One-minute setup",
    cta: "Connect Telegram",
    capabilities: ["Buttons & commands", "QR links", "Broadcasts"],
  },
  {
    id: "discord",
    href: "/channels/discord",
    name: "Discord",
    eyebrow: "Community",
    description: "Put your assistant in your server to answer members when they mention it, message it or use a slash command.",
    icon: <DiscordIcon size={32} />,
    badge: "For communities",
    cta: "Connect Discord",
    capabilities: ["Slash commands", "Mentions & DMs"],
  },
  {
    id: "sms",
    href: "/channels/sms",
    name: "SMS",
    eyebrow: "Powered by Twilio",
    description: "Answer text messages on your own number, run keyword campaigns and see what was delivered.",
    icon: <SmsIcon size={32} />,
    badge: "Works on any phone",
    cta: "Connect SMS",
    capabilities: ["Keyword campaigns", "Opt-out handling", "Delivery receipts"],
  },
  {
    id: "twitter",
    href: "/channels/twitter",
    name: "X (Twitter)",
    eyebrow: "Social",
    description: "Answer direct messages on X. Needs an X developer app on a paid X API plan.",
    icon: <XIcon size={32} />,
    badge: "Paid X API needed",
    cta: "Connect X",
    capabilities: ["Direct messages", "Instant answers"],
  },
] as const;

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ChannelsIndexPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span>✦</span> Omnichannel AI</div>
          <h1>Every conversation.<br /><em>One intelligent agent.</em></h1>
          <p>
            Meet customers wherever they prefer to talk, while your team manages every conversation from one place.
          </p>
          <div className={styles.heroProof}>
            <span><i /> One shared inbox</span>
            <span><i /> One source of knowledge</span>
            <span><i /> Always available</span>
          </div>
        </div>

        <div className={styles.channelConstellation} aria-hidden="true">
          <div className={styles.orbit} />
          <div className={styles.agentCore}>
            <span className={styles.agentIcon}><BotIcon size={25} /></span>
            <span><strong>Your AI agent</strong><small>Ready everywhere</small></span>
          </div>
          <span className={`${styles.floatingChannel} ${styles.floatingWhatsapp}`}><WhatsAppIcon size={27} /></span>
          <span className={`${styles.floatingChannel} ${styles.floatingInstagram}`}><InstagramIcon size={26} /></span>
          <span className={`${styles.floatingChannel} ${styles.floatingMessenger}`}><MessengerIcon size={27} /></span>
          <span className={`${styles.floatingChannel} ${styles.floatingVoice}`}><TwilioIcon size={26} /></span>
          <span className={`${styles.floatingChannel} ${styles.floatingWidget}`}><WebChatIcon size={26} /></span>
        </div>
      </section>

      <section className={styles.channelSection} aria-labelledby="channel-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.sectionKicker}>Pick your starting point</span>
            <h2 id="channel-heading">Connect a channel</h2>
          </div>
          <p>Start with one today. Add the rest whenever you&apos;re ready.</p>
        </div>

        <div className={styles.grid}>
          {CHANNELS.map((channel) => (
            <Link
              key={channel.href}
              href={channel.href}
              className={styles.channelCard}
              data-channel={channel.id}
            >
              <span className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.cardTop}>
                <span className={styles.iconBadge} aria-hidden="true">{channel.icon}</span>
                <span className={styles.badge}>{channel.badge}</span>
              </div>

              <div className={styles.cardContent}>
                <span className={styles.cardEyebrow}>{channel.eyebrow}</span>
                <h3>{channel.name}</h3>
                <p>{channel.description}</p>
              </div>

              <div className={styles.capabilities} aria-label={`${channel.name} features`}>
                {channel.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
              </div>

              <div className={styles.cardCta}>
                <span>{channel.cta}</span>
                <span className={styles.arrow}><ArrowIcon /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
