# Frontend Build - Progress Tracker

> Read this first if resuming a session. Update the checkboxes as work completes.
> Source of truth for backend contract: `../ins/FRONTEND_INTEGRATION.md`

## ⚠️ CRITICAL: FRONTEND_INTEGRATION.md is WRONG about response shapes - read the real route source instead

Once the actual backend was run locally (2026-08-13), nearly every list/mutation endpoint turned out to
wrap its payload in a top-level key (`{conversations: [...], total: N}`, `{success, business}`, etc.)
instead of returning bare arrays/objects like the MD implies. **Every `lib/api/*.ts` file has already
been fixed against the real route source** (`../ins/app/api/routes/**/*.py`) - if you're adding a NEW
endpoint call, do not trust the MD's shape claims; grep the actual FastAPI route file's `return` statement
first. Full list of what was wrong and fixed:

| Resource | Endpoint | MD/original assumption | Actual shape |
|---|---|---|---|
| businesses | GET list | bare array | `{businesses, total}` |
| businesses | POST/PATCH | bare object | `{success, business}` |
| conversations | GET list | bare array | `{conversations, total}`; items have nested `customer{id,name,phone}`, NOT `customer_name`/`customer_phone`; no `last_message_preview`/`last_message_at`/`unread_count` fields exist at all - use `intent`/`last_activity`/`lead_score` instead |
| conversations | GET messages | bare array | `{conversation_key, agent_id, channel, user_key, ai_enabled, paused_by, paused_at, messages, total}` - AND **messages have no `id` field**, contradicting the MD's explicit claim. Per-message feedback UI is disabled in the inbox until the backend adds one - do not re-enable with a fake/synthesized id. |
| conversations | PATCH status | bare object | `{success, conversation_key, conversation}` |
| conversations | PATCH control (AI toggle) | bare object | flat `{success, conversation_key, ai_enabled, message, notes}` - **no conversation object at all**; UI must re-fetch the list to reflect the change |
| feedback | GET (per-conv or negative list) | bare array | `{feedback, total}` |
| whatsapp official | POST init | `{url}` | `{signup_url, state, expires_at}` - field is `signup_url` |
| whatsapp official | GET connections | bare array | `{connections, count}` |
| whatsapp QR | POST connect/disconnect | full status object | flat ack only (`{success, business_id, status}`) - QR code only ever appears via the status poll, and only once the external Node companion service (see below) actually writes one |
| rag | POST upload/ingest-url | full RagDocument | minimal ack `{success, doc_id, ..., status}` - id field is `doc_id` not `id`; refetch the list for full metadata |
| rag | GET list | bare array | `{documents, total}` |
| hot-leads | GET list | bare array | `{hot_leads, total}` |
| team | POST/PATCH/GET | bare object/array | `{success, member}` / `{members, total}` |
| follow-ups | GET/PATCH | bare array/object | `{follow_ups, total}` / `{success, follow_up}`; items have nested `customer{id,name,phone}`, not `customer_name` |
| knowledge-gaps | GET/PATCH | bare array/object | `{knowledge_gaps, total}` / `{success, knowledge_gap}` |
| auth | PATCH /users/me | full updated AuthUser | `{success, updated}` where `updated` is just the changed-fields diff |

**Confirmed already correct / no fix needed:** business GET-by-id, conversation detail, dashboard home,
all 3 analytics endpoints, agent chat, auth register/login (flat with `user_id`), hot-leads timeline,
feedback/counts.

### WhatsApp QR needs a THIRD process running, not just frontend + backend
`POST /whatsapp-qr/{id}/connect` calls out to an external Node "companion service" at
`WHATSAPP_QR_SERVICE_URL` (see `../ins/.env`, defaults to `http://127.0.0.1:8081`) which lives at
`../ins/whatsapp-qr-service`. If that process isn't running, `connect` returns 503 and the QR frame
stays blank forever (status keeps polling a record that was never created). **Start that service too**
before testing the QR flow, not just `uvicorn` + `npm run dev`.

## Decisions locked in
- Auth: Next.js API routes proxy to backend + httpOnly cookie for the JWT (not localStorage).
- Scope: full dashboard shell for ALL screens in the MD. Only **WhatsApp (QR + Official)** is a fully wired channel - Instagram/other socials get a visible "Coming soon" placeholder, not hidden.
- API base URL (dev): `http://localhost:8000`
- Styling: SCSS only (no Tailwind/CSS-in-JS). Design-token driven (`_variables.scss`, `_mixins.scss`), BEM-ish component classes, CSS Modules per component (`Component.module.scss`).
- Framework: Next.js (App Router) + TypeScript.

## Build order (do in this order - later steps depend on earlier ones)

- [x] 1. Scaffold Next.js app (App Router, TS, no Tailwind) + folder structure - DONE. Next 16.3, React 19.2.8, sass installed. Full folder tree under `src/` created (app route groups, components/ui + components/features, lib/api, lib/auth, context, types).
- [x] 2. SCSS design system - DONE. `src/styles/_colors.scss` (light+dark CSS vars, brand indigo/violet gradient), `_typography.scss`, `_spacing.scss` (spacing/radius/z-index/motion), `_breakpoints.scss` (mixins: from/until/between), `_mixins.scss` (surface-card, focus-ring, transition, truncate, line-clamp, flex-center/between, custom-scrollbar, skeleton-shimmer, visually-hidden, button-reset), `globals.scss` (reset + base elements, imports all of the above via @forward+@use).
- [x] 3. Core lib - DONE. `lib/api/client.ts` (isomorphic fetch: server calls backend directly, client calls go through `/api/backend` proxy so JWT stays server-side), `lib/api/errors.ts` (ApiError class with `.userMessage` implementing §5 rules), `lib/utils/conversation-key.ts` (encodeConversationKey helper - USE THIS EVERYWHERE), and one file per resource: auth, businesses, conversations, whatsapp, rag, hot-leads, team, follow-ups, knowledge-gaps, dashboard, agent. Barrel at `lib/api/index.ts`. `types/api.ts` has all shared domain types hand-written from the MD.
- [x] 4. Auth - DONE. `lib/auth/session.ts` (httpOnly cookie set/get/clear, cookie names SESSION_COOKIE/USER_COOKIE), `app/api/auth/login|register|logout/route.ts` (call backend, set cookie), `app/api/backend/[...path]/route.ts` (generic authenticated proxy - attaches Bearer from cookie, forwards to `BACKEND_URL`), `middleware.ts` (redirects unauthenticated → /login, authenticated-on-public-page → /dashboard).
- [x] 5. App shell - DONE. `context/AuthContext.tsx`, `context/BusinessContext.tsx` (multi-business switcher, persists active business id to localStorage), `context/ToastContext.tsx`. `components/layout/`: Sidebar.tsx (collapsible on mobile, nav grouped Overview/Setup/Insights), Topbar.tsx, BusinessSwitcher.tsx, DashboardShell.tsx, icons.tsx (hand-rolled SVG icon set, no icon lib dependency). `app/(auth)/layout.tsx` (split-screen marketing layout), `app/(dashboard)/layout.tsx` (wraps BusinessProvider + DashboardShell). `app/layout.tsx` wires ToastProvider > AuthProvider, loads Inter font, imports globals.scss. `app/page.tsx` redirects based on session. Root middleware renamed to `src/proxy.ts` per Next.js 16 convention (was middleware.ts - deprecated, function renamed `proxy`).
- [x] 6. UI kit (`components/ui`) - DONE. Button, Input, Textarea, Select, Switch, Card (+CardHeader), Badge, ProgressBar, Skeleton, EmptyState, Avatar, Modal (portal-based), Tabs (pill+underline variants), Table. All SCSS modules using the mixins from step 2. Barrel at `components/ui/index.ts`.
  - GOTCHA LEARNED: the `transition()` Sass mixin only takes 3 POSITIONAL args ($props, $duration, $ease) - multi-property transitions must be passed as a SPACE-separated list e.g. `transition(color background-color)`, NOT comma-separated `transition(color, background-color)` (comma reads as two positional args and silently miscompiles). Use keyword args (`$props:`, `$duration:`) when you need to skip $duration but set $ease.
- [x] 7. Auth pages - DONE. `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, shared `page.module.scss`.
- [x] Build verified clean - `npm run build` passes, all 22 routes compile, TypeScript passes, zero warnings.
- [x] 9. Dashboard home - DONE. `app/(dashboard)/dashboard/page.tsx` - renders `today` stats generically (StatTile grid), `attention_required` generically (AttentionList - humanizes keys, filters empty), `recent_conversations` list linking to inbox. Handles zero-businesses state (CTA to onboarding). `components/features/dashboard-home/{StatTile,AttentionList}`. `lib/hooks/{useActiveBusiness,useAsync}.ts` - reusable data-fetch hook with stale-response guarding.
- [x] 8. Onboarding wizard - DONE. `app/(dashboard)/onboarding/page.tsx`. Creates business if none exists (name-only form), then a 4-step wizard (basics/contact/agent/behavior) defined in `components/features/onboarding/onboarding-steps.ts` - steps are a CLIENT-SIDE GROUPING ONLY, completion % per step is derived from the backend's `onboarding.missing_fields` (never recomputed locally, per MD instruction). Each step PATCHes only its own fields on save-and-continue. Shows a completion banner once `onboarding.is_complete`.
- [x] 10. WhatsApp connection screen - DONE, PRIORITY FEATURE COMPLETE. `app/(dashboard)/channels/whatsapp/page.tsx` with Tabs (QR / Official).
  - QR tab: `components/features/whatsapp/QrConnectPanel.tsx` + `lib/hooks/useWhatsAppQrStatus.ts` - polls `GET /whatsapp-qr/{id}/status` every 2.5s, ONLY while status is waiting_for_scan/connecting/reconnecting (stops on connected/disconnected/reconnect_required per MD §4). Renders `qr_code` data-URL directly as `<img>`. Has pairing-code toggle, disconnect button, reconnect-required messaging, connected-state card showing phone_number.
  - Official tab: `components/features/whatsapp/OfficialConnectPanel.tsx` - lists existing connections, "Connect with Meta" redirects to the init URL from the backend.
- [x] 11. Other channel tabs - DONE. `app/(dashboard)/channels/instagram/page.tsx` is a clean EmptyState "coming soon" card, no functionality wired (per your instruction - WhatsApp only for now). `/channels` index redirects to `/channels/whatsapp`.
- [x] 12. Inbox / chat dashboard - DONE. `app/(dashboard)/inbox/page.tsx` - two-pane layout (list + detail, collapses to single pane on mobile with a back button). Conversation list polls every 8s, message thread polls every 4s while a conversation is open (both plain-interval polling per MD §6 - no WebSocket). Status filter chips (open/human_active/resolved/all). Per-conversation: status Select (PATCHes `/status`), AI/Human Switch (PATCHes `/control` - uses `ai_enabled` as authoritative per MD §4, NOT `status`). Message bubbles distinguish user/assistant/human_agent visually. 👍/👎 feedback per assistant message - 👎 opens `FeedbackReasonModal` since `reason` is required by the backend on down-ratings (422 otherwise). No message composer - MD §7 confirms there's no send-message endpoint yet, so paused-AI conversations show a hint to reply on WhatsApp directly instead of a fake send box.
- [x] 13. Knowledge base screen - DONE. `app/(dashboard)/knowledge-base/page.tsx` - drag-and-drop file dropzone + click-to-browse, URL ingest form, document list with status badges (processing=warning/ready=success/failed=danger), delete. Upload response already returns final status (MD says processing is synchronous) so no polling needed here, just a refresh-list-after-action pattern.
- [x] 14. AI agent config screen + Test Chat - DONE. `app/(dashboard)/agent-config/page.tsx` (persona + behavior sections, PATCHes `/businesses/{id}` - same fields as onboarding steps 3&4, just re-editable here). `components/features/agent-config/TestChatModal.tsx` - chat UI hitting `POST /agents/{agent_id}/chat`, agent_id read off `business.agent_id`.
- [x] 15. Hot leads screen + timeline - DONE. `app/(dashboard)/hot-leads/page.tsx` - card grid, score ring colored by hot/very_hot, filter chips (All/Hot/Very hot - note: API's `min_label` param only accepts "hot"|"very_hot", NOT "warm", even though the HotLeadLabel type has "warm" as a display value). Clicking a card opens `components/features/hot-leads/LeadTimelineModal.tsx` rendering the literal "Asked pricing → +10" feed from MD §4.
- [x] 16. Team management screen - DONE. `app/(dashboard)/team/page.tsx` - add-by-email form with role Select, Table of members (owner shown as a fixed Badge, others get an editable role Select + remove button). 404-on-add is caught specifically and shown as "No account found - ask them to register first" per MD §4 wording. Owner/403 restrictions are enforced server-side; frontend degrades gracefully on error, doesn't try to hide the UI from non-owners client-side (not worth the complexity for this build).
- [x] 17. Follow-ups screen - DONE. `app/(dashboard)/follow-ups/page.tsx` - shows only `status: pending` entries, each with the literal `suggested_message` in a draft box + Copy-to-clipboard button (there's no send endpoint per MD §7, so copy-and-send-on-WhatsApp is the intended flow), Dismiss/Mark-as-sent actions.
- [x] 18. Knowledge gaps screen - DONE. `app/(dashboard)/knowledge-gaps/page.tsx` - open gaps only, occurrence_count badge, "Add to Knowledge Base" links to `/knowledge-base` (MD explicitly says there's no automatic link between uploading a doc and resolving a gap, so this is a manual come-back-and-mark-resolved flow, not automated).
- [x] 19. Feedback (👍/👎 on messages, feedback counts) - DONE, delivered inline inside the inbox screen (step 12) rather than as a separate page, since feedback is per-message and belongs in the conversation view. `FeedbackReasonModal` enforces the required `reason` field on down-ratings.
- [x] 20. Analytics screens - DONE. `app/(dashboard)/analytics/page.tsx` - 3 tabs (Overview/Sales/AI performance). Correctly renders "Not yet tracked" (via StatTile's `value === null` branch) for: sales.revenue_generated, both average_response_time fields, ai.knowledge_usage.tracked=false - NEVER shows 0 for these. Percent/seconds formatters return null-through so StatTile's null branch still triggers. Footer note clarifies these are snapshots, not time-series trends (no chart library needed/used - MD confirms no historical data exists to chart).
- [x] 21. Polish pass - DONE. Real Settings page (`app/(dashboard)/settings/page.tsx` - profile + business details editing). `app/error.tsx` global error boundary, `app/not-found.tsx` 404 page. Added a `viewport` export to `app/layout.tsx` (`export const viewport: Viewport = { width: "device-width", initialScale: 1 }`) - this was MISSING and is a real fix, not cosmetic: without it mobile browsers render the whole app zoomed out to a ~980px virtual viewport. Verified via headless-Edge screenshots at 390/800/1000/1440px that the auth layout's responsive grid (single column below 1024px, split screen above) works correctly - confirmed by rendering, not just by reading the CSS. Sidebar nav updated to include the Settings link (was missing).
- [x] 22. `.env.local.example` + `README.md` - DONE.

## STATUS: FEATURE-COMPLETE. All 24 routes build cleanly (`npm run build`, zero TypeScript errors, zero Sass warnings). Visually verified login/register render correctly across viewport widths via headless-browser screenshots. Dashboard/inbox/etc. could not be visually verified end-to-end with real data because the backend (`../ins`) is not running in this environment - that's expected per the user, who said they'll deploy it later. When the backend is up, run `npm run dev`, log in, and walk through each screen once - that's the one verification step that couldn't be done here.

## If resuming: nothing is blocking. Possible next steps a user might want:
- Wire up the real `openapi-typescript`/`orval` generated client once the backend is deployed (currently `types/api.ts` is hand-written from the MD, which works fine but won't auto-catch backend contract drift).
- Add a manual dark/light theme toggle (currently OS-preference-only - the CSS tokens already support a `data-theme` attribute override, just no UI control wired up).
- Send-message composer in the inbox once the backend adds that endpoint (MD §7 confirms it doesn't exist yet).
- Real-time push (WebSocket/SSE) once the backend adds it - currently everything is interval-polling by design, matching MD §6.

## Notes / gotchas to remember while building
- `conversation_key` has colons, must `encodeURIComponent` in every URL that embeds it (detail/status/messages/control/feedback).
- 404 means "doesn't exist OR not yours" - never show different UI for the two cases.
- 422 errors are Pydantic arrays, not flat strings - need a formatter.
- Analytics: several fields are `null` with a `*_note` explaining why - render "Not yet tracked", never `0`.
- `ai_enabled` (not `status`) is authoritative for inbox AI/Human indicator.
- QR status polling: stop on `connected` or `reconnect_required`.
- No WebSocket/SSE anywhere - polling only, and only where the MD says to poll.
- Feedback `reason` required when rating is `down`.

## Status log
- 2026-08-12: Progress tracker created. Beginning step 1.
