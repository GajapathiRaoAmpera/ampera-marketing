/* eslint-disable @typescript-eslint/no-explicit-any */
// Seed data for the no-backend demo. One fictional brand ("Kaveri Organics") with WhatsApp,
// Instagram and a Facebook Page (Messenger) connected. Times are relative to page load so the
// demo always looks live. Everything here is made up.

const now = Date.now();
export const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
export const ahead = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
const day = (offset: number) => new Date(now - offset * 86_400_000).toISOString().slice(0, 10);

/** A gradient tile with an emoji, as a data URI: renders offline and passes the CSP (img-src data:). */
export function art(emoji: string, hue: number, label = ""): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},65%,38%)"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><text x="300" y="320" font-size="220" text-anchor="middle" dominant-baseline="middle">${emoji}</text><text x="300" y="520" font-family="sans-serif" font-size="40" font-weight="600" fill="white" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const BUSINESS_ID = "biz_kaveri";

export const AGENT_ID = "agt_asha";
export const IG_CONNECTION_ID = "igc_kaveri";
export const FB_PAGE_ID = "104857362910";
export const WABA_ID = "waba_10293847";
export const WA_NUMBER = "+91 80 4567 1234";

export const agent: any = { id: AGENT_ID, name: "Asha", status: "running" };

export const user = {
  user_id: "usr_demo",
  name: "Priya Raman",
  email: "demo@amperatech.ai",
  role: "owner",
  email_verified: true,
  timezone: "Asia/Kolkata",
  is_platform_admin: false,
};

export const business: any = {
  id: BUSINESS_ID,
  user_id: user.user_id,
  is_owner: true,
  team_role: null,
  name: "Kaveri Organics",
  agent_id: AGENT_ID,
  description: "Cold-pressed oils, millets and organic pantry staples, delivered across India.",
  website: "https://kaveri-organics.example",
  location: "Bengaluru, Karnataka",
  working_hours: "Mon–Sat, 9am–7pm",
  products_services: "Cold-pressed oils, millets, jaggery, honey, gift hampers",
  pricing: "₹149 – ₹2,499",
  agent_name: "Asha",
  tone: "friendly",
  language: "English, Hindi, Kannada",
  onboarding: { completed_steps: ["profile", "channel", "agent", "knowledge"], missing_fields: [], total_steps: 4, is_complete: true },
  follow_up_enabled: true,
  follow_up_no_response_hours: 24,
};

const meter = (used: number, limit: number | null) => ({
  used,
  limit,
  remaining: limit === null ? null : limit - used,
  period: new Date(now).toISOString().slice(0, 7),
  lifetime: false,
});

const feature = (key: string, label: string, category: "channel" | "feature", enabled = true) => ({ key, label, description: label, category, enabled });

export const entitlements: any = {
  approval_status: "approved",
  awaiting_approval: false,
  plan_id: "pro",
  plan_name: "Pro",
  is_trial: false,
  is_expired: false,
  subscription: {
    state: "paid",
    billing_interval: "annual",
    in_grace: false,
    trial: null,
    countdown: { kind: "subscription", ends_at: ahead(60 * 24 * 240), seconds_remaining: 240 * 86400, days_remaining: 240, expired: false },
  },
  features: [
    feature("whatsapp_enabled", "WhatsApp", "channel"),
    feature("instagram_enabled", "Instagram", "channel"),
    feature("messenger_enabled", "Messenger", "channel"),
    feature("voice_calling_enabled", "Voice calling", "channel", false),
    feature("telegram_enabled", "Telegram", "channel", false),
    feature("discord_enabled", "Discord", "channel", false),
    feature("sms_enabled", "SMS", "channel", false),
    feature("twitter_enabled", "X (Twitter)", "channel", false),
    feature("ai_replies_enabled", "AI replies", "feature"),
  ],
  limits: [
    { key: "messages_per_month", label: "Messages per month", value: 50000 },
    { key: "team_seats", label: "Team seats", value: 10 },
  ],
  usage: { ai_replies: meter(8421, 25000), automated_replies: meter(12904, 50000) },
  connected_channels: ["whatsapp", "instagram", "messenger"],
};

// ── Inbox ────────────────────────────────────────────────────────────────

type Msg = { role: "user" | "assistant" | "human_agent" | "system"; content: string; min: number; meta?: Record<string, unknown> };
interface Convo {
  channel: "whatsapp" | "instagram" | "messenger";
  user_key: string;
  name: string;
  handle?: string;
  lead_label: "cold" | "warm" | "hot" | "very_hot";
  lead_score: number;
  sentiment: "positive" | "neutral" | "negative";
  status: "open" | "human_active" | "resolved";
  ai_enabled: boolean;
  tags: string[];
  intent: string;
  messages: Msg[];
}

const seedConvos: Convo[] = [
  {
    channel: "whatsapp", user_key: "919845012345", name: "Ananya Iyer", lead_label: "very_hot", lead_score: 92, sentiment: "positive",
    status: "open", ai_enabled: true, tags: ["bulk-order", "diwali"], intent: "purchase",
    messages: [
      { role: "user", content: "Hi! Do you do corporate Diwali hampers? Need about 120 boxes.", min: 46 },
      { role: "assistant", content: "Hi Ananya! 🪔 Yes, we do. Our Festive Hamper (₹1,299) has cold-pressed groundnut oil, jaggery, wild honey and millet cookies. For 100+ boxes there's 12% off and free custom branding.", min: 45 },
      { role: "user", content: "That sounds perfect. Can you deliver to 3 offices in Bengaluru by the 28th?", min: 31 },
      { role: "assistant", content: "Absolutely, multi-address delivery within Bengaluru is free for bulk orders. To confirm the 28th I'll need the final count and addresses. Shall I send you the order form?", min: 30 },
      { role: "user", content: "Yes please, and the GST invoice details too", min: 4 },
    ],
  },
  {
    channel: "instagram", user_key: "17841400111", name: "Rohit Menon", handle: "@rohit.cooks", lead_label: "hot", lead_score: 78, sentiment: "positive",
    status: "open", ai_enabled: true, tags: ["reel-comment"], intent: "price_enquiry",
    messages: [
      { role: "system", content: "Replied to your reel: “Why we cold-press at under 40°C”", min: 95 },
      { role: "user", content: "PRICE", min: 95 },
      { role: "assistant", content: "Hey Rohit! 👋 The 1L cold-pressed coconut oil is ₹449 and the 3-pack is ₹1,199. Want the link?", min: 95 },
      { role: "user", content: "yes send. also is it ok for deep frying?", min: 12 },
      { role: "assistant", content: "Here you go: kaveri-organics.example/coconut-oil 🥥 It handles medium-heat frying well (smoke point ~175°C). For deep frying, our groundnut oil (smoke point ~230°C) is the better pick.", min: 11 },
    ],
  },
  {
    channel: "messenger", user_key: "6021984471", name: "Fatima Sheikh", lead_label: "warm", lead_score: 55, sentiment: "negative",
    status: "human_active", ai_enabled: false, tags: ["delivery-issue"], intent: "support",
    messages: [
      { role: "user", content: "My order KO-48213 was supposed to arrive yesterday, still nothing", min: 70 },
      { role: "assistant", content: "I'm sorry about the delay, Fatima. I can see KO-48213 is with our courier in Hyderabad. I'm bringing in a teammate to sort this out for you right away.", min: 69 },
      { role: "system", content: "Asha handed this conversation to the team", min: 69 },
      { role: "human_agent", content: "Hi Fatima, Priya here. I've escalated with the courier, it's out for delivery today before 6pm. I've also added a ₹100 credit to your account for the trouble.", min: 22, meta: { sent_by: "Priya Raman", delivery_status: "read" } },
      { role: "user", content: "Okay thank you, appreciate it", min: 8 },
    ],
  },
  {
    channel: "whatsapp", user_key: "919900112233", name: "Karthik S", lead_label: "hot", lead_score: 81, sentiment: "neutral",
    status: "open", ai_enabled: true, tags: ["catalog"], intent: "purchase",
    messages: [
      { role: "user", content: "Show me your millets", min: 130 },
      { role: "assistant", content: "Here's our millet range 🌾 Foxtail, little, kodo and barnyard millet, ₹149–₹189 per 500g. Tap any product to add it to your cart.", min: 130, meta: { kind: "catalog" } },
      { role: "user", content: "Added 4 packs. How do I pay?", min: 18 },
      { role: "assistant", content: "Great choice! Your total is ₹676. You can pay right here in WhatsApp with UPI. I've sent the payment request above 👆", min: 17 },
    ],
  },
  {
    channel: "instagram", user_key: "17841400222", name: "Sneha Kulkarni", handle: "@snehaeatsclean", lead_label: "warm", lead_score: 48, sentiment: "positive",
    status: "open", ai_enabled: true, tags: ["story-mention", "influencer"], intent: "collaboration",
    messages: [
      { role: "system", content: "Mentioned you in their story", min: 300 },
      { role: "assistant", content: "Thanks so much for the shout-out, Sneha! 💚 Here's 15% off your next order: SNEHA15", min: 299 },
      { role: "user", content: "Love your jaggery! Do you collaborate with creators? I have 38k followers, mostly clean-eating content", min: 52 },
      { role: "assistant", content: "We'd love that! I've passed your details to our partnerships team. They usually reply within a day. Could you share your email?", min: 51 },
    ],
  },
  {
    channel: "messenger", user_key: "6021984472", name: "David Fernandes", lead_label: "cold", lead_score: 22, sentiment: "neutral",
    status: "resolved", ai_enabled: true, tags: [], intent: "faq",
    messages: [
      { role: "user", content: "Are your products certified organic?", min: 1440 },
      { role: "assistant", content: "Yes! All our products are certified under India Organic (NPOP) and many are also USDA Organic. You'll find the certificate number on every pack.", min: 1440 },
      { role: "user", content: "👍", min: 1438 },
    ],
  },
  {
    channel: "whatsapp", user_key: "919812398123", name: "Meera Pillai", lead_label: "warm", lead_score: 61, sentiment: "positive",
    status: "open", ai_enabled: true, tags: ["repeat-customer"], intent: "reorder",
    messages: [
      { role: "user", content: "Reorder my usual please 🙏", min: 210 },
      { role: "assistant", content: "Welcome back, Meera! Your usual is 2× sesame oil (1L) and 1× wild honey (500g) = ₹1,147. Same address in Indiranagar?", min: 210 },
      { role: "user", content: "Yes same", min: 205 },
      { role: "assistant", content: "Done ✅ Order KO-48377 is confirmed and will reach you tomorrow. I'll message you when it ships.", min: 205 },
    ],
  },
  {
    channel: "instagram", user_key: "17841400333", name: "Arjun Rao", handle: "@arjun.fitlife", lead_label: "hot", lead_score: 74, sentiment: "neutral",
    status: "human_active", ai_enabled: false, tags: ["wholesale"], intent: "wholesale",
    messages: [
      { role: "user", content: "I run 3 gyms in Pune. Interested in stocking your protein laddoos. Wholesale rates?", min: 160 },
      { role: "assistant", content: "That's great to hear, Arjun! Wholesale pricing depends on volume, so I'm connecting you with our B2B team.", min: 159 },
      { role: "system", content: "Asha handed this conversation to the team", min: 159 },
    ],
  },
  {
    channel: "whatsapp", user_key: "919741200001", name: "Lakshmi Narayan", lead_label: "cold", lead_score: 30, sentiment: "neutral",
    status: "resolved", ai_enabled: true, tags: [], intent: "order_status",
    messages: [
      { role: "user", content: "Where is my order?", min: 2900 },
      { role: "assistant", content: "Hi Lakshmi! Order KO-47990 was delivered yesterday at 4:12pm and signed for by “L. Narayan”. Anything else I can help with?", min: 2900 },
      { role: "user", content: "Oh yes got it, thanks", min: 2895 },
    ],
  },
  {
    channel: "messenger", user_key: "6021984473", name: "Neha Gupta", lead_label: "hot", lead_score: 70, sentiment: "positive",
    status: "open", ai_enabled: true, tags: ["ad-lead"], intent: "purchase",
    messages: [
      { role: "system", content: "Started from your ad “Festive Hampers, 15% off”", min: 38 },
      { role: "user", content: "Is the 15% off still on?", min: 38 },
      { role: "assistant", content: "It is, Neha! 🎁 Use FESTIVE15 at checkout, valid till Sunday. Want me to show you the hamper options?", min: 37 },
      { role: "user", content: "yes show me", min: 2 },
    ],
  },
];

// The inbox has no style for system notes (the backend never sends them), so they stay out.
const convos = seedConvos.map((c) => ({ ...c, messages: c.messages.filter((m) => m.role !== "system") }));

export const conversations: any[] = convos.map((c) => {
  const key = `${AGENT_ID}:${c.channel}:${c.user_key}`;
  const last = c.messages[c.messages.length - 1];
  return {
    conversation_key: key,
    agent_id: AGENT_ID,
    agent_name: "Asha",
    channel: c.channel,
    user_key: c.user_key,
    display_user_key: c.channel === "whatsapp" ? `+${c.user_key}` : c.handle ?? c.user_key,
    display_name: c.name,
    handle: c.handle ?? null,
    avatar_url: null,
    reply_window:
      c.channel === "messenger"
        ? { state: last.min < 1440 ? "open" : "closed", last_inbound_at: ago(last.min), standard_closes_at: ahead(1440 - last.min), human_closes_at: ahead(10080 - last.min) }
        : null,
    last_message: last.content,
    last_role: last.role,
    last_at: ago(last.min),
    message_count: c.messages.length,
    ai_enabled: c.ai_enabled,
    account_ai_enabled: true,
    status: c.status,
    assigned_team_member: c.status === "human_active" ? "Priya Raman" : null,
    lead_label: c.lead_label,
    lead_score: c.lead_score,
    lead_reason: null,
    sentiment: c.sentiment,
    sentiment_score: c.sentiment === "positive" ? 0.8 : c.sentiment === "negative" ? -0.6 : 0,
    language: "en",
    // Extra fields for the per-business detail view.
    _tags: c.tags,
    _intent: c.intent,
  };
});

export const messages: Record<string, any[]> = Object.fromEntries(
  convos.map((c, ci) => [
    `${AGENT_ID}:${c.channel}:${c.user_key}`,
    c.messages.map((m, mi) => ({
      id: `msg_${ci}_${mi}`,
      role: m.role,
      content: m.content,
      created_at: ago(m.min),
      metadata: { delivery_status: m.role === "user" ? undefined : "read", ...(m.meta ?? {}) },
    })),
  ])
);

export const quickReplies = [
  { id: "qr1", label: "Shipping times", body: "We ship within 24 hours. Metro cities get delivery in 2–3 days, others in 4–6 days." },
  { id: "qr2", label: "Bulk discount", body: "Orders of 100+ units get 12% off plus free custom branding." },
  { id: "qr3", label: "Return policy", body: "Unopened products can be returned within 7 days for a full refund." },
];

// ── Dashboard, leads, notifications ─────────────────────────────────────

export const notifications: any[] = [
  { id: "n1", user_id: user.user_id, type: "hot_lead", title: "Hot lead on WhatsApp", body: "Ananya Iyer wants 120 Diwali hampers", read: false, created_at: ago(4), metadata: { conversation_key: conversations[0].conversation_key } },
  { id: "n2", user_id: user.user_id, type: "human_required", title: "Arjun Rao needs a person", body: "Wholesale enquiry on Instagram was handed to the team", read: false, created_at: ago(159) },
  { id: "n3", user_id: user.user_id, type: "campaign_completed", title: "Campaign finished", body: "“Festive launch” reached 2,140 contacts, 61% read", read: true, created_at: ago(1440) },
  { id: "n4", user_id: user.user_id, type: "template_approved", title: "Template approved", body: "Meta approved “order_shipped_v2”", read: true, created_at: ago(2880) },
];

export const hotLeads: any[] = conversations
  .filter((c) => c.lead_score >= 60)
  .map((c) => ({
    customer_id: `cus_${c.user_key}`,
    name: c.display_name,
    phone: c.display_user_key,
    lead_score: c.lead_score,
    lead_status: c.lead_label,
    requirements: [c._intent.replace("_", " ")],
    budget: c.lead_score > 85 ? "₹1.5L+" : undefined,
    tags: c._tags,
    notes: null,
    last_interaction: c.last_at,
    last_signal: c.last_message,
    recommended_action: c.lead_score > 85 ? "Send the order form and GST details today" : "Follow up with a product link",
    conversation: { conversation_key: c.conversation_key, status: c.status, last_activity: c.last_at, intent: c._intent },
    channel: c.channel,
  }));

export const followUps: any[] = [
  { id: "fu1", customer: { id: "cus_919812398123", name: "Meera Pillai", phone: "+919812398123", tags: ["repeat-customer"] }, suggested_message: "Hi Meera! Hope you loved the sesame oil. Our new cold-pressed mustard oil just launched, want a sample with your next order?", reason: "Repeat buyer, 30 days since last order", status: "pending", created_at: ago(120) },
  { id: "fu2", customer: { id: "cus_17841400222", name: "Sneha Kulkarni", phone: "@snehaeatsclean", tags: ["influencer"] }, suggested_message: "Hi Sneha, following up on the creator collab. Could you share your email so our team can send the brief?", reason: "No reply for 24 hours", status: "pending", created_at: ago(60) },
];

export const dashboardHome = () => ({
  today: { new_conversations: 37, active_conversations: 18, hot_leads_count: hotLeads.length, human_required_count: 2, ai_resolutions: 29, conversions: 9 },
  attention_required: {
    hot_leads: hotLeads.slice(0, 3),
    waiting_for_human: conversations.filter((c) => c.status === "human_active").map((c) => ({ ...c, customer: { id: c.user_key, name: c.display_name } })),
    follow_ups_due: followUps,
    open_knowledge_gaps_count: 3,
  },
  recent_conversations: conversations.map((c) => ({
    conversation_key: c.conversation_key,
    customer: { id: c.user_key, name: c.display_name, phone: c.display_user_key },
    channel: c.channel,
    status: c.status,
    lead_score: c.lead_score,
    lead_status: c.lead_label,
    tags: c._tags,
    ai_enabled: c.ai_enabled,
    last_activity: c.last_at,
    last_message: c.last_message,
  })),
});

// ── WhatsApp ────────────────────────────────────────────────────────────

export const waConnection = {
  id: "wac_1",
  phone_number: WA_NUMBER,
  display_name: "Kaveri Organics",
  status: "connected",
  business_name: "Kaveri Organics",
  verified_name: "Kaveri Organics",
  agent_id: AGENT_ID,
  webhook_configured: true,
  connected_at: ago(60 * 24 * 92),
  whatsapp_business_account_id: WABA_ID,
};

const tpl = (name: string, category: string, status: string, body: string, extra: any[] = [], min = 5000) => ({
  id: `tpl_${name}`,
  name,
  category,
  language: "en_US",
  status,
  components: [{ type: "BODY", text: body, ...(body.includes("{{1}}") ? { example: { body_text: [["Ananya", "KO-48213"]] } } : {}) }, ...extra],
  rejected_reason: status === "REJECTED" ? "Promotional content in a UTILITY template" : null,
  created_at: ago(min),
  updated_at: ago(min - 30),
});

export const waTemplates: any[] = [
  tpl("festive_launch", "MARKETING", "APPROVED", "Hi {{1}} 🪔 Our Festive Hampers are here! Cold-pressed oils, jaggery and wild honey in one gift box. Use code {{2}} for 15% off.", [
    { type: "HEADER", format: "IMAGE", example: { header_handle: [art("🎁", 20)] } },
    { type: "FOOTER", text: "Reply STOP to opt out" },
    { type: "BUTTONS", buttons: [{ type: "URL", text: "Shop hampers", url: "https://kaveri-organics.example/hampers" }, { type: "QUICK_REPLY", text: "Talk to us" }] },
  ], 9000),
  tpl("order_shipped_v2", "UTILITY", "APPROVED", "Hi {{1}}, your order {{2}} has shipped 🚚 Track it anytime with the button below.", [
    { type: "BUTTONS", buttons: [{ type: "URL", text: "Track order", url: "https://kaveri-organics.example/track/{{1}}" }] },
  ], 4000),
  tpl("payment_reminder", "UTILITY", "APPROVED", "Hi {{1}}, your cart ({{2}}) is still waiting. Tap below to finish paying with UPI.", [], 3000),
  tpl("restock_alert", "MARKETING", "PENDING", "Good news {{1}}! {{2}} is back in stock. Grab it before it sells out again.", [], 90),
  tpl("weekend_flash_sale", "UTILITY", "REJECTED", "Flash sale this weekend only: 25% off everything!", [], 2000),
  tpl("login_code", "AUTHENTICATION", "APPROVED", "{{1}} is your verification code.", [{ type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy code" }] }], 8000),
];

const firstNames = ["Aditi", "Rahul", "Divya", "Vikram", "Pooja", "Sanjay", "Kavya", "Nikhil", "Ishita", "Manoj", "Ritu", "Harish", "Swati", "Gaurav", "Anjali", "Suresh"];
const lastNames = ["Sharma", "Reddy", "Nair", "Joshi", "Patel", "Das", "Bhat", "Kapoor"];
const tagSets = [["diwali", "vip"], ["repeat-customer"], ["new"], ["bulk-order"], ["ad-lead"], []];
export const waContacts: any[] = [
  ...convos.filter((c) => c.channel === "whatsapp").map((c) => ({ name: c.name, phone: `+${c.user_key}`, tags: c.tags, lead_status: c.lead_label })),
  ...firstNames.map((f, i) => ({
    name: `${f} ${lastNames[i % lastNames.length]}`,
    phone: `+9198${String(45000000 + i * 7919).padStart(8, "0")}`,
    tags: tagSets[i % tagSets.length],
    lead_status: ["cold", "warm", "hot"][i % 3],
  })),
].map((c, i) => ({
  id: `wct_${i}`,
  business_id: BUSINESS_ID,
  phone: c.phone,
  name: c.name,
  email: null,
  tags: c.tags,
  custom_fields: { city: ["Bengaluru", "Mumbai", "Chennai", "Pune", "Hyderabad"][i % 5] },
  lead_status: c.lead_status,
  whatsapp_opt_in: i % 7 !== 3,
  opt_in_source: i % 4 === 0 ? "click_to_whatsapp_ad" : "checkout",
  ad_source: i % 4 === 0 ? "Festive Hampers, 15% off" : undefined,
  source: "whatsapp",
  updated_at: ago(i * 300),
  last_interaction: ago(i * 300 + 20),
}));

export const waSegments: any[] = [
  { id: "seg_all", business_id: BUSINESS_ID, name: "All opted-in", description: "All opted-in WhatsApp contacts", rules: { tags_any: [], lead_statuses: [], sources: [], whatsapp_opt_in: true, interacted_within_days: null }, contact_count: 2140 },
  { id: "seg_vip", business_id: BUSINESS_ID, name: "Diwali VIPs", description: "Contacts tagged vip", rules: { tags_any: ["vip"], lead_statuses: [], sources: [], whatsapp_opt_in: true, interacted_within_days: null }, contact_count: 312 },
  { id: "seg_repeat", business_id: BUSINESS_ID, name: "Repeat customers", description: "Contacts tagged repeat-customer", rules: { tags_any: ["repeat-customer"], lead_statuses: [], sources: [], whatsapp_opt_in: true, interacted_within_days: null }, contact_count: 684 },
];

const step = (template_name: string, delay_minutes = 0, parameters = ["name", "FESTIVE15"]) => ({ name: template_name, template_name, language_code: "en_US", delay_minutes, parameters, header_media_url: null });
export const waCampaigns: any[] = [
  { id: "cmp_1", name: "Festive launch", mode: "broadcast", segment_id: "seg_all", steps: [step("festive_launch")], status: "completed", scheduled_at: ago(1500), sent_count: 2140, audience: { total: 2140, scheduled: 0, completed: 2140, failed: 18, converted: 96, delivered: 2098, read: 1306 } },
  { id: "cmp_2", name: "VIP early access", mode: "broadcast", segment_id: "seg_vip", steps: [step("festive_launch")], status: "active", scheduled_at: ago(45), sent_count: 188, audience: { total: 312, scheduled: 124, completed: 188, failed: 2, converted: 14, delivered: 186, read: 121 } },
  { id: "cmp_3", name: "Win-back drip", mode: "drip", segment_id: "seg_repeat", steps: [step("payment_reminder", 0, ["name", "cart"]), step("festive_launch", 2880)], status: "scheduled", scheduled_at: ahead(600), sent_count: 0, audience: { total: 684, scheduled: 684, completed: 0, failed: 0, converted: 0, delivered: 0, read: 0 } },
  { id: "cmp_4", name: "Restock nudge", mode: "broadcast", segment_id: "seg_repeat", steps: [step("restock_alert", 0, ["name", "Wild honey"])], status: "draft", scheduled_at: ahead(2000), sent_count: 0 },
];

const node = (id: string, type: string, x: number, y: number, label: string, config: Record<string, unknown> = {}) => ({ id, type, x, y, label, config });
const edge = (source: string, target: string, source_handle = "next") => ({ id: `${source}-${target}-${source_handle}`, source, target, source_handle });
export const waFlows: any[] = [
  {
    id: "flw_welcome", business_id: BUSINESS_ID, name: "Welcome menu", description: "Greets new customers and routes them", trigger_type: "first_message", trigger_config: {},
    status: "published", draft_revision: 4, published_version: 3, updated_at: ago(3000), active_sessions: 12,
    graph: {
      nodes: [
        node("start", "start", 60, 200, "Start"),
        node("greet", "text", 300, 200, "Greeting", { text: "Namaste! 🙏 Welcome to Kaveri Organics. What can I help you with?" }),
        node("menu", "buttons", 560, 200, "Main menu", { text: "Choose one:", buttons: [{ id: "shop", title: "Shop products" }, { id: "track", title: "Track order" }, { id: "human", title: "Talk to us" }] }),
        node("catalog", "ai_reply", 840, 80, "Product help (AI)", {}),
        node("track", "user_input", 840, 220, "Ask order no.", { prompt: "Please share your order number (e.g. KO-12345)", variable: "order_no" }),
        node("handoff", "human_handoff", 840, 360, "Hand to team", {}),
        node("end", "end", 1100, 220, "End"),
      ],
      edges: [edge("start", "greet"), edge("greet", "menu"), edge("menu", "catalog", "shop"), edge("menu", "track", "track"), edge("menu", "handoff", "human"), edge("track", "end")],
    },
  },
  {
    id: "flw_bulk", business_id: BUSINESS_ID, name: "Bulk order intake", description: "Collects corporate gifting details", trigger_type: "keyword", trigger_config: { keywords: ["bulk", "corporate", "hamper"] },
    status: "published", draft_revision: 2, published_version: 2, updated_at: ago(6000), active_sessions: 3,
    graph: {
      nodes: [node("start", "start", 60, 200, "Start"), node("form", "form", 320, 200, "Gifting form", { meta_flow_id: "mf_gifting" }), node("handoff", "human_handoff", 600, 200, "Notify sales"), node("end", "end", 860, 200, "End")],
      edges: [edge("start", "form"), edge("form", "handoff"), edge("handoff", "end")],
    },
  },
  {
    id: "flw_feedback", business_id: BUSINESS_ID, name: "Post-delivery feedback", description: "Asks for a rating after delivery", trigger_type: "intent", trigger_config: { intent: "feedback" },
    status: "draft", draft_revision: 1, published_version: null, updated_at: ago(400), active_sessions: 0,
    graph: { nodes: [node("start", "start", 60, 200, "Start"), node("ask", "buttons", 320, 200, "Rate us", { text: "How was your order?", buttons: [{ id: "good", title: "😍 Loved it" }, { id: "ok", title: "🙂 Okay" }, { id: "bad", title: "😞 Not great" }] }), node("end", "end", 600, 200, "End")], edges: [edge("start", "ask"), edge("ask", "end", "good")] },
  },
];

export const waMetaFlows: any[] = [
  { id: "mf_gifting", name: "Corporate gifting form", status: "PUBLISHED", categories: ["LEAD_GENERATION"] },
  { id: "mf_feedback", name: "Delivery feedback", status: "DRAFT", categories: ["SURVEY"] },
];

export const waSubmissions: any[] = [
  { id: "sub1", business_id: BUSINESS_ID, flow_id: "flw_bulk", node_id: "form", node_label: "Gifting form", meta_flow_id: "mf_gifting", contact_phone: "+919845012345", answers: { company: "Northwind Analytics", boxes: "120", delivery_date: day(-9), budget: "₹1,30,000" }, created_at: ago(40) },
  { id: "sub2", business_id: BUSINESS_ID, flow_id: "flw_bulk", node_id: "form", node_label: "Gifting form", meta_flow_id: "mf_gifting", contact_phone: "+919811122233", answers: { company: "Brightside Schools", boxes: "60", delivery_date: day(-14), budget: "₹70,000" }, created_at: ago(1800) },
];

const product = (i: number, sku: string, name: string, price: number, inventory: number, emoji: string, hue: number) => ({
  id: `prd_${i}`, sku, name, description: `${name}, small-batch and certified organic.`, price: price.toFixed(2), price_minor: price * 100, currency: "INR",
  inventory, reserved_inventory: Math.floor(inventory / 10), image_url: art(emoji, hue, name.split(" ").slice(-2).join(" ")), active: true, meta_product_id: `mp_${i}`, meta_catalog_id: "cat_kaveri",
});
export const waProducts: any[] = [
  product(1, "KO-GNO-1L", "Cold-pressed Groundnut Oil 1L", 389, 240, "🥜", 35),
  product(2, "KO-CCO-1L", "Cold-pressed Coconut Oil 1L", 449, 180, "🥥", 150),
  product(3, "KO-SES-1L", "Cold-pressed Sesame Oil 1L", 429, 95, "🫙", 45),
  product(4, "KO-FXM-500", "Foxtail Millet 500g", 169, 400, "🌾", 60),
  product(5, "KO-HNY-500", "Wild Forest Honey 500g", 289, 60, "🍯", 30),
  product(6, "KO-HMP-FST", "Festive Hamper", 1299, 140, "🎁", 330),
];

export const waOrders: any[] = [
  { id: "ord_48377", status: "paid", inventory_status: "committed", amount_minor: 114700, currency: "INR", customer_phone: "+919812398123", created_at: ago(205), fulfillment_status: "processing", tracking_reference: null, payment_method: "upi", upi_reference: "UPI4471029381", items: [{ product_id: "prd_3", sku: "KO-SES-1L", name: "Cold-pressed Sesame Oil 1L", quantity: 2, unit_price_minor: 42900, line_total_minor: 85800 }, { product_id: "prd_5", sku: "KO-HNY-500", name: "Wild Forest Honey 500g", quantity: 1, unit_price_minor: 28900, line_total_minor: 28900 }] },
  { id: "ord_48390", status: "pending_payment", inventory_status: "reserved", amount_minor: 67600, currency: "INR", customer_phone: "+919900112233", created_at: ago(17), fulfillment_status: null, payment_method: "upi", upi_reference: null, items: [{ product_id: "prd_4", sku: "KO-FXM-500", name: "Foxtail Millet 500g", quantity: 4, unit_price_minor: 16900, line_total_minor: 67600 }] },
  { id: "ord_48213", status: "paid", inventory_status: "committed", amount_minor: 129900, currency: "INR", customer_phone: "+919733344455", created_at: ago(4300), fulfillment_status: "shipped", tracking_reference: "DLV7781234", payment_method: null, items: [{ product_id: "prd_6", sku: "KO-HMP-FST", name: "Festive Hamper", quantity: 1, unit_price_minor: 129900, line_total_minor: 129900 }] },
  { id: "ord_47990", status: "paid", inventory_status: "committed", amount_minor: 38900, currency: "INR", customer_phone: "+919741200001", created_at: ago(5800), fulfillment_status: "fulfilled", tracking_reference: "DLV7700021", payment_method: "upi", upi_reference: "UPI4470021111", items: [{ product_id: "prd_1", sku: "KO-GNO-1L", name: "Cold-pressed Groundnut Oil 1L", quantity: 1, unit_price_minor: 38900, line_total_minor: 38900 }] },
];

export const waSettings: any = {
  number: { phone_number: WA_NUMBER, verified_name: "Kaveri Organics", quality_rating: "GREEN", status: "CONNECTED", connected_at: waConnection.connected_at },
  ai_enabled: true,
  group_replies_enabled: false,
  ai_allowed: true,
  upi_id: "kaveriorganics@okhdfc",
  upi_payee_name: "Kaveri Organics Pvt Ltd",
  automation: {
    hours: { enabled: true, timezone: "Asia/Kolkata", days: { mon: [["09:00", "19:00"]], tue: [["09:00", "19:00"]], wed: [["09:00", "19:00"]], thu: [["09:00", "19:00"]], fri: [["09:00", "19:00"]], sat: [["10:00", "16:00"]], sun: [] } },
    away: { enabled: true, message: "Thanks for messaging Kaveri Organics! 🌿 We're closed right now, but Asha (our assistant) can help with orders and FAQs." },
    order_updates: { enabled: true },
    cart_reminder: { enabled: true, after_minutes: 60, message: "Your Kaveri cart is waiting! Tap below to pay with UPI, or reply if you have questions." },
    missed_call: { enabled: true, message: "Sorry we missed your call! Message us here and we'll reply right away." },
    payment_configuration: "upi",
  },
};

export const waProfile: any = {
  profile: {
    about: "Pure. Cold-pressed. Organic. 🌿",
    description: "Cold-pressed oils, millets and organic pantry staples from Karnataka farms.",
    address: "12, 4th Cross, Indiranagar, Bengaluru 560038",
    email: "hello@kaveri-organics.example",
    websites: ["https://kaveri-organics.example"],
    vertical: "GROCERY",
    profile_picture_url: art("🌿", 140),
  },
  verticals: ["GROCERY", "RETAIL", "FOOD", "HEALTH", "OTHER"],
};

const perDay = (days: number, base: number) =>
  Array.from({ length: days }, (_, i) => ({ date: day(days - 1 - i), received: Math.round(base + 40 * Math.sin(i / 1.7) + i * 3), sent: Math.round(base * 1.3 + 50 * Math.cos(i / 2) + i * 4) }));
export const waInsights = (days: number) => ({
  days,
  chats: 186 * Math.ceil(days / 7),
  new_contacts: 74 * Math.ceil(days / 7),
  messages_received: 1420 * Math.ceil(days / 7),
  messages_sent: 1985 * Math.ceil(days / 7),
  answered_by: { ai: 612, menu: 188, flow: 97, team: 141, away: 36, other: 12 },
  orders: { created: 64, paid: 51, revenue_minor: 4_87_600_00, revenue_by_source_minor: { ai: 2_10_400_00, campaign: 1_62_300_00, catalog: 1_14_900_00 } },
  ads: { chats: 212, revenue_minor: 98_400_00 },
  per_day: perDay(days, 120),
  campaigns: [
    { id: "cmp_1", name: "Festive launch", sent: 2140, read: 1306, buyers: 96, revenue_minor: 1_24_700_00 },
    { id: "cmp_2", name: "VIP early access", sent: 188, read: 121, buyers: 14, revenue_minor: 37_600_00 },
  ],
});

export const waOverview = () => ({
  plan_id: "pro",
  limits: { messages_per_month: 50000, whatsapp_accounts: 3, team_seats: 10, contacts: 25000, widget_sites: 3 },
  usage: { period: new Date(now).toISOString().slice(0, 7), used: 12904, limit: 50000, remaining: 37096, plan_id: "pro" },
  counts: { contacts: 2318, opted_in_contacts: 2140, segments: waSegments.length, team_seats: 4, whatsapp_accounts: 1 },
  readiness: { official_connection: true, connection_status: "ready", secure_inbound_webhook: true, approved_templates: waTemplates.filter((t) => t.status === "APPROVED").length, payments_configured: true, receipt_template_configured: true },
});

export const waHealth = {
  connection: { waba_id: WABA_ID, phone_number: WA_NUMBER },
  linked_agent: { id: AGENT_ID, name: "Asha", status: "active", has_number: true },
  agents: [{ id: AGENT_ID, name: "Asha", status: "active", has_number: true }],
  problems: [],
  last_issue: null,
};

// ── Instagram ───────────────────────────────────────────────────────────

export const igConnection: any = {
  id: IG_CONNECTION_ID,
  business_id: BUSINESS_ID,
  instagram_business_id: "17841455500011",
  instagram_username: "kaveri.organics",
  agent_id: AGENT_ID,
  auth_mode: "instagram_login",
  health_status: "healthy",
  granted_scopes: ["instagram_business_basic", "instagram_business_manage_messages", "instagram_business_manage_comments", "instagram_business_content_publish", "instagram_business_manage_insights"],
  webhook_fields: ["comments", "messages", "live_comments", "message_reactions", "messaging_postbacks"],
  connected_at: ago(60 * 24 * 61),
  ai_enabled: true,
  profile_picture_url: art("🌿", 140),
  profile_name: "Kaveri Organics",
  followers_count: 48230,
  media_count: 412,
};

const media = (i: number, kind: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM", product: "FEED" | "REELS", caption: string, emoji: string, hue: number, likes: number, comments: number, daysAgo: number) => ({
  id: `ig_media_${i}`,
  caption,
  media_type: kind,
  media_product_type: product,
  permalink: `https://www.instagram.com/p/demo${i}/`,
  preview_url: art(emoji, hue),
  thumbnail_url: art(emoji, hue),
  media_url: art(emoji, hue),
  timestamp: ago(daysAgo * 1440),
  like_count: likes,
  comments_count: comments,
});
export const igMedia: any[] = [
  media(1, "VIDEO", "REELS", "Why we cold-press under 40°C 🌡️ Comment PRICE for the link!", "🫗", 40, 3812, 486, 1),
  media(2, "IMAGE", "FEED", "Festive Hampers are live 🎁 Comment HAMPER and we'll DM you the catalogue.", "🎁", 330, 2290, 312, 2),
  media(3, "CAROUSEL_ALBUM", "FEED", "5 millet recipes for busy weeknights 🌾 Save this post!", "🥣", 70, 5120, 204, 4),
  media(4, "VIDEO", "REELS", "From farm to bottle in 48 hours 🚜", "🚜", 110, 8930, 391, 6),
  media(5, "IMAGE", "FEED", "Meet our honey hunters in the Western Ghats 🐝", "🐝", 45, 1840, 96, 9),
  media(6, "VIDEO", "REELS", "Groundnut oil vs refined oil: the smoke test 🔥 Comment TEST for the full report", "🔥", 15, 12450, 822, 12),
  media(7, "IMAGE", "FEED", "Our Bengaluru store is now open in Indiranagar 📍", "🏪", 200, 1320, 74, 15),
  media(8, "IMAGE", "FEED", "Jaggery, the way grandma made it 🍬", "🍬", 25, 2710, 133, 20),
  media(9, "VIDEO", "REELS", "Behind the scenes: packing 1,000 hampers in a day 📦", "📦", 280, 6540, 288, 24),
];

const baseAutomation = { priority: 1, version: 1, cooldown_seconds: 3600, conditions: { follower_state: "any", contact_state: "any", require_open_window: false } };
export const igAutomations: any[] = [
  {
    ...baseAutomation, id: "iga_price", connection_id: IG_CONNECTION_ID, business_id: BUSINESS_ID, name: "PRICE → DM the product link", status: "active", version: 3, created_at: ago(20000),
    trigger: { type: "comment", keywords: ["price", "cost", "how much"], match_mode: "contains", exclusions: [], branches: [], referral_sources: [], referral_ids: [] },
    scope: { type: "specific", media_ids: ["ig_media_1"], media_types: [], surfaces: ["reel"], bound_media_id: "ig_media_1" },
    actions: [
      { type: "public_reply", text: "Sent you a DM 💌", variations: ["Check your DMs 📩", "Just DM'd you the link! 🌿"] },
      { type: "private_reply", text: "Hi! 👋 Here's the cold-pressed coconut oil: ₹449 for 1L, ₹1,199 for the 3-pack.", buttons: [{ id: "b1", title: "Shop now", url: "https://kaveri-organics.example/coconut-oil" }] },
      { type: "add_tag", tag: "reel-comment" },
    ],
  },
  {
    ...baseAutomation, id: "iga_hamper", connection_id: IG_CONNECTION_ID, business_id: BUSINESS_ID, name: "HAMPER → send the catalogue", status: "active", priority: 2, created_at: ago(9000),
    trigger: { type: "comment", keywords: ["hamper", "gift"], match_mode: "contains", exclusions: ["stop"], branches: [], referral_sources: [], referral_ids: [] },
    scope: { type: "specific", media_ids: ["ig_media_2"], media_types: [], surfaces: ["post"], bound_media_id: "ig_media_2" },
    actions: [
      { type: "public_reply", text: "Check your DMs! 🎁" },
      { type: "send_media", media_url: art("🎁", 330), media_type: "image" },
      { type: "send_buttons", text: "Our Festive Hampers start at ₹1,299. Want bulk pricing?", buttons: [{ id: "b1", title: "See hampers", url: "https://kaveri-organics.example/hampers" }, { id: "b2", title: "Bulk order" }] },
    ],
  },
  {
    ...baseAutomation, id: "iga_story", connection_id: IG_CONNECTION_ID, business_id: BUSINESS_ID, name: "Story mention → thank-you coupon", status: "active", priority: 3, created_at: ago(15000),
    trigger: { type: "story_mention", keywords: [], match_mode: "any", exclusions: [], branches: [], referral_sources: [], referral_ids: [] },
    scope: { type: "all", media_ids: [], media_types: [], surfaces: ["story"], bound_media_id: null },
    actions: [{ type: "react", emoji: "❤️" }, { type: "send_text", text: "Thank you for the shout-out! 💚 Here's 15% off your next order: THANKYOU15" }],
  },
  {
    ...baseAutomation, id: "iga_dm", connection_id: IG_CONNECTION_ID, business_id: BUSINESS_ID, name: "DMs → AI assistant", status: "active", priority: 10, created_at: ago(30000),
    trigger: { type: "dm", keywords: [], match_mode: "any", exclusions: [], branches: [], referral_sources: [], referral_ids: [] },
    scope: { type: "all", media_ids: [], media_types: [], surfaces: [], bound_media_id: null },
    actions: [{ type: "route_ai" }],
  },
  {
    ...baseAutomation, id: "iga_test", connection_id: IG_CONNECTION_ID, business_id: BUSINESS_ID, name: "TEST → smoke-test report", status: "paused", priority: 4, created_at: ago(18000),
    trigger: { type: "comment", keywords: ["test", "report"], match_mode: "contains", exclusions: [], branches: [], referral_sources: [], referral_ids: [] },
    scope: { type: "specific", media_ids: ["ig_media_6"], media_types: [], surfaces: ["reel"], bound_media_id: "ig_media_6" },
    actions: [{ type: "private_reply", text: "Here's the full lab report 🔬 kaveri-organics.example/smoke-test" }],
  },
  {
    ...baseAutomation, id: "iga_live", connection_id: IG_CONNECTION_ID, business_id: BUSINESS_ID, name: "Live: ORDER → checkout link", status: "draft", priority: 5, created_at: ago(300),
    trigger: { type: "live_comment", keywords: ["order", "buy"], match_mode: "contains", exclusions: [], branches: [], referral_sources: [], referral_ids: [] },
    scope: { type: "next", media_ids: [], media_types: [], surfaces: ["live"], bound_media_id: null },
    actions: [{ type: "private_reply", text: "Thanks for joining the live! Here's your checkout link 🛒" }],
  },
];

const handles = ["rohit.cooks", "snehaeatsclean", "meal.prep.maya", "bangalore.foodie", "the.millet.mom", "fitwithkaran", "desi.kitchen.diaries", "anu_bakes", "healthyhabits.in", "chef.vikram"];
const comments = ["price?", "PRICE", "how much for 3?", "hamper please 🎁", "is this available in Pune?", "Gift options?", "love this ❤️", "price pls", "TEST", "do you ship to Delhi?"];
export const igExecutions: any[] = Array.from({ length: 28 }, (_, i) => {
  const text = comments[i % comments.length];
  const auto = /price|how much/i.test(text) ? "iga_price" : /hamper|gift/i.test(text) ? "iga_hamper" : null;
  const status = auto ? (i % 11 === 5 ? "failed" : "succeeded") : "unmatched";
  return {
    id: `exe_${i}`, business_id: BUSINESS_ID, connection_id: IG_CONNECTION_ID, automation_id: auto,
    event_key: `evt_${i}`, event_type: i % 6 === 0 ? "dm" : "comment", status,
    unmatched_reason: status === "unmatched" ? "No automation's keywords matched this comment" : undefined,
    subject_id: `1784140${i}`, subject_username: handles[i % handles.length], text,
    comment_id: `c_${i}`, media_id: auto === "iga_hamper" ? "ig_media_2" : "ig_media_1",
    action_results: auto ? [{ type: "public_reply", ok: status === "succeeded" }, { type: "private_reply", ok: status === "succeeded" }] : [],
    created_at: ago(i * 37 + 3),
  };
});

export const igCommentMetrics = (days: number) => ({
  connection_id: IG_CONNECTION_ID,
  period_days: days,
  automations_enabled: igAutomations.filter((a) => a.status === "active").length,
  comments_received: 1284,
  replied: 1103,
  pending: 12,
  waiting_for_limits: 4,
  not_matched: 141,
  skipped: 18,
  missed: 10,
  triggered: 1125,
  removed: 7,
  blocked_by_plan: 0,
  missed_breakdown: { failed: 6, expired: 2, no_connection: 0, stuck_unprocessed: 2 },
  reply_rate: 0.86,
  queued_sends: 3,
});

const limits = { private_replies_per_hour: 180, private_replies_per_day: 1500, public_replies_per_hour: 60, public_replies_per_day: 500, dms_per_hour: 180, dms_per_day: 2000, posts_per_day: 10, min_gap_seconds: 4, max_gap_seconds: 20, person_cooldown_hours: 24, warmup_enabled: false, sending_paused: false };
const caps = { private_replies_per_hour: 200, private_replies_per_day: 2000, public_replies_per_hour: 100, public_replies_per_day: 750, dms_per_hour: 200, dms_per_day: 2500, posts_per_day: 25, min_gap_seconds: 60, max_gap_seconds: 120, person_cooldown_hours: 168 };
const floors = { private_replies_per_hour: 1, private_replies_per_day: 1, public_replies_per_hour: 1, public_replies_per_day: 1, dms_per_hour: 1, dms_per_day: 1, posts_per_day: 1, min_gap_seconds: 1, max_gap_seconds: 2, person_cooldown_hours: 0 };
export const igSafety: any = {
  limits, effective: limits, defaults: limits, hard_caps: caps, floors, admin_limited: [],
  per_minute: { private_reply: 6, public_reply: 3, dm: 6 },
  usage: { private_reply: { hour: 42, day: 611 }, public_reply: { hour: 18, day: 402 }, dm: { hour: 27, day: 388 }, posts: { day: 1 } },
  state: { paused_until: null, pause_reason: null, slowed_until: null, warmup_active: false, warmup_ends_at: null, queued: 3, queued_by_pause: 0 },
};

export const igModeration: any = { enabled: true, phone_numbers: true, emails: false, links: true, keywords: ["scam", "fake"], action: "hide" };

export const igPosts: any[] = [
  { id: "post_1", connection_id: IG_CONNECTION_ID, post_type: "reel", media: [{ url: art("🍯", 30), is_video: false }], caption: "Wild honey, straight from the Western Ghats 🐝 Comment HONEY for 10% off!", share_to_feed: true, cover_url: null, user_tags: [], collaborators: [], first_comment: "#organic #honey #bengaluru", comments_disabled: false, automation_id: null, cross_post_telegram: false, cross_post_facebook: true, scheduled_at: ahead(1260), status: "scheduled", created_at: ago(200) },
  { id: "post_2", connection_id: IG_CONNECTION_ID, post_type: "feed", media: [{ url: art("🥗", 100), is_video: false }, { url: art("🌾", 60), is_video: false }], caption: "Millet salad bowl, 3 ways 🥗", share_to_feed: true, cover_url: null, user_tags: [], collaborators: [], first_comment: "", comments_disabled: false, automation_id: null, cross_post_telegram: false, scheduled_at: ahead(4200), status: "scheduled", created_at: ago(100) },
  { id: "post_3", connection_id: IG_CONNECTION_ID, post_type: "story", media: [{ url: art("⏰", 0), is_video: false }], caption: "Last day for FESTIVE15!", share_to_feed: false, cover_url: null, user_tags: [], collaborators: [], first_comment: "", comments_disabled: false, automation_id: null, cross_post_telegram: false, scheduled_at: null, status: "draft", created_at: ago(50) },
  { id: "post_4", connection_id: IG_CONNECTION_ID, post_type: "feed", media: [{ url: art("🎁", 330), is_video: false }], caption: "Festive Hampers are live 🎁 Comment HAMPER and we'll DM you the catalogue.", share_to_feed: true, cover_url: null, user_tags: [], collaborators: [], first_comment: "", comments_disabled: false, automation_id: "iga_hamper", cross_post_telegram: false, scheduled_at: null, status: "published", published_at: ago(2880), media_id: "ig_media_2", permalink: "https://www.instagram.com/p/demo2/", like_count: 2290, comments_count: 312, created_at: ago(3000) },
];

export const igSnippets: any[] = [
  { id: "snp1", kind: "hashtags", name: "Core tags", text: "#organic #coldpressed #bengaluru #healthyeating #kaveriorganics" },
  { id: "snp2", kind: "caption", name: "Comment CTA", text: "Comment PRICE and we'll DM you the link 💌" },
];

/** Account insights: the shape Instagram's Graph API returns (total_value or time_series). */
export function igInsights(q: URLSearchParams) {
  const metrics = (q.get("metrics") ?? "reach,views,accounts_engaged,total_interactions,follows_and_unfollows,profile_links_taps").split(",");
  const series = q.get("metric_type") === "time_series";
  const base: Record<string, number> = { reach: 184_200, views: 612_400, impressions: 612_400, accounts_engaged: 21_340, total_interactions: 38_910, likes: 29_400, comments: 3_120, shares: 2_870, saves: 3_520, replies: 640, follows_and_unfollows: 1_284, profile_links_taps: 2_410, follower_count: 48_230, website_clicks: 1_930, profile_views: 9_840 };
  return {
    data: metrics.map((name) => {
      const total = base[name] ?? 1200;
      return {
        name,
        period: q.get("period") ?? "day",
        title: name.replace(/_/g, " "),
        values: series ? Array.from({ length: 28 }, (_, i) => ({ value: Math.round((total / 28) * (0.7 + 0.6 * Math.abs(Math.sin(i / 3)))), end_time: new Date(now - (27 - i) * 86_400_000).toISOString() })) : [{ value: total }],
        total_value: { value: total },
      };
    }),
  };
}

// ── Messenger ───────────────────────────────────────────────────────────

export const fbPage = { id: "fbc_1", page_id: FB_PAGE_ID, page_name: "Kaveri Organics", page_category: "Health/beauty", agent_id: AGENT_ID, webhook_subscribed: true, active: true, connected_at: ago(60 * 24 * 45), has_token: true };

export const fbSettings: any = {
  greeting_text: "Hi {{user_first_name}}! 🌿 Welcome to Kaveri Organics. Ask us anything about our oils, millets and hampers.",
  get_started: { enabled: true, welcome_message: "Namaste! 🙏 I'm Asha, Kaveri's assistant. What are you looking for today?" },
  persistent_menu: [
    { title: "🛒 Shop products", action: "products", value: "" },
    { title: "📦 Track my order", action: "ask", value: "Where is my order?" },
    { title: "💬 Chat on WhatsApp", action: "whatsapp", value: "" },
    { title: "🙋 Talk to a person", action: "human", value: "" },
  ],
  ice_breakers: ["What's in the Festive Hamper?", "Do you deliver to my city?", "Which oil is best for deep frying?", "Do you offer bulk pricing?"],
  quick_replies: { enabled: true, items: [{ title: "Bestsellers", action: "products", value: "" }, { title: "Offers", action: "ask", value: "Any offers right now?" }, { title: "Talk to us", action: "human", value: "" }] },
  keyword_flows: [
    { id: "kf1", name: "Order tracking", keywords: ["track", "where is my order", "order status"], match: "contains", reply: "Share your order number (e.g. KO-12345) and I'll check it right away 📦", action: "none", value: "", enabled: true },
    { id: "kf2", name: "Bulk enquiries", keywords: ["bulk", "corporate", "wholesale"], match: "contains", reply: "We'd love to help with a bulk order! Our team will reach out within 2 hours.", action: "human", value: "", enabled: true },
    { id: "kf3", name: "Rate us", keywords: ["feedback", "review"], match: "contains", reply: "We'd love your feedback 💚", action: "rate", value: "", enabled: false },
  ],
  source_openers: [{ ref: "festive-ad", message: "Thanks for tapping our Festive ad! 🎁 Use FESTIVE15 for 15% off." }],
  away: { enabled: true, timezone: "Asia/Kolkata", start: "19:00", end: "09:00", days: [0, 1, 2, 3, 4, 5, 6], message: "We're offline right now, but Asha can still help with orders and FAQs! 🌙" },
  nudge: { enabled: true, after_hours: 20, message: "Still thinking it over? Your FESTIVE15 code expires soon ⏰" },
  hot_lead_alert: { enabled: true, telegram: false },
  handover: { auto_pause_on_page_reply: true, pass_to_page_inbox: true },
  whatsapp_number: WA_NUMBER,
  persona: { name: "Asha", picture_url: art("🌿", 140), id: "persona_1" },
  booking: { enabled: false, slots: [] },
  comments: { ai_reply: true },
  understand_media: true,
};

const win = (open: boolean, min: number) => ({ state: open ? "open" : "closed", last_inbound_at: ago(min), standard_closes_at: open ? ahead(1440 - min) : null, human_closes_at: ahead(10080 - min) });
export const fbContacts: any[] = [
  { psid: "6021984471", name: "Fatima Sheikh", lead_label: "warm", lead_score: 55, source: { type: "organic" }, window: win(true, 8), thread_owner: "page_inbox", needs_callback: true, rating: null, first_seen_at: ago(9000) },
  { psid: "6021984473", name: "Neha Gupta", lead_label: "hot", lead_score: 70, source: { type: "ad", ref: "festive-ad", ad_id: "238472910" }, window: win(true, 2), thread_owner: "bot", needs_callback: false, rating: null, first_seen_at: ago(38) },
  { psid: "6021984472", name: "David Fernandes", lead_label: "cold", lead_score: 22, source: { type: "organic" }, window: win(false, 1438), thread_owner: "bot", needs_callback: false, rating: 5, first_seen_at: ago(1440) },
  { psid: "6021984474", name: "Rekha Srinivasan", lead_label: "very_hot", lead_score: 88, source: { type: "m.me link", ref: "store-qr" }, window: win(true, 140), thread_owner: "bot", needs_callback: false, rating: 5, first_seen_at: ago(4000), phone: "+919886612345" },
  { psid: "6021984475", name: "Tom Mathew", lead_label: "warm", lead_score: 44, source: { type: "comment", ref: "post_8812" }, window: win(true, 600), thread_owner: "bot", needs_callback: false, rating: 4, first_seen_at: ago(700) },
  { psid: "6021984476", name: "Aisha Khan", lead_label: "cold", lead_score: 15, source: { type: "organic" }, window: win(false, 5000), thread_owner: "bot", needs_callback: false, rating: null, first_seen_at: ago(12000) },
].map((c) => ({ profile_pic: null, phone: null, email: null, subscribed: c.lead_score > 40, linked_profiles: c.psid === "6021984474" ? [{ channel: "whatsapp", key: "919886612345" }] : [], ...c }));

export const fbLinks: any[] = [
  { id: "lnk1", name: "Store counter QR", ref: "store-qr", url: `https://m.me/${FB_PAGE_ID}?ref=store-qr`, opens: 412, people: 288, hot_leads: 41 },
  { id: "lnk2", name: "Festive ad", ref: "festive-ad", url: `https://m.me/${FB_PAGE_ID}?ref=festive-ad`, opens: 1290, people: 904, hot_leads: 122 },
  { id: "lnk3", name: "Email newsletter", ref: "newsletter", url: `https://m.me/${FB_PAGE_ID}?ref=newsletter`, opens: 230, people: 171, hot_leads: 12 },
];

export const fbCommentRules: any = {
  rules: [
    { id: "cr1", name: "HAMPER → DM catalogue", keywords: ["hamper", "gift"], match: "contains", post_ids: [], private_message: "Hi! 🎁 Here's our Festive Hamper catalogue: kaveri-organics.example/hampers", public_reply: "Sent you a message! 💌", enabled: true, runs: 318 },
    { id: "cr2", name: "Price questions", keywords: ["price", "cost"], match: "contains", post_ids: [], private_message: "Thanks for asking! Prices start at ₹149. Tap here to browse: kaveri-organics.example", public_reply: "Check your inbox 📩", enabled: true, runs: 204 },
  ],
  recent: [
    { author: "Ravi Teja", text: "Price for the hamper?", private: true, public: true, ai: false, error: null, created_at: ago(14) },
    { author: "Shalini M", text: "Do you deliver to Mysuru?", private: true, public: false, ai: true, error: null, created_at: ago(55) },
    { author: "Joseph K", text: "gift box options?", private: true, public: true, ai: false, error: null, created_at: ago(130) },
  ],
};

export const fbBroadcasts: any = {
  broadcasts: [
    { id: "bc1", message: "Festive Hampers are back! 🎁 Reply HAMPER to see the range.", audience: "open_window", status: "completed", sent: 642, failed: 4, skipped: 21, created_at: ago(2900) },
    { id: "bc2", message: "Order update: delivery times may be slower this week due to festive demand.", audience: "subscribers", status: "completed", sent: 1180, failed: 9, skipped: 0, created_at: ago(8000) },
  ],
  audience: { open_window: 214, subscribers: 1320, total: 1402 },
};

export const fbAnalytics = (days: number) => ({
  days,
  total_contacts: 3482,
  new_contacts: 112 * Math.ceil(days / 7),
  open_windows: 214,
  missed_windows: 9,
  subscribers: 1320,
  callbacks_waiting: 1,
  avg_response_seconds: 6,
  avg_rating: 4.7,
  ratings_count: 184,
  leads: { very_hot: 38, hot: 124, warm: 402, cold: 2918 },
  sources: [{ name: "Festive ad", people: 904, hot_leads: 122 }, { name: "Store counter QR", people: 288, hot_leads: 41 }, { name: "Organic", people: 1820, hot_leads: 66 }, { name: "Post comments", people: 470, hot_leads: 31 }],
  new_per_day: Array.from({ length: days }, (_, i) => ({ date: day(days - 1 - i), count: Math.round(14 + 6 * Math.sin(i / 2) + (i % 7 === 5 ? 8 : 0)) })),
});

// ── Button menus (WhatsApp auto-replies, /flows) ────────────────────────
export const menuFlows: any[] = [
  {
    id: "mnu_main", user_id: user.user_id, agent_id: AGENT_ID, channel: "whatsapp", name: "Main menu", trigger_type: "first_message", active: true,
    entry_step_id: "start", keywords: ["menu", "hi", "hello"], created_at: ago(40000), updated_at: ago(3000),
    steps: [
      { step_id: "start", message: "Namaste! 🙏 Welcome to Kaveri Organics. How can we help?", buttons: [{ id: "b1", title: "🛒 Shop", next_step_id: "shop" }, { id: "b2", title: "📦 Track order", next_step_id: "track" }, { id: "b3", title: "🙋 Talk to us", next_step_id: "human" }] },
      { step_id: "track", message: "Send your order number (e.g. KO-12345) and Asha will check it.", buttons: [], ask_ai: true },
      { step_id: "human", message: "Connecting you with our team. We reply within 10 minutes during working hours.", buttons: [], handoff: true },
    ],
  },
  {
    id: "mnu_gift", user_id: user.user_id, agent_id: AGENT_ID, channel: "whatsapp", name: "Gifting menu", trigger_type: "keyword", active: false,
    entry_step_id: "start", keywords: ["gift", "hamper"], created_at: ago(9000), updated_at: ago(9000),
    steps: [{ step_id: "start", message: "Our Festive Hampers start at ₹1,299 🎁", buttons: [], link_url: "https://kaveri-organics.example/hampers", link_label: "See hampers" }],
  },
];
