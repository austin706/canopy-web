# Canopy Notifications Reference

> Last updated: 2026-04-02
> Update this file whenever notifications are added, changed, or removed.

## Architecture

- **Central dispatcher:** `send-notifications` edge function (v8)
- **Channels:** In-app (DB insert), Email (Resend API), Push (Expo Push API)
- **Client wrapper:** `sendNotification()` in `supabase.ts` — calls edge function for all 3 channels
- **Direct email mode:** `direct_email: true` on send-notifications — emails non-Canopy users
- **Preferences:** `profiles.notification_preferences` — per-category push/email toggles + quiet hours
- **Brand template:** Sage header (#8B9E7E), copper CTA button (#C4844E), cream footer (#F5F0E8)
- **From address:** `Canopy Home <info@canopyhome.app>`

## Categories

| Category | Description | Default |
|----------|-------------|---------|
| `pro_service` | Visit lifecycle, provider assignments, service requests | push + email |
| `account_billing` | Payments, invoices, subscription changes, renewals | push + email |
| `visit_summary` | AI-generated visit summaries | push + email |
| `home_maintenance` | Task reminders, warranty alerts | push + email |
| `agent` | Agent link requests, sale prep updates | push + email |
| `admin` | Admin-only alerts (new users, daily digest) | push + email |
| `general` | Default/fallback (home transfers, etc.) | push + email |

## All Notifications

### Pro Visit Lifecycle

| # | Trigger | Recipient | Channels | Title | File | Artwork |
|---|---------|-----------|----------|-------|------|---------|
| 1 | Provider proposes visit | Homeowner | In-app + Email + Push | "New Visit Proposed" | `proVisits.ts` → `proposeVisit()` | Needed |
| 2 | Homeowner confirms visit | Provider | In-app + Email + Push | "Visit Confirmed" | `proVisits.ts` → `confirmVisit()` | Needed |
| 3 | Homeowner cancels visit | Provider | In-app + Email + Push | "Visit Cancelled" / "Visit Cancelled (Forfeited)" | `proVisits.ts` → `cancelVisit()` | Needed |
| 4 | Homeowner reschedules visit | Provider | In-app + Email + Push | "Visit Rescheduled" | `proVisits.ts` → `rescheduleVisit()` | Needed |
| 5 | Provider completes visit | Homeowner | In-app + Email + Push | "Home Visit Completed" | `proVisits.ts` → `completeVisit()` | Needed |
| 6 | Homeowner rates visit | Provider | In-app + Email + Push | "New Visit Rating" | `proVisits.ts` → `rateVisit()` | Needed |
| 7 | Visit in 48 hours (cron) | Homeowner | Email | "Your First/Bimonthly Home Visit is Coming Up!" | `pro-visit-lifecycle` → `runNotify()` | Done |
| 8 | Visit unconfirmed >3 days (cron) | Homeowner | Email | "Confirm Your Upcoming Visit" | `pro-visit-lifecycle` → `runNotify()` | Done |
| 9 | Visit completed yesterday (cron) | Homeowner | Email | "Your Home Visit Summary is Ready" | `pro-visit-lifecycle` → `runNotify()` | Done |
| 10 | Visit month expired unused (cron) | Homeowner | In-app + Email | "Missed Visit — Month Forfeited" | `pro-visit-lifecycle` → `runForfeit()` | Done |
| 11 | Next visit auto-proposed after completion | Homeowner | In-app + Email + Push | "Next Visit Proposed" | `proEnrollment.ts` → `proposeNextVisit()` | Needed |
| 12 | Homeowner adds pre-visit notes | Provider | In-app + Email + Push | "Homeowner Added Visit Notes" | `ProServices.tsx` → `handleSaveVisitNotes()` | Needed |
| 13 | AI visit summary generated | Homeowner | In-app + Email | "Your Home Visit Summary is Ready" | `generate-visit-summary` edge function | Done |

### Pro Enrollment & Assignment

| # | Trigger | Recipient | Channels | Title | File | Artwork |
|---|---------|-----------|----------|-------|------|---------|
| 14 | User subscribes to Pro/Pro+ | Homeowner | In-app + Email + Push | "Welcome to Canopy Pro!" | `proEnrollment.ts` → `enrollProSubscriber()` | Done |
| 15 | New Pro welcome (cron fallback) | Homeowner | Email | "Welcome to Canopy Pro!" | `pro-visit-lifecycle` → `runNotify()` | Done |
| 16 | Provider assigned to homeowner | Homeowner | In-app + Email + Push | "Pro Provider Assigned" | `AdminProRequests.tsx` | Done |
| 17 | Provider assigned to homeowner | Provider | In-app + Email + Push | "New Service Assignment" | `AdminProRequests.tsx` | Done |
| 18 | New client assigned to provider | Provider | In-app + Email + Push | "New Pro Client Assigned" | `proEnrollment.ts` → `enrollProSubscriber()` | Done |

### Service Requests

| # | Trigger | Recipient | Channels | Title | File | Artwork |
|---|---------|-----------|----------|-------|------|---------|
| 19 | Homeowner submits service request | Admin(s) | In-app + Email + Push | "New Pro Request: {TYPE}" | `ProRequest.tsx` | Done |
| 20 | Admin updates request status | Homeowner | In-app + Email + Push | "Service Pending/Matched/In Progress/Completed" | `AdminProRequests.tsx` | Done |

### Billing & Subscription

| # | Trigger | Recipient | Channels | Title | File | Artwork |
|---|---------|-----------|----------|-------|------|---------|
| 21 | Invoice payment successful (Stripe) | Homeowner | In-app + Email | "Payment Confirmed" | `stripe-webhook` → `notifyUser()` | Done |
| 22 | Subscription canceled (Stripe) | Homeowner | In-app + Email | "Subscription Canceled" | `stripe-webhook` | Done |
| 23 | Payment failed (Stripe) | Homeowner | In-app + Email | "Payment Failed" | `stripe-webhook` | Done |
| 24 | Provider sends invoice | Homeowner | In-app + Email + Push | "New Invoice Received" | `quotesInvoices.ts` → `sendInvoice()` + `ProQuotesInvoices.tsx` | Needed |
| 25 | Subscription renewal in 3 days (cron) | Homeowner | In-app + Email | "Subscription Renewal Coming Up" | `pro-visit-lifecycle` → `runRenewal()` | Needed |

### Home Transfer

| # | Trigger | Recipient | Channels | Title | File | Artwork |
|---|---------|-----------|----------|-------|------|---------|
| 26 | Seller initiates transfer (buyer has account) | Buyer | In-app + Email + Push | "Home Record Transfer" | `homeTransfer.ts` → `notifyBuyerOfTransfer()` | Done |
| 27 | Seller initiates transfer (buyer NO account) | Buyer | Direct Email | "Home Record Transfer" | `homeTransfer.ts` → `notifyBuyerOfTransfer()` | Done |
| 28 | Buyer accepts transfer | Seller | In-app + Email + Push | "Home Transfer Accepted" | `homeTransfer.ts` → `acceptTransfer()` | Needed |
| 29 | Buyer declines transfer | Seller | In-app + Email + Push | "Home Transfer Declined" | `homeTransfer.ts` → `declineTransfer()` | Needed |

### Agent & Sale Prep

| # | Trigger | Recipient | Channels | Title | File | Artwork |
|---|---------|-----------|----------|-------|------|---------|
| 30 | Agent requests to link | Homeowner | In-app + Email + Push | "Agent Link Request" | `AgentLinkClient.tsx` | Done |
| 31 | Homeowner approves link (agent has account) | Agent | In-app + Email + Push | "Agent Link Approved" | `AgentView.tsx` → `handleApproveRequest()` | Needed |
| 32 | Homeowner approves link (agent NO account) | Agent | Direct Email | "Agent Link Approved" | `AgentView.tsx` → `handleApproveRequest()` | Needed |
| 33 | Homeowner declines link | Agent | In-app + Email + Push | "Agent Link Declined" | `AgentView.tsx` → `handleRejectRequest()` | Needed |
| 34 | Homeowner activates sale prep (agent has account) | Agent | In-app + Email + Push | "Client preparing to sell" | `salePrep.ts` → `notifyAgentSalePrep()` | Done |
| 35 | Homeowner activates sale prep (agent NO account) | Agent | Direct Email | "Your client is preparing to sell" | `salePrep.ts` → `notifyAgentSalePrep()` | Done |
| 36 | Sale prep hits 25/50/75/100% (agent has account) | Agent | In-app + Email + Push | "Sale Prep {X}% Done" / "Sale Prep Complete!" | `salePrep.ts` → `toggleSalePrepItem()` | Needed |
| 37 | Sale prep hits milestone (agent NO account) | Agent | Direct Email | "Sale Prep {X}% Done" / "Sale Prep Complete!" | `salePrep.ts` → `toggleSalePrepItem()` | Needed |

### Admin

| # | Trigger | Recipient | Channels | Title | File | Artwork |
|---|---------|-----------|----------|-------|------|---------|
| 38 | Daily digest: new signups + Pro subs (cron) | Admin(s) | In-app + Email | "Daily Activity Summary" | `pro-visit-lifecycle` → `runAdmin()` | Needed |
| 39 | Admin sends broadcast | Target users | In-app + Email + Push | (Custom) | `AdminNotifications.tsx` | N/A |

### Equipment & Maintenance

| # | Trigger | Recipient | Channels | Title | File | Artwork |
|---|---------|-----------|----------|-------|------|---------|
| 40 | Warranty expires in 30 days (cron) | Homeowner | In-app + Email | "Warranty Expiring Soon" | `pro-visit-lifecycle` → `runWarranty()` | Needed |

## Cron Schedules (pg_cron)

| Job Name | Schedule | Mode | Purpose |
|----------|----------|------|---------|
| `pro-lifecycle-monthly` | 1st of month, 6am UTC | allocate + forfeit | Create bimonthly allocations, forfeit missed months |
| `pro-lifecycle-daily-notify` | Daily, 8am UTC | notify | 48h reminders, confirmation nudges, post-visit followups, welcome emails |
| `pro-lifecycle-daily-admin` | Daily, 7am UTC | admin | New signup + Pro subscription digest to admins |
| `pro-lifecycle-daily-renewal` | Daily, 9am UTC | renewal | 3-day subscription renewal reminders |
| `pro-lifecycle-daily-warranty` | Daily, 10am UTC | warranty | 30-day warranty expiration alerts |

## Edge Functions Involved

| Function | Version | Role |
|----------|---------|------|
| `send-notifications` | v8 | Central dispatcher: in-app + push + email + direct_email |
| `pro-visit-lifecycle` | v2 | Cron-driven: allocate, notify, forfeit, admin, renewal, warranty |
| `stripe-webhook` | v11 | Payment confirmation, cancellation, failure notifications |
| `generate-visit-summary` | v4 | AI summary + immediate email on generation |

## Artwork Status

Items marked "Needed" above don't yet have custom email artwork/illustrations. All use the standard branded HTML template (sage header, copper CTA, cream footer). Candidates for custom artwork:

- Visit lifecycle emails (proposed, confirmed, completed, rating)
- Invoice received
- Transfer accepted/declined
- Agent link approved/declined
- Sale prep milestone progress
- Subscription renewal reminder
- Warranty expiration
- Admin daily digest

## Notification Delivery Architecture (updated 2026-04-02)

Notifications use a **decouple-and-queue** pattern: the client saves to DB, a server-side cron handles email + push.

### How it works:

1. **Client saves notification to DB** — `sendNotification()` or `sendDirectEmailNotification()` inserts a row into the `notifications` table with `pushed=false`, `emailed=false`. This is fast, reliable, and doesn't depend on edge functions.

2. **pg_cron picks up pending notifications every 2 minutes** — calls `send-notifications?mode=process-queue` server-to-server via pg_net. The process-queue:
   - Finds rows where `pushed=false OR emailed=false` (created in last 2 hours)
   - Looks up `profiles.push_token` + `profiles.email` for registered users
   - Uses `recipient_email` column for non-account recipients (agents, buyers, etc.)
   - Sends email via Resend, push via Expo Push API
   - Marks `pushed=true`, `emailed=true` after successful delivery
   - Respects `notification_preferences` per category

3. **Admin/broadcast notifications** use raw `fetch()` to call the edge function directly (the `supabase.functions.invoke()` SDK method has a CORS issue where the POST never reaches the function after the OPTIONS preflight — discovered 2026-04-02).

### Key functions:
- `sendNotification(params)` — for registered users (saves in-app + queues email/push)
- `sendDirectEmailNotification(params)` — for any recipient including non-account users; supports optional `user_id` for in-app + email combo

### Notifications table columns:
- `user_id` (nullable) — registered user; used for in-app display + profile email lookup
- `recipient_email` (nullable) — explicit email target; takes priority over profile email
- `pushed` (boolean) — tracks push delivery status
- `emailed` (boolean) — tracks email delivery status
- `data` (jsonb) — stores `action_label`, `subject` for process-queue to use

### In-app notification display:
- **Homeowner sidebar** — /notifications page (added 2026-04-02)
- **Pro Portal** — built-in notifications section with unread badge
- **Agent Portal** — notifications tab with unread count

## Cron Schedules

| Job | Schedule | Function | Mode |
|-----|----------|----------|------|
| notification-process-queue | Every 2 min | send-notifications | process-queue |
| pro-lifecycle-monthly | 1st of month 6am | pro-visit-lifecycle | allocate + forfeit |
| pro-lifecycle-daily-notify | Daily 8am | pro-visit-lifecycle | notify (48h reminders) |
| pro-lifecycle-daily-admin | Daily 7am | pro-visit-lifecycle | admin (daily digest) |
| pro-lifecycle-daily-renewal | Daily 9am | pro-visit-lifecycle | renewal (3-day warning) |
| pro-lifecycle-daily-warranty | Daily 10am | pro-visit-lifecycle | warranty (30-day warning) |
| weekly-home-health-summary | Monday 2pm | send-notifications | weekly-summary |

## Future Considerations

- **Provider en route / arriving soon** — requires manual trigger or location-based
- **Quiet hours timezone conversion** — currently UTC, need user timezone
- **Notification batching / digest mode** — combine multiple notifications into one email
- **SMS channel** — for critical notifications (payment failed, visit tomorrow)
- **Read receipts / engagement tracking** — know which emails are opened
