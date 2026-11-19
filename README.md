# Ampera: Meta messaging demo

A no-backend demo of the messaging dashboard, in Ampera branding (Switzer, Ampera purple/navy/ivory,
Ampera logo), limited to Meta products: **WhatsApp, Instagram and Messenger**, plus the shared
Dashboard, Inbox and Leads.

```bash
npm install
npm run dev        # http://localhost:3000, log in with the prefilled demo account
```

- Every API call is answered in the browser by `src/lib/mock/` (`data.ts` = sample data for the
  fictional brand "Kaveri Organics", `router.ts` = endpoints). Nothing leaves the machine.
- Actions work for the session (take over a chat and reply, create templates, campaigns,
  automations, posts, contacts...). A page reload resets everything to the sample data.
- A screen that calls an endpoint with no mock logs `[demo] no mock for GET ...` in the console and
  shows empty lists; add a route in `router.ts` to fill it.
- `NEXT_PUBLIC_DEMO_MODE=false` switches back to the real backend.

---

# LeadConvo Frontend

Next.js (App Router) dashboard for the AI lead-conversion backend documented in `../ins/FRONTEND_INTEGRATION.md`. Consumes the backend purely over HTTP, no shared code, no session cookies from the backend itself.


## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **SCSS** (CSS Modules per component) - no Tailwind, no CSS-in-JS. Design tokens live in `src/styles/`.
- Hand-rolled UI kit (`src/components/ui`) - no external component library.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then set BACKEND_URL if not localhost:8000
npm run dev
```

The backend must be running (see `../ins`) for anything past the login screen to load data. The app itself will run and render without it, but API calls will fail.

## Architecture

- **Auth**: plain JWT from the backend, stored server-side only in an httpOnly cookie (`src/lib/auth/session.ts`). Client code never touches the token directly.
  - `src/app/api/auth/{login,register,logout}` - route handlers that call the backend and set the cookie.
  - `src/app/api/backend/[...path]` - a catch-all proxy. Client components call `/api/backend/...` instead of the backend directly; this route reads the cookie server-side and attaches `Authorization: Bearer <token>` before forwarding.
  - `src/proxy.ts` - Next.js 16's routing middleware (renamed from `middleware.ts`). Redirects unauthenticated requests to `/login`, authenticated requests away from `/login`/`/register`.
- **API client**: `src/lib/api/` - one file per backend resource (auth, businesses, conversations, whatsapp, rag, hot-leads, team, follow-ups, knowledge-gaps, dashboard, agent). All go through `src/lib/api/client.ts`, which picks the right base URL depending on server vs. client context.
- **State**: React context, no external state library.
  - `AuthContext` - current user, login/register/logout.
  - `BusinessContext` - the list of businesses a user owns and the currently-active one (persisted to `localStorage`), since a user can own multiple businesses.
  - `ToastContext` - global toast notifications.
- **Styling**: `src/styles/_colors.scss`, `_typography.scss`, `_spacing.scss`, `_breakpoints.scss`, `_mixins.scss` define the design system as CSS custom properties + Sass mixins. Every component ships its own `Component.module.scss`. Dark mode follows OS preference automatically (no manual toggle built yet, see `artifact-design`-style dual-theme pattern in `_colors.scss` if adding one).

## Feature scope (see `PROGRESS.md` for full build log)

WhatsApp is the only fully-wired messaging channel (QR/pairing connect flow + Meta Official Embedded Signup). Instagram and other future channels have a placeholder "Coming soon" screen and are intentionally not implemented yet.

Every dashboard screen described in `FRONTEND_INTEGRATION.md` has a working implementation: onboarding, dashboard home, inbox (with AI/human handoff and per-message feedback), knowledge base, AI agent config + test chat, hot leads + timeline, team management, follow-ups, knowledge gaps, and analytics (overview/sales/AI).

## Key gotchas carried over from the backend contract

- `conversation_key` contains colons and must be URL-encoded wherever it's used as a path segment, centralized in `src/lib/utils/conversation-key.ts`. Don't bypass it.
- A 404 from the backend means "doesn't exist" **or** "not yours" - the UI never tries to distinguish these.
- Analytics fields that are `null` with an accompanying `*_note` render "Not yet tracked" - never `0`. See `StatTile` in `src/components/features/dashboard-home/`.
- There is no WebSocket/SSE from the backend. Live-feeling UI (inbox, WhatsApp QR status) uses plain interval polling, and only where the integration guide says to.
- Feedback `reason` is required by the backend when submitting a 👎 rating - enforced client-side via a modal before the request is sent, to avoid a 422 round-trip.

## Scripts

- `npm run dev` - start the dev server
- `npm run build` - production build (also runs the TypeScript check)
- `npm run start` - run a production build
- `npm run lint` - ESLint
