# Canopy Web — Context for Claude Agents
## Last Updated: March 23, 2026

## IMPORTANT: DUAL-APP ARCHITECTURE

Canopy has **two separate codebases** sharing one Supabase backend:

1. **canopy-web** (THIS REPO) — Vite + React web app, deployed to Vercel via `austin706/canopy-web`
2. **canopy** (SIBLING FOLDER) — React Native + Expo mobile app, repo `austin706/canopy`

**ANY bug fix, feature, or API change MUST be applied to BOTH codebases.**

The master context file with full schema, migration status, credentials, and architecture details lives at:
`../canopy/CLAUDE_CONTEXT.md`

## Web-Specific Details

- **Framework:** React 18 + Vite + TypeScript
- **Routing:** React Router v6 (react-router-dom) — all routes defined in `src/App.tsx`
- **State:** Zustand with localStorage persistence (`src/store/useStore.ts`)
- **Styling:** Custom CSS design system (Oak & Sage brand) in `src/index.css`
- **Icons:** SVG icon components in `src/components/icons/` (CanopyLogo.tsx, Icons.tsx) — NO emoji anywhere
- **Deployment:** Vercel (auto-deploys on push to `main` branch of `austin706/canopy-web`)
- **GitHub:** https://github.com/austin706/canopy-web
- **Changes are LOCAL — not yet pushed** (batch push pending)

## Key Differences from Mobile

| Concern | Mobile (canopy) | Web (canopy-web) |
|---------|----------------|------------------|
| Routing | Expo Router (file-based) | React Router v6 |
| Storage | AsyncStorage | localStorage |
| Navigation | Stack.Screen entries in `_layout.tsx` | Routes in `App.tsx` |
| Services | `services/supabase.ts` | `src/services/supabase.ts` |
| Store | `store/useStore.ts` | `src/store/useStore.ts` |
| Types | `types/index.ts` | `src/types/index.ts` |

## Page Architecture

Pages inside `<Layout>` (sidebar + hamburger menu on mobile):
- Dashboard, Calendar, Weather, TaskDetail, CreateTask
- Equipment, EquipmentDetail, Documents
- ProRequest, ProServices, MaintenanceLogs, Notifications
- Help, Profile, Subscription, HomeDetails, AgentView
- Admin: AdminDashboard, AdminAgents, AdminUsers, AdminGiftCodes, AdminProRequests
- Agent: AgentPortal, AgentClientHome
- Pro: ProPortal, ProJobs (/pro-portal/jobs), ProAvailability (/pro-portal/availability), ProProfile (/pro-portal/profile)

Standalone pages (no sidebar):
- Login, Signup, ForgotPassword, ResetPassword, ProLogin, Terms, Privacy, Onboarding

## CSS Design System

- Brand tokens: `src/constants/theme.ts` (Colors, PriorityColors, StatusColors, EmailBrand)
- Email branding: `src/constants/theme.ts` → `EmailBrand` section (sender addresses, color palette, typography, layout, footer)
- CSS variables match theme: `--copper`, `--sage`, `--charcoal`, etc.
- Layout classes: `.page`, `.page-wide`, `.card`, `.grid-2`, `.grid-3`, `.grid-4`
- Responsive breakpoints: 900px (tablet — sidebar collapses, hamburger appears), 480px (phone — tighter padding/fonts)
- Hamburger menu: `.mobile-topbar`, `.hamburger-btn`, `.sidebar-open`, `.mobile-overlay`
- Components: `.btn`, `.badge`, `.tabs`, `.modal`, `.form-input`, `.form-select`, `.empty-state`, `.spinner`

## Recent Changes (March 22-23, 2026)

### Session 4-5 (March 22):
- All Tier 1 data loss fixes (secure notes CRUD, document vault, task persistence, notifications)
- All Tier 2 features (pro service pipeline, admin requests, weather alerts, notifications page, help FAQ)
- All Tier 3 polish (scanner security, gift code expiry, Stripe scaffolding)
- SVG icon system, skeleton loaders, HealthGauge component, onboarding welcome

### Session 6 (March 23):
- Mobile responsive: hamburger menu in Layout.tsx, 900px/480px CSS breakpoints
- Emoji removal: ~80+ emoji replaced across ~15 files with SVG icons, abbreviations, text labels
- Removed all dangerouslySetInnerHTML patterns
- Fixed 3 broken ProPortal routes (/pro-jobs → /pro-portal/jobs, etc.)
- Fixed off-brand color in Terms/Privacy (#16a34a → #8B9E7E brand sage)
- Fixed CreateTask + ProServices mobile padding (inline styles → CSS page class)
- Full page-by-page audit of all 36 pages + 5 components — TypeScript clean

### Session 8 (March 23 — Deep Logic Audit + Fixes):
- **HomeDetails.tsx**: Added photo upload (click-to-upload area, change photo button), fireplace type dropdown (wood burning/gas starter/gas), hose bib locations field, HVAC filter count field
- **Onboarding.tsx**: Added fireplace type selection when has_fireplace is checked
- **types/index.ts**: Added fireplace_type, hose_bib_locations, number_of_hvac_filters to Home interface
- **Signup.tsx**: Added mandatory Terms of Service + Privacy Policy acceptance checkbox
- **Help.tsx**: Fixed support email (oakandsagerealty.com → canopyhome.app), phone (918-984-0376 → 918-948-0950)
- **Subscription.tsx**: Fixed Pro+ inquiry email (oakandsagerealty.com → canopyhome.app)
- **weather.ts**: Fixed NWS user agent email (austin@rvconnect.us → support@canopyhome.app)
- **ProRequest.tsx**: Added "Custom/Other" service type category
- **Profile.tsx**: Added "Link Agent" section with agent code/email lookup (separate from gift codes)
- **supabase.ts**: Added lookupAgentByCode() and linkAgent() functions
- **Dashboard.tsx**: Free tier quick actions now greyed out with "Upgrade" label for paid features
- **CreateTask.tsx**: Added free tier gate — custom tasks locked for free users with upgrade prompt
- **Notifications.tsx**: Weather alerts toggle disabled/greyed for free users

### Session 9 (March 23 — Logo + Storage + Mobile Parity Sync):
- **Layout.tsx, Dashboard.tsx, Login.tsx, Signup.tsx**: Replaced placeholder CanopyLogo SVG with Grok watercolor PNG (`/canopy-watercolor-logo.png`)
- **Supabase**: Created "photos" storage bucket + RLS policies; added fireplace_type, hose_bib_locations, number_of_hvac_filters columns to homes table
- **Mobile parity sync**: All Session 8 features now synced to mobile (fireplace type, hose bibs, filter count, terms checkbox, contact info, Custom/Other pro request)

### Session 10 (March 23 — Conditional Tasks + Calendar + Portal + AI Fix):
- **maintenance.ts**: TaskTemplate gets `'fireplace'` category; gutter/fire extinguisher/countertop/water softener tasks now conditional on home features; 4 fireplace tasks + 3 sprinkler tasks added; getTasksForMonth uses `Record<string, any>` signature
- **HomeDetails.tsx + Onboarding.tsx**: Added has_gutters, has_fire_extinguisher, has_water_softener toggles, countertop_type picker, fireplace_count input
- **types/index.ts**: Added has_gutters, has_fire_extinguisher, has_water_softener, countertop_type, fireplace_count to Home interface
- **taskEngine.ts**: Task date distribution now uses deterministic hash (days 1-28, was hardcoded to 15)
- **Calendar.tsx**: Added useEffect to reset selectedDate on month/year change
- **Layout.tsx**: Portal visibility — admin sees all 3 portals, agent/pro see only their own
- **ai.ts**: Replaced raw fetch() with supabase.functions.invoke() to fix 404 JWT error
- **ProServices.tsx**: Added Custom/Other to PRO_SERVICE_TEMPLATES
- **CanopyLogo.tsx**: Component definition renders watercolor PNG (all call sites auto-updated)
- **Supabase schema**: Added has_gutters, has_fire_extinguisher, has_water_softener, countertop_type, fireplace_count columns
- **All changes synced to mobile** including maintenance.ts, home-details, onboarding, taskEngine, types

### Session 11 (March 23 — Pro Visits, Pro+ Concierge, Quotes & Invoices):
- **Migration 005**: 6 new tables (pro_monthly_visits, pro_visit_allocations, pro_plus_subscriptions, quotes, invoices, invoice_payments) + stripe columns on profiles
- **New types**: ProMonthlyVisit, ProPlusSubscription, Quote, Invoice, InvoicePayment, LineItem + status types
- **New services**: proVisits.ts, proPlus.ts, quotesInvoices.ts (full CRUD + cancellation policy)
- **New pages**: Visits.tsx, ProPlusManage.tsx, Quotes.tsx, Invoices.tsx, ProVisitSchedule.tsx, ProQuotesInvoices.tsx
- **App.tsx**: 6 new routes added
- **Layout.tsx**: sidebar links for Pro Visits, Quotes, Invoices
- **ProPortal.tsx**: quick actions for Visit Schedule and Quotes & Invoices
- **subscriptionGate.ts**: updated plan descriptions (44 tasks, Pro visit/concierge details)

### Session 11 continued — Edge Functions + Mobile + Gating:
- **Edge Functions deployed**: create-checkout (v3), stripe-webhook (v3), create-invoice-payment (v1), create-pro-plus-subscription (v1), send-notifications (v7 — multi-channel: in-app + Expo push + Resend email with preference checking, quiet hours, batch/cron modes)
- **NOTE**: `send-notification` (singular, v5) is DEPRECATED — has 13 typed email templates but nothing calls it. Delete from Supabase dashboard.
- **Layout.tsx**: Pro Visits/Quotes/Invoices sidebar links gated to pro/pro_plus tiers only
- **Mobile screens**: visits, quotes, invoices, pro-plus — all 4 created

### Session 12 (March 28 — Notifications + Email Branding):
- **send-notifications edge function**: Deployed v6 with Resend email support (3-channel: in-app + push + email)
  - Fixed ES256 JWT 401 by setting verify_jwt: false (function uses service role key internally)
  - Fixed SDK invoke bug by switching AdminNotifications to raw fetch()
  - Email template uses official brand tokens (cream #F5F0E8, sage #8B9E7E, copper #C4844E)
- **AdminNotifications.tsx**: Live at canopyhome.app/admin/notifications — send to single user, all users, or by tier
- **App.tsx**: Added /admin/notifications route with RoleRoute guard
- **AdminDashboard.tsx**: Added Notifications nav link
- **theme.ts**: Added `EmailBrand` export — full email branding (sender addresses, color palette, typography, layout, footer)
- **brand.js** (mobile): Added matching `email` export with same branding tokens
- **Google Workspace**: austin@, info@, support@, sales@ canopyhome.app set up
- **Resend**: RESEND_API_KEY added to Supabase, domain verified, sends from info@canopyhome.app
- **DNS**: MX (Google Workspace) + SPF/DKIM TXT (Resend) coexist on canopyhome.app

## Remaining Before Launch (Austin's manual tasks)

- [ ] Set Stripe secrets in Supabase: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_HOME_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_PRO_PLUS_PRODUCT_ID
- [x] Set RESEND_API_KEY in Supabase — DONE (March 28, Resend domain verified, sends from info@canopyhome.app)
- [ ] Configure Stripe webhook URL: https://uxxrmyxoyesipprwlxrn.supabase.co/functions/v1/stripe-webhook
- [x] Add stripe_customer_id / stripe_subscription_id to profiles table — DONE (Migration 005)
- [x] Deploy Edge Functions — DONE (5 functions active)
- [ ] App icon (1024x1024), App Store screenshots
- [ ] Rotate exposed Supabase anon key + GitHub token
- [ ] Batch git push both repos
- [x] Replace placeholder CanopyLogo SVG with branded asset — DONE (Session 9)
- [x] Create Supabase storage bucket "photos" — DONE (Session 9)
- [x] Mobile app parity audit — COMPLETE (Session 7-10)
