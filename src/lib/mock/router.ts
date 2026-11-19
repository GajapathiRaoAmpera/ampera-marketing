/* eslint-disable @typescript-eslint/no-explicit-any */
// In-memory stand-in for the backend: every apiFetch() call lands here (see lib/api/client.ts).
// State lives in this module, so changes made during a demo persist until the page reloads.
import * as d from "./data";

type Handler = (p: string[], body: any, q: URLSearchParams) => unknown;
type Route = [method: string, pattern: RegExp, handler: Handler];

let seq = 1000;
const id = (prefix: string) => `${prefix}_${++seq}`;
const nowIso = () => new Date().toISOString();
const ok = { success: true };
const removeBy = <T,>(list: T[], pred: (item: T) => boolean) => {
  const i = list.findIndex(pred);
  if (i >= 0) list.splice(i, 1);
};
const merge = (target: any, changes: any) => {
  for (const [k, v] of Object.entries(changes ?? {})) {
    target[k] = v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" ? merge({ ...target[k] }, v) : v;
  }
  return target;
};

// Common sub-paths.
const B = String.raw`/businesses/[^/]+`;
const WS = `${B}/whatsapp-studio`;
const IG = `${B}/instagram`;
const FB = String.raw`/channels/messenger/pages/[^/]+`;
const TPL = "/api/agents/whatsapp/templates";

function convoDetail(key: string) {
  const c = d.conversations.find((x) => x.conversation_key === key);
  if (!c) return null;
  return {
    conversation_key: c.conversation_key,
    customer: { id: c.user_key, name: c.display_name, phone: c.display_user_key, handle: c.handle ?? undefined, tags: c._tags, notes: c._notes ?? null },
    channel: c.channel,
    status: c.status,
    lead_score: c.lead_score,
    lead_status: c.lead_label,
    intent: c._intent,
    sentiment: c.sentiment,
    tags: c._tags,
    ai_enabled: c.ai_enabled,
    account_ai_enabled: true,
    last_activity: c.last_at,
    agent_id: c.agent_id,
    agent_name: c.agent_name,
    assigned_team_member: c.assigned_team_member,
    reply_window: c.reply_window,
    summary: `${c.display_name} is a ${c.lead_label.replace("_", " ")} lead (${c._intent.replace("_", " ")}). ${c.last_message}`,
    paused_by: c.ai_enabled ? null : "Priya Raman",
  };
}

function addMessage(key: string, role: string, content: string, metadata: Record<string, unknown> = {}) {
  const list = (d.messages[key] ??= []);
  const msg: any = { id: id("msg"), role, content, created_at: nowIso(), metadata: { delivery_status: "sent", ...metadata } };
  list.push(msg);
  const c = d.conversations.find((x) => x.conversation_key === key);
  if (c) Object.assign(c, { last_message: content, last_role: role, last_at: msg.created_at, message_count: list.length });
  return msg;
}

function automationOut(a: any) {
  return { automation: a, validation: { valid: true, errors: [], warnings: [] } };
}

const routes: Route[] = [
  // ── Auth & account ──
  ["POST", /^\/users\/(login|register|oauth\/\w+)$/, (_p, body) => ({ ...d.user, ...(body?.name ? { name: body.name } : {}), ...(body?.email ? { email: body.email } : {}), access_token: "demo-token" })],
  ["GET", /^\/users\/me$/, () => ({ id: d.user.user_id, ...d.user })],
  ["PATCH", /^\/users\/me$/, (_p, body) => ({ success: true, updated: body })],
  ["GET", /^\/businesses$/, () => ({ businesses: [d.business], total: 1 })],
  ["GET", new RegExp(`^${B}$`), () => d.business],
  ["PATCH", new RegExp(`^${B}$`), (_p, body) => ({ success: true, business: merge(d.business, body) })],
  ["GET", new RegExp(`^${B}/entitlements$`), () => d.entitlements],
  ["GET", /^\/agents$/, () => ({ agents: [d.agent], total: 1 })],
  ["GET", /^\/agents\/[^/]+$/, () => d.agent],
  ["PATCH", /^\/agents\/[^/]+$/, (_p, body) => {
    merge(d.agent, body);
    return ok;
  }],
  ["POST", /^\/agents\/[^/]+\/chat$/, (_p, body) => ({ reply: `(Demo) Asha would answer “${body?.message ?? ""}” using Kaveri's catalogue and FAQs.` })],
  ["GET", /^\/rag\/documents$/, () => ({ documents: [{ id: "doc1", status: "ready", source_type: "file", filename: "Kaveri price list.pdf" }, { id: "doc2", status: "ready", source_type: "url", url: "https://kaveri-organics.example/faq" }], total: 2 })],
  ["GET", new RegExp(`^${B}/team$`), () => ({ owner: { user_id: d.user.user_id, name: d.user.name, email: d.user.email }, members: [{ user_id: "usr_2", name: "Rahul Desai", email: "rahul@kaveri.example", role: "agent" }, { user_id: "usr_3", name: "Divya Nair", email: "divya@kaveri.example", role: "manager" }], total: 2 })],

  // ── Notifications ──
  ["GET", /^\/notifications\/updates$/, () => ({ notifications: d.notifications, unread_count: d.notifications.filter((n) => !n.read).length, server_time: nowIso() })],
  ["GET", /^\/notifications\/unread-count$/, () => ({ unread_count: d.notifications.filter((n) => !n.read).length })],
  ["GET", /^\/notifications$/, () => ({ notifications: d.notifications, total: d.notifications.length })],
  ["PATCH", /^\/notifications\/([^/]+)\/read$/, (p) => {
    const n = d.notifications.find((x) => x.id === p[1]);
    if (n) n.read = true;
    return ok;
  }],
  ["POST", /^\/notifications\/mark-all-read$/, () => {
    d.notifications.forEach((n) => (n.read = true));
    return ok;
  }],
  ["GET", /^\/activity-feed$/, () => ({ items: d.notifications.map((n) => ({ ...n, source: "notification" })), total: d.notifications.length })],

  // ── Dashboard & inbox ──
  ["GET", new RegExp(`^${B}/dashboard$`), () => d.dashboardHome()],
  ["GET", /^\/dashboard\/conversations$/, (_p, _b, q) => {
    let list = [...d.conversations];
    const channel = q.get("channel");
    if (channel) list = list.filter((c) => c.channel === channel);
    if (q.get("paused_only") === "true") list = list.filter((c) => !c.ai_enabled);
    const status = q.get("status");
    if (status) list = list.filter((c) => c.status === status);
    list.sort((a, b) => b.last_at.localeCompare(a.last_at));
    const page = Number(q.get("page") ?? 1);
    const size = Number(q.get("page_size") ?? 20);
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / size));
    return { conversations: list.slice((page - 1) * size, page * size), total, page, page_size: size, total_pages: pages, has_next: page < pages, has_previous: page > 1 };
  }],
  ["GET", /^\/dashboard\/conversations\/([^/]+)\/messages$/, (p, _b, q) => {
    const key = decodeURIComponent(p[1]);
    const all = d.messages[key] ?? [];
    const after = q.get("after");
    const before = q.get("before");
    let list = all;
    if (after) list = all.slice(all.findIndex((m) => m.id === after) + 1);
    else if (before) list = all.slice(0, Math.max(0, all.findIndex((m) => m.id === before)));
    const c = d.conversations.find((x) => x.conversation_key === key);
    return {
      conversation_key: key, agent_id: d.AGENT_ID, channel: c?.channel, user_key: c?.user_key, ai_enabled: c?.ai_enabled ?? true,
      paused_by: c?.ai_enabled ? null : "Priya Raman", paused_at: null, messages: list, total: all.length, has_more: false,
      oldest_cursor: all[0]?.id ?? null, latest_cursor: all[all.length - 1]?.id ?? null,
    };
  }],
  ["PATCH", /^\/dashboard\/conversations\/([^/]+)\/control$/, (p, body) => {
    const key = decodeURIComponent(p[1]);
    const c = d.conversations.find((x) => x.conversation_key === key);
    if (c && typeof body?.ai_enabled === "boolean") {
      c.ai_enabled = body.ai_enabled;
      c.status = body.ai_enabled ? "open" : "human_active";
    }
    return { success: true, conversation_key: key, ai_enabled: c?.ai_enabled ?? true, message: "Updated" };
  }],
  ["POST", /^\/dashboard\/conversations\/([^/]+)\/reply$/, (p, body) => {
    const key = decodeURIComponent(p[1]);
    const msg = addMessage(key, "human_agent", body?.message ?? "", { sent_by: d.user.name, delivery_status: "delivered" });
    return { success: true, conversation_key: key, message: "Sent", message_id: msg.id, delivery_status: "delivered" };
  }],
  ["POST", /^\/dashboard\/conversations\/([^/]+)\/template-reply$/, (p, body) => {
    const key = decodeURIComponent(p[1]);
    const t = d.waTemplates.find((x) => x.name === body?.template_name);
    let text = t?.components.find((c: any) => c.type === "BODY")?.text ?? body?.template_name ?? "";
    (body?.parameters ?? []).forEach((v: string, i: number) => (text = text.replace(`{{${i + 1}}}`, v)));
    const msg = addMessage(key, "human_agent", text, { sent_by: d.user.name, template: body?.template_name });
    return { success: true, conversation_key: key, message: "Sent", message_id: msg.id, delivery_status: "sent" };
  }],
  ["POST", /^\/dashboard\/conversations\/([^/]+)\/media-reply$/, (p) => {
    const key = decodeURIComponent(p[1]);
    const msg = addMessage(key, "human_agent", "📎 Attachment", { sent_by: d.user.name, media_type: "image", media_url: d.art("📎", 210) });
    return { success: true, conversation_key: key, media_type: "image", media_url: msg.metadata.media_url, message_id: msg.id };
  }],
  ["GET", new RegExp(`^${B}/conversations/quick-replies$`), () => ({ quick_replies: d.quickReplies })],
  ["POST", new RegExp(`^${B}/conversations/quick-replies$`), (_p, body) => {
    const qr = { id: id("qr"), label: body.label, body: body.body };
    d.quickReplies.push(qr);
    return { success: true, quick_reply: qr };
  }],
  ["DELETE", new RegExp(`^${B}/conversations/quick-replies/([^/]+)$`), (p) => {
    removeBy(d.quickReplies, (x) => x.id === p[1]);
    return ok;
  }],
  ["GET", new RegExp(`^${B}/conversations/([^/]+)/detail$`), (p) => convoDetail(decodeURIComponent(p[1]))],
  ["PATCH", new RegExp(`^${B}/conversations/([^/]+)/customer$`), (p, body) => {
    const key = decodeURIComponent(p[1]);
    const c = d.conversations.find((x) => x.conversation_key === key);
    if (c) {
      if (body?.tags) c._tags = body.tags;
      if (body?.notes !== undefined) c._notes = body.notes;
    }
    return { success: true, customer: convoDetail(key)?.customer ?? null };
  }],
  ["PATCH", new RegExp(`^${B}/conversations/([^/]+)/status$`), (p, body) => {
    const key = decodeURIComponent(p[1]);
    const c = d.conversations.find((x) => x.conversation_key === key);
    if (c) {
      if (body?.status) c.status = body.status;
      if (body?.tags) c._tags = body.tags;
      if (body?.assigned_team_member !== undefined) c.assigned_team_member = body.assigned_team_member;
    }
    return { success: true, conversation_key: key, conversation: convoDetail(key) };
  }],
  ["GET", new RegExp(`^${B}/conversations/[^/]+/feedback$`), () => ({ feedback: [], total: 0 })],
  ["GET", new RegExp(`^${B}/feedback/counts$`), () => ({ up: 412, down: 9 })],
  ["GET", new RegExp(`^${B}/feedback$`), () => ({ feedback: [], total: 0 })],

  // ── Leads ──
  ["GET", new RegExp(`^${B}/hot-leads$`), () => ({ hot_leads: d.hotLeads, total: d.hotLeads.length })],
  ["GET", new RegExp(`^${B}/hot-leads/([^/]+)/timeline$`), (p) => {
    const lead = d.hotLeads.find((l) => l.customer_id === p[1]);
    const score = lead?.lead_score ?? 50;
    return {
      customer_id: p[1], conversation_key: lead?.conversation?.conversation_key, total: 3,
      timeline: [
        { signal: "Asked about price", delta: 20, resulting_score: score - 35, timestamp: d.ago(120) },
        { signal: "Asked about delivery date", delta: 15, resulting_score: score - 15, timestamp: d.ago(60) },
        { signal: "Requested invoice / order form", delta: 15, resulting_score: score, timestamp: d.ago(5) },
      ],
    };
  }],
  ["GET", new RegExp(`^${B}/customer-tags$`), () => {
    return { tags: [...new Set(d.conversations.flatMap((c) => c._tags as string[]))] };
  }],
  ["GET", new RegExp(`^${B}/customers-by-tag$`), (_p, _b, q) => {
    const tag = q.get("tag");
    const list = d.conversations.filter((c) => !tag || c._tags.includes(tag));
    return { customers: list.map((c) => ({ customer_id: `cus_${c.user_key}`, name: c.display_name, phone: c.display_user_key, lead_score: c.lead_score, lead_status: c.lead_label, tags: c._tags, notes: null, last_interaction: c.last_at, conversation: { conversation_key: c.conversation_key, status: c.status, last_activity: c.last_at } })), total: list.length };
  }],
  ["GET", new RegExp(`^${B}/follow-ups$`), () => ({ follow_ups: d.followUps, total: d.followUps.length })],
  ["PATCH", new RegExp(`^${B}/follow-ups/([^/]+)$`), (p, body) => {
    const f = d.followUps.find((x) => x.id === p[1]);
    if (f) f.status = body.status;
    return { success: true, follow_up: f };
  }],

  // ── WhatsApp: connection & templates ──
  ["GET", /^\/api\/agents\/whatsapp\/onboarding\/connections$/, () => ({ connections: [d.waConnection], count: 1 })],
  ["POST", /^\/api\/agents\/whatsapp\/onboarding\/connections\/[^/]+\/link-agent$/, () => ({ status: "linked" })],
  ["GET", new RegExp(`^${TPL}/local$`), (_p, _b, q) => {
    const status = q.get("status");
    const list = d.waTemplates.filter((t) => !status || t.status === status);
    return { success: true, templates: list, count: list.length };
  }],
  ["GET", new RegExp(`^${TPL}/stats$`), () => {
    const by_category: Record<string, number> = {};
    d.waTemplates.forEach((t) => (by_category[t.category] = (by_category[t.category] ?? 0) + 1));
    const n = (s: string) => d.waTemplates.filter((t) => t.status === s).length;
    return { total: d.waTemplates.length, approved: n("APPROVED"), pending: n("PENDING"), rejected: n("REJECTED"), by_category };
  }],
  ["GET", new RegExp(`^${TPL}/flows$`), () => ({ flows: d.waMetaFlows })],
  ["POST", new RegExp(`^${TPL}/create$`), (_p, body) => {
    const t = { id: id("tpl"), ...body, status: "PENDING", created_at: nowIso(), updated_at: nowIso() };
    delete t.allow_category_change;
    d.waTemplates.unshift(t);
    // Demo: Meta "approves" it a few seconds later; Refresh or Sync shows it.
    setTimeout(() => (t.status = "APPROVED"), 8000);
    return { success: true, template_id: t.id, status: "PENDING", category: t.category, message: "Submitted to Meta for review" };
  }],
  ["GET", new RegExp(`^${TPL}/refresh-status/([^/]+)$`), (p) => ({ success: true, template: d.waTemplates.find((t) => t.name === decodeURIComponent(p[1])) })],
  ["DELETE", new RegExp(`^${TPL}/delete/([^/]+)$`), (p) => {
    removeBy(d.waTemplates, (t) => t.name === decodeURIComponent(p[1]));
    return { success: true, message: "Deleted" };
  }],
  ["POST", new RegExp(`^${TPL}/sync$`), () => ({ success: true, synced_count: d.waTemplates.length, templates: d.waTemplates })],
  ["POST", new RegExp(`^${TPL}/media-handle$`), () => ({ handle: d.art("🖼️", 200), content_type: "image/png", filename: "upload.png" })],
  ["POST", /^\/qr\/generate$/, (_p, body) => ({ url: `https://wa.me/${String(body?.identifier ?? "").replace(/\D/g, "")}`, qr_data_uri: d.art("🔳", 0, "Scan to chat"), download_filename: "whatsapp-qr.svg" })],

  // ── WhatsApp Studio ──
  ["GET", new RegExp(`^${WS}/overview$`), () => d.waOverview()],
  ["GET", new RegExp(`^${WS}/contacts/custom-fields$`), () => ({ fields: ["city"] })],
  ["GET", new RegExp(`^${WS}/contacts$`), (_p, _b, q) => {
    const search = q.get("search")?.toLowerCase();
    const tag = q.get("tag");
    const opted = q.get("opted_in");
    let list = d.waContacts.filter((c) => (!search || `${c.name} ${c.phone}`.toLowerCase().includes(search)) && (!tag || c.tags.includes(tag)) && (opted === null || String(c.whatsapp_opt_in) === opted));
    const total = list.length;
    const offset = Number(q.get("offset") ?? 0);
    list = list.slice(offset, offset + Number(q.get("limit") ?? 50));
    return { contacts: list, total };
  }],
  ["POST", new RegExp(`^${WS}/contacts$`), (_p, body) => {
    const contact = { id: id("wct"), business_id: d.BUSINESS_ID, email: null, tags: [], custom_fields: {}, lead_status: "new", source: "manual", updated_at: nowIso(), last_interaction: null, ...body };
    d.waContacts.unshift(contact);
    return { success: true, contact };
  }],
  ["POST", new RegExp(`^${WS}/contacts/import$`), () => ({ success: true, processed: 48, created: 41, updated: 7, skipped: 0 })],
  ["PATCH", new RegExp(`^${WS}/contacts/([^/]+)$`), (p, body) => ({ success: true, contact: merge(d.waContacts.find((c) => c.id === p[1]) ?? {}, body) })],
  ["DELETE", new RegExp(`^${WS}/contacts/([^/]+)$`), (p) => {
    removeBy(d.waContacts, (c) => c.id === p[1]);
    return ok;
  }],
  ["GET", new RegExp(`^${WS}/segments$`), () => ({ segments: d.waSegments })],
  ["POST", new RegExp(`^${WS}/segments$`), (_p, body) => {
    const tag = body.rules?.tags_any?.[0];
    const segment = { id: id("seg"), business_id: d.BUSINESS_ID, ...body, contact_count: tag ? d.waContacts.filter((c) => c.tags.includes(tag)).length : d.waContacts.length };
    d.waSegments.push(segment);
    return { success: true, segment };
  }],
  ["DELETE", new RegExp(`^${WS}/segments/([^/]+)$`), (p) => {
    removeBy(d.waSegments, (s) => s.id === p[1]);
    return ok;
  }],
  ["GET", new RegExp(`^${WS}/flows/meta-flows$`), () => ({ flows: d.waMetaFlows })],
  ["POST", new RegExp(`^${WS}/flows/meta-flows$`), (_p, body) => {
    const flow = { id: id("mf"), name: body.name, status: "PUBLISHED", categories: [body.category] };
    d.waMetaFlows.unshift(flow);
    return { success: true, flow, screen: "FORM" };
  }],
  ["POST", new RegExp(`^${WS}/flows/meta-flows/([^/]+)/deprecate$`), (p) => {
    const flow = d.waMetaFlows.find((f) => f.id === p[1]);
    if (flow) flow.status = "DEPRECATED";
    return { success: true, flow };
  }],
  ["GET", new RegExp(`^${WS}/flows/submissions$`), () => ({ submissions: d.waSubmissions, total: d.waSubmissions.length })],
  ["GET", new RegExp(`^${WS}/flows$`), () => ({ flows: d.waFlows.map((f) => ({ ...f, graph: undefined })) })],
  ["POST", new RegExp(`^${WS}/flows$`), (_p, body) => {
    const flow = { id: id("flw"), business_id: d.BUSINESS_ID, status: "draft", draft_revision: 1, published_version: null, updated_at: nowIso(), active_sessions: 0, ...body };
    d.waFlows.unshift(flow);
    return { flow };
  }],
  ["GET", new RegExp(`^${WS}/flows/([^/]+)$`), (p) => ({ flow: d.waFlows.find((f) => f.id === p[1]) })],
  ["PATCH", new RegExp(`^${WS}/flows/([^/]+)$`), (p, body) => {
    const flow = d.waFlows.find((f) => f.id === p[1]);
    if (flow) Object.assign(flow, body, { draft_revision: flow.draft_revision + 1, updated_at: nowIso() });
    return { flow };
  }],
  ["POST", new RegExp(`^${WS}/flows/([^/]+)/validate$`), () => ({ valid: true, errors: [] })],
  ["POST", new RegExp(`^${WS}/flows/([^/]+)/simulate$`), (p) => {
    const flow = d.waFlows.find((f) => f.id === p[1]);
    return { completed: true, trace: (flow?.graph.nodes ?? []).map((n: any) => ({ node_id: n.id, type: n.type, label: n.label })) };
  }],
  ["POST", new RegExp(`^${WS}/flows/([^/]+)/publish$`), (p) => {
    const flow = d.waFlows.find((f) => f.id === p[1]);
    if (flow) Object.assign(flow, { status: "published", published_version: (flow.published_version ?? 0) + 1 });
    return { success: true, version: flow?.published_version ?? 1, flow };
  }],
  ["POST", new RegExp(`^${WS}/flows/([^/]+)/unpublish$`), (p) => {
    const flow = d.waFlows.find((f) => f.id === p[1]);
    if (flow) flow.status = "draft";
    return { success: true, flow, cleared_sessions: flow?.active_sessions ?? 0 };
  }],
  ["DELETE", new RegExp(`^${WS}/flows/([^/]+)$`), (p) => {
    removeBy(d.waFlows, (f) => f.id === p[1]);
    return ok;
  }],
  ["GET", new RegExp(`^${WS}/campaigns/approved-templates$`), () => ({ templates: d.waTemplates.filter((t) => t.status === "APPROVED" && t.category !== "AUTHENTICATION") })],
  ["GET", new RegExp(`^${WS}/campaigns$`), () => ({ campaigns: d.waCampaigns })],
  ["POST", new RegExp(`^${WS}/campaigns$`), (_p, body) => {
    const campaign = { id: id("cmp"), status: "draft", sent_count: 0, scheduled_at: body.scheduled_at ?? nowIso(), ...body };
    d.waCampaigns.unshift(campaign);
    return { campaign };
  }],
  ["POST", new RegExp(`^${WS}/campaigns/([^/]+)/activate$`), (p) => {
    const c = d.waCampaigns.find((x) => x.id === p[1]);
    const total = d.waSegments.find((s) => s.id === c?.segment_id)?.contact_count ?? 0;
    if (c) Object.assign(c, { status: "active", audience: c.audience ?? { total, scheduled: total, completed: 0, failed: 0, converted: 0, delivered: 0, read: 0 } });
    return { success: true, enrolled: total, scheduled_at: c?.scheduled_at ?? nowIso() };
  }],
  ["POST", new RegExp(`^${WS}/campaigns/([^/]+)/pause$`), (p) => {
    const c = d.waCampaigns.find((x) => x.id === p[1]);
    if (c) c.status = "paused";
    return ok;
  }],
  ["GET", new RegExp(`^${WS}/commerce/products$`), () => ({ products: d.waProducts })],
  ["POST", new RegExp(`^${WS}/commerce/products$`), (_p, body) => {
    const product = { id: id("prd"), reserved_inventory: 0, price_minor: Math.round(Number(body.price) * 100), ...body };
    d.waProducts.push(product);
    return { product };
  }],
  ["POST", new RegExp(`^${WS}/commerce/products/import-from-products$`), () => ({ success: true, imported: 0, updated: d.waProducts.length, skipped: 0 })],
  ["POST", new RegExp(`^${WS}/commerce/products/([^/]+)/share$`), () => ({ success: true, message_id: id("wamid"), delivery_status: "sent" })],
  ["PATCH", new RegExp(`^${WS}/commerce/products/([^/]+)$`), (p, body) => ({ product: merge(d.waProducts.find((x) => x.id === p[1]) ?? {}, { ...body, price_minor: Math.round(Number(body.price) * 100) }) })],
  ["GET", new RegExp(`^${WS}/commerce/catalog-connection$`), () => ({ connection: { id: "catc_1", catalog_id: "cat_kaveri", catalog_name: "Kaveri Organics catalogue", vertical: "commerce", last_synced_at: d.ago(90), last_sync_count: d.waProducts.length } })],
  ["PUT", new RegExp(`^${WS}/commerce/catalog-connection$`), (_p, body) => ({ connection: { id: "catc_1", catalog_id: body.catalog_id, catalog_name: "Kaveri Organics catalogue", last_synced_at: nowIso(), last_sync_count: d.waProducts.length } })],
  ["POST", new RegExp(`^${WS}/commerce/catalog-connection/sync$`), () => ({ success: true, synced: d.waProducts.length, needs_review: 0 })],
  ["GET", new RegExp(`^${WS}/commerce/orders$`), () => ({ orders: d.waOrders })],
  ["POST", new RegExp(`^${WS}/commerce/orders$`), (_p, body) => {
    const items = (body.items ?? []).map((it: any) => {
      const pr = d.waProducts.find((x) => x.id === it.product_id);
      return { product_id: it.product_id, sku: pr?.sku, name: pr?.name, quantity: it.quantity, unit_price_minor: pr?.price_minor ?? 0, line_total_minor: (pr?.price_minor ?? 0) * it.quantity };
    });
    const amount = items.reduce((s: number, it: any) => s + it.line_total_minor, 0);
    const order = { id: id("ord"), status: "pending_payment", inventory_status: "reserved", amount_minor: amount, currency: "INR", customer_phone: body.customer_phone, created_at: nowIso(), fulfillment_status: null, payment_method: "upi", items };
    d.waOrders.unshift(order);
    return { order, checkout: { provider: "upi", amount, currency: "INR", url: "https://kaveri-organics.example/pay/demo", upi_link: "upi://pay?pa=kaveriorganics@okhdfc", pay_within: "30 minutes" } };
  }],
  ["POST", new RegExp(`^${WS}/commerce/orders/([^/]+)/mark-paid$`), (p, body) => ({ success: true, order: merge(d.waOrders.find((o) => o.id === p[1]) ?? {}, { status: "paid", inventory_status: "committed", upi_reference: body?.reference ?? null, fulfillment_status: "processing" }) })],
  ["PATCH", new RegExp(`^${WS}/commerce/orders/([^/]+)/fulfillment$`), (p, body) => ({ success: true, order: merge(d.waOrders.find((o) => o.id === p[1]) ?? {}, { fulfillment_status: body.status, tracking_reference: body.tracking_reference ?? null }) })],
  ["POST", new RegExp(`^${WS}/commerce/orders/([^/]+)/cancel$`), (p) => {
    const o = d.waOrders.find((x) => x.id === p[1]);
    if (o) o.status = "cancelled";
    return { success: true, status: "cancelled" };
  }],
  ["GET", new RegExp(`^${WS}/settings$`), () => d.waSettings],
  ["PUT", new RegExp(`^${WS}/settings$`), (_p, body) => merge(d.waSettings, body)],
  ["GET", new RegExp(`^${WS}/connection-health$`), () => d.waHealth],
  ["GET", new RegExp(`^${WS}/profile$`), () => d.waProfile],
  ["PUT", new RegExp(`^${WS}/profile$`), (_p, body) => {
    merge(d.waProfile.profile, body);
    return d.waProfile;
  }],
  ["POST", new RegExp(`^${WS}/profile/photo$`), () => ({ profile: d.waProfile.profile })],
  ["GET", new RegExp(`^${WS}/calling$`), () => ({ available: true, enabled: true, show_call_button: true })],
  ["PUT", new RegExp(`^${WS}/calling$`), (_p, body) => ({ available: true, show_call_button: true, ...body })],
  ["GET", new RegExp(`^${WS}/insights$`), (_p, _b, q) => d.waInsights(Number(q.get("days") ?? 7))],
  ["GET", new RegExp(`^${WS}/groups$`), () => ({ groups: [{ group_id: "120363012345@g.us", last_at: d.ago(90), last_message: "Can we get the bulk price list here?", messages: 48, ai_enabled: false }], ai_enabled: true, group_replies_enabled: false })],
  ["PUT", new RegExp(`^${WS}/groups/([^/]+)$`), (p, body) => ({ group_id: decodeURIComponent(p[1]), ai_enabled: body.ai_enabled })],

  // ── Button menus (/flows) ──
  ["GET", /^\/flows$/, (_p, _b, q) => {
    const list = d.menuFlows.filter((f) => !q.get("channel") || f.channel === q.get("channel"));
    return { flows: list, total: list.length };
  }],
  ["POST", /^\/flows$/, (_p, body) => {
    const flow = { id: id("mnu"), user_id: d.user.user_id, active: true, created_at: nowIso(), updated_at: nowIso(), ...body };
    d.menuFlows.unshift(flow);
    return { success: true, flow };
  }],
  ["GET", /^\/flows\/([^/]+)$/, (p) => ({ flow: d.menuFlows.find((f) => f.id === p[1]) })],
  ["PUT", /^\/flows\/([^/]+)$/, (p, body) => {
    merge(d.menuFlows.find((f) => f.id === p[1]) ?? {}, { ...body, updated_at: nowIso() });
    return { success: true, flow_id: p[1] };
  }],
  ["PATCH", /^\/flows\/([^/]+)\/(activate|deactivate)$/, (p) => {
    const f = d.menuFlows.find((x) => x.id === p[1]);
    if (f) f.active = p[2] === "activate";
    return { success: true, flow_id: p[1], active: f?.active };
  }],
  ["DELETE", /^\/flows\/([^/]+)$/, (p) => {
    removeBy(d.menuFlows, (f) => f.id === p[1]);
    return { success: true, flow_id: p[1] };
  }],

  // ── Instagram ──
  ["GET", /^\/users\/instagram\/status$/, () => ({ connected: true, instagram_business_id: d.igConnection.instagram_business_id, instagram_username: d.igConnection.instagram_username, agent_id: d.AGENT_ID, connected_at: d.igConnection.connected_at, connection_id: d.IG_CONNECTION_ID, business_id: d.BUSINESS_ID, health_status: "healthy" })],
  ["GET", new RegExp(`^${IG}/connections$`), () => ({ connections: [d.igConnection] })],
  ["GET", new RegExp(`^${IG}/connections/[^/]+/health$`), () => ({ status: "healthy", missing_webhook_fields: [], subscribed_fields: d.igConnection.webhook_fields, granted_scopes: d.igConnection.granted_scopes, errors: [] })],
  ["GET", new RegExp(`^${IG}/connections/[^/]+/safety$`), () => d.igSafety],
  ["PUT", new RegExp(`^${IG}/connections/[^/]+/safety$`), (_p, body) => {
    merge(d.igSafety.limits, body);
    d.igSafety.effective = d.igSafety.limits;
    return d.igSafety;
  }],
  ["POST", new RegExp(`^${IG}/connections/[^/]+/pause$`), () => {
    d.igSafety.limits.sending_paused = true;
    return d.igSafety;
  }],
  ["POST", new RegExp(`^${IG}/connections/[^/]+/resume$`), () => {
    d.igSafety.limits.sending_paused = false;
    return { ...d.igSafety, resumed: { was_waiting: 0, replying_to: 0, skipped: 0 } };
  }],
  ["GET", new RegExp(`^${IG}/connections/[^/]+/metrics$`), (_p, _b, q) => d.igCommentMetrics(Number(q.get("days") ?? 7))],
  ["GET", new RegExp(`^${IG}/connections/[^/]+/media-metrics$`), (_p, _b, q) => {
    const ids = (q.get("media_ids") ?? "").split(",").filter(Boolean);
    return { period_days: 90, media: Object.fromEntries(ids.map((m, i) => [m, { ...d.igCommentMetrics(90), comments_received: 80 + i * 37, replied: 70 + i * 31 }])) };
  }],
  ["GET", new RegExp(`^${IG}/connections/[^/]+/profile$`), () => ({ connection_id: d.IG_CONNECTION_ID, username: d.igConnection.instagram_username, profile_picture_url: d.igConnection.profile_picture_url, profile_name: d.igConnection.profile_name, followers_count: d.igConnection.followers_count, follows_count: 312, media_count: d.igConnection.media_count, ai_enabled: d.igConnection.ai_enabled, ai_allowed: true, agent_id: d.AGENT_ID, live: true })],
  ["PUT", new RegExp(`^${IG}/connections/[^/]+/ai$`), (_p, body) => {
    d.igConnection.ai_enabled = body.enabled;
    return { connection_id: d.IG_CONNECTION_ID, ai_enabled: body.enabled };
  }],
  ["GET", new RegExp(`^${IG}/connections/[^/]+/moderation$`), () => d.igModeration],
  ["PUT", new RegExp(`^${IG}/connections/[^/]+/moderation$`), (_p, body) => merge(d.igModeration, body)],
  ["POST", new RegExp(`^${IG}/connections/[^/]+/subscribe$`), () => ok],
  ["GET", new RegExp(`^${IG}/media$`), (_p, _b, q) => {
    const kind = q.get("media_type");
    const list = d.igMedia.filter((m) => !kind || (kind === "reel" ? m.media_product_type === "REELS" : kind === "carousel" ? m.media_type === "CAROUSEL_ALBUM" : kind === "post" ? m.media_product_type === "FEED" : true));
    return { data: list, paging: { cursors: { after: null } } };
  }],
  ["GET", new RegExp(`^${IG}/media/([^/]+)/insights$`), () => ({ data: ["reach", "views", "likes", "comments", "shares", "saved"].map((name, i) => ({ name, period: "lifetime", values: [{ value: [18400, 42100, 3812, 486, 291, 640][i] }], total_value: { value: [18400, 42100, 3812, 486, 291, 640][i] } })) })],
  ["GET", new RegExp(`^${IG}/media/([^/]+)$`), (p) => d.igMedia.find((m) => m.id === decodeURIComponent(p[1])) ?? d.igMedia[0]],
  ["POST", new RegExp(`^${IG}/media/upload$`), () => ({ url: d.art("🖼️", 260), content_type: "image/svg+xml", is_video: false })],
  ["GET", new RegExp(`^${IG}/stories$`), () => ({ data: [{ id: "story_1", media_type: "IMAGE", preview_url: d.art("⏰", 0), media_url: d.art("⏰", 0), timestamp: d.ago(180) }, { id: "story_2", media_type: "IMAGE", preview_url: d.art("🍯", 30), media_url: d.art("🍯", 30), timestamp: d.ago(420) }] })],
  ["POST", new RegExp(`^${IG}/entry-link$`), () => ({ url: `https://ig.me/m/${d.igConnection.instagram_username}`, qr_data_uri: d.art("🔳", 300, "Scan to DM"), website_button: { href: `https://ig.me/m/${d.igConnection.instagram_username}`, label: "Message us on Instagram" } })],
  ["GET", new RegExp(`^${IG}/automations$`), () => ({ automations: d.igAutomations })],
  ["POST", new RegExp(`^${IG}/automations$`), (_p, body) => {
    const a = { id: id("iga"), business_id: d.BUSINESS_ID, status: "draft", version: 1, created_at: nowIso(), ...body };
    d.igAutomations.unshift(a);
    return automationOut(a);
  }],
  ["GET", new RegExp(`^${IG}/automations/([^/]+)$`), (p) => automationOut(d.igAutomations.find((a) => a.id === p[1]))],
  ["PATCH", new RegExp(`^${IG}/automations/([^/]+)$`), (p, body) => {
    const a = d.igAutomations.find((x) => x.id === p[1]);
    if (a) Object.assign(a, body, { version: a.version + 1 });
    return automationOut(a);
  }],
  ["POST", new RegExp(`^${IG}/automations/([^/]+)/(activate|pause)$`), (p) => {
    const a = d.igAutomations.find((x) => x.id === p[1]);
    if (a) a.status = p[2] === "activate" ? "active" : "paused";
    return automationOut(a);
  }],
  ["POST", new RegExp(`^${IG}/automations/([^/]+)/duplicate$`), (p) => {
    const src = d.igAutomations.find((x) => x.id === p[1]);
    const a = { ...structuredClone(src), id: id("iga"), name: `${src?.name} (copy)`, status: "draft", version: 1, created_at: nowIso() };
    d.igAutomations.unshift(a);
    return automationOut(a);
  }],
  ["GET", new RegExp(`^${IG}/automations/([^/]+)/versions$`), (p) => {
    const a = d.igAutomations.find((x) => x.id === p[1]);
    return { versions: Array.from({ length: a?.version ?? 1 }, (_, i) => ({ version: i + 1, created_at: d.ago((a.version - i) * 1500), name: a?.name })) };
  }],
  ["POST", new RegExp(`^${IG}/automations/([^/]+)/rollback/\\d+$`), (p) => automationOut(d.igAutomations.find((a) => a.id === p[1]))],
  ["DELETE", new RegExp(`^${IG}/automations/([^/]+)$`), (p) => {
    removeBy(d.igAutomations, (a) => a.id === p[1]);
    return ok;
  }],
  ["POST", new RegExp(`^${IG}/automations/([^/]+)/simulate$`), (p, body) => {
    const a = d.igAutomations.find((x) => x.id === p[1]);
    const text = String(body?.text ?? "").toLowerCase();
    const matched = !a?.trigger.keywords.length || a.trigger.keywords.some((k: string) => text.includes(k.toLowerCase()));
    return { matched, actions: matched ? a?.actions : [], reason: matched ? null : "No keyword matched" };
  }],
  ["GET", new RegExp(`^${IG}/automations/([^/]+)/analytics$`), (p) => {
    const runs = d.igExecutions.filter((e) => e.automation_id === p[1]);
    return { automation_id: p[1], total_executions: runs.length * 41, succeeded: runs.filter((e) => e.status === "succeeded").length * 41, failed: runs.filter((e) => e.status === "failed").length * 41, unique_commenters: runs.length * 33 };
  }],
  ["GET", new RegExp(`^${IG}/executions$`), (_p, _b, q) => {
    const auto = q.get("automation_id");
    const statuses = q.get("status")?.split(",");
    const search = q.get("search")?.toLowerCase();
    const list = d.igExecutions.filter((e) => (!auto || e.automation_id === auto) && (q.get("unmatched_only") !== "true" || e.status === "unmatched") && (!statuses || statuses.includes(e.status)) && (!search || `${e.text} ${e.subject_username}`.toLowerCase().includes(search)));
    return { executions: list.slice(0, Number(q.get("limit") ?? 50)) };
  }],
  ["GET", new RegExp(`^${IG}/insights$`), (_p, _b, q) => d.igInsights(q)],
  ["GET", new RegExp(`^${IG}/publish/overview$`), () => ({ limit: { used: 3, total: 50 }, telegram_connected: false, facebook_connected: true })],
  ["GET", new RegExp(`^${IG}/publish/best-times$`), () => ({ hours: Array.from({ length: 24 }, (_, h) => ({ hour_utc: h, posts: 4 + (h % 5), avg_engagement: Math.round(200 + 900 * Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 2))) })), sample_size: 120 })],
  ["GET", new RegExp(`^${IG}/publish/posts$`), () => ({ posts: d.igPosts })],
  ["POST", new RegExp(`^${IG}/publish/posts$`), (_p, body) => {
    const { action, ...rest } = body;
    const post = { id: id("post"), ...rest, status: action === "publish" ? "published" : action === "schedule" ? "scheduled" : "draft", published_at: action === "publish" ? nowIso() : null, created_at: nowIso() };
    d.igPosts.unshift(post);
    return post;
  }],
  ["GET", new RegExp(`^${IG}/publish/posts/([^/]+)$`), (p) => d.igPosts.find((x) => x.id === p[1])],
  ["PATCH", new RegExp(`^${IG}/publish/posts/([^/]+)$`), (p, body) => {
    const { action, ...rest } = body;
    const post = d.igPosts.find((x) => x.id === p[1]);
    if (post) Object.assign(post, rest, { status: action === "publish" ? "published" : action === "schedule" ? "scheduled" : "draft", updated_at: nowIso() });
    return post;
  }],
  ["POST", new RegExp(`^${IG}/publish/posts/([^/]+)/publish-now$`), (p) => merge(d.igPosts.find((x) => x.id === p[1]) ?? {}, { status: "published", published_at: nowIso() })],
  ["DELETE", new RegExp(`^${IG}/publish/posts/([^/]+)$`), (p) => {
    removeBy(d.igPosts, (x) => x.id === p[1]);
    return ok;
  }],
  ["POST", new RegExp(`^${IG}/publish/ai/caption$`), (_p, body) => ({
    captions: [
      `${body?.brief ?? "Something new"} 🌿 Small-batch, cold-pressed and 100% organic. Comment PRICE for the link!`,
      `Your kitchen deserves better. ${body?.brief ?? ""} ✨ Tap the link in bio to shop.`,
      `Made the slow way, the right way. ${body?.brief ?? ""} 🫙 Save this for your next grocery run.`,
    ],
  })],
  ["POST", new RegExp(`^${IG}/publish/ai/hashtags$`), () => ({ hashtags: ["#organic", "#coldpressed", "#healthyeating", "#bengalurufoodie", "#millets", "#cleaneating", "#madeinindia", "#kaveriorganics"] })],
  ["GET", new RegExp(`^${IG}/publish/snippets$`), () => ({ snippets: d.igSnippets })],
  ["POST", new RegExp(`^${IG}/publish/snippets$`), (_p, body) => {
    const s = { id: id("snp"), ...body };
    d.igSnippets.push(s);
    return s;
  }],
  ["DELETE", new RegExp(`^${IG}/publish/snippets/([^/]+)$`), (p) => {
    removeBy(d.igSnippets, (x) => x.id === p[1]);
    return ok;
  }],
  ["GET", new RegExp(`^${IG}/publish/library$`), () => ({ items: d.igMedia.slice(0, 6).map((m) => ({ id: `lib_${m.id}`, url: m.preview_url, is_video: false, created_at: m.timestamp })) })],

  // ── Messenger ──
  ["GET", /^\/channels\/messenger\/connections$/, () => ({ connections: [d.fbPage], count: 1 })],
  ["POST", /^\/channels\/messenger\/link-agent$/, () => ok],
  ["GET", new RegExp(`^${FB}/health$`), () => ({ status: "healthy", token_valid: true, missing_fields: [], comments_ready: true, agent_linked: true, error: null })],
  ["POST", new RegExp(`^${FB}/resubscribe$`), () => ({ comments_ready: true })],
  ["GET", new RegExp(`^${FB}/settings$`), () => d.fbSettings],
  ["PUT", new RegExp(`^${FB}/settings$`), (_p, body) => merge(d.fbSettings, body)],
  ["GET", new RegExp(`^${FB}/contacts$`), (_p, _b, q) => {
    const search = q.get("search")?.toLowerCase();
    return { contacts: d.fbContacts.filter((c) => !search || (c.name ?? "").toLowerCase().includes(search)) };
  }],
  ["POST", new RegExp(`^${FB}/contacts/([^/]+)/send$`), () => ok],
  ["POST", new RegExp(`^${FB}/contacts/([^/]+)/handover$`), (p, body) => {
    const c = d.fbContacts.find((x) => x.psid === p[1]);
    if (c) c.thread_owner = body.to;
    return ok;
  }],
  ["POST", new RegExp(`^${FB}/contacts/([^/]+)/summary$`), (p) => {
    const c = d.fbContacts.find((x) => x.psid === p[1]);
    return { summary: `${c?.name ?? "This person"} found the Page via ${c?.source?.type ?? "organic"} and is a ${c?.lead_label ?? "cold"} lead. Asked about festive hampers and delivery times; no open issues.` };
  }],
  ["POST", new RegExp(`^${FB}/import$`), () => ({ imported: 214, skipped: 12, messages: 3820 })],
  ["GET", new RegExp(`^${FB}/links$`), () => ({ links: d.fbLinks })],
  ["POST", new RegExp(`^${FB}/links$`), (_p, body) => {
    const ref = String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const link = { id: id("lnk"), name: body.name, ref, url: `https://m.me/${d.FB_PAGE_ID}?ref=${ref}`, opens: 0, people: 0, hot_leads: 0 };
    d.fbLinks.unshift(link);
    return { ref, url: link.url, qr_data_uri: d.art("🔳", 220, "Scan to chat") };
  }],
  ["GET", new RegExp(`^${FB}/links/([^/]+)/qr$`), (p) => ({ url: `https://m.me/${d.FB_PAGE_ID}?ref=${p[1]}`, qr_data_uri: d.art("🔳", 220, "Scan to chat") })],
  ["DELETE", new RegExp(`^${FB}/links/([^/]+)$`), (p) => {
    removeBy(d.fbLinks, (l) => l.ref === p[1]);
    return ok;
  }],
  ["GET", new RegExp(`^${FB}/comment-rules$`), () => d.fbCommentRules],
  ["POST", new RegExp(`^${FB}/comment-rules$`), (_p, body) => {
    const rule = { id: id("cr"), runs: 0, ...body };
    d.fbCommentRules.rules.push(rule);
    return rule;
  }],
  ["PATCH", new RegExp(`^${FB}/comment-rules/([^/]+)$`), (p, body) => merge(d.fbCommentRules.rules.find((r: any) => r.id === p[1]) ?? {}, body)],
  ["DELETE", new RegExp(`^${FB}/comment-rules/([^/]+)$`), (p) => {
    removeBy(d.fbCommentRules.rules, (r: any) => r.id === p[1]);
    return ok;
  }],
  ["GET", new RegExp(`^${FB}/broadcasts$`), () => d.fbBroadcasts],
  ["POST", new RegExp(`^${FB}/broadcasts$`), (_p, body) => {
    const sent = body.audience === "open_window" ? d.fbBroadcasts.audience.open_window : d.fbBroadcasts.audience.total;
    d.fbBroadcasts.broadcasts.unshift({ id: id("bc"), message: body.message, audience: body.audience, status: "completed", sent, failed: 0, skipped: 0, created_at: nowIso() });
    return ok;
  }],
  ["GET", new RegExp(`^${FB}/analytics$`), (_p, _b, q) => d.fbAnalytics(Number(q.get("days") ?? 30))],
];

const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

/**
 * Anything without a route: lists come back empty instead of crashing the page.
 * shortcut: guesses the shape from property access; add a real route above if a screen looks empty.
 */
function emptyResponse(): unknown {
  return new Proxy({}, { get: (_t, key) => (key === "then" || typeof key === "symbol" ? undefined : key === "success" ? true : []) });
}

export async function mockFetch(method: string, path: string, body: unknown): Promise<unknown> {
  await latency();
  const [pathname, search = ""] = path.split("?");
  const query = new URLSearchParams(search);
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const match = pathname.match(pattern);
    if (match) {
      const result = handler(Array.from(match), body, query);
      // Copies, so a screen mutating what it got back can't change the "server" state.
      return result === undefined ? undefined : structuredClone(result);
    }
  }
  if (method === "GET") {
    console.warn(`[demo] no mock for GET ${pathname}`);
    return emptyResponse();
  }
  return { success: true };
}
