# Lead CRM + Multi-Channel Broadcast Messaging — Future Feature

> Bulk SMS/email pages, reports, channel templates, and student/staff birthday automations are specified in `BULK-SMS-EMAIL-ADDENDUM.md`.

**Status: not started as a product, but the CRM half is more built than any
other future-implementation item so far** — real backend already exists,
just has zero UI. Read `AGENT-HANDOFF.md` first for overall project state.

This bundles two related but very differently-built systems, per the
original request: (A) a lead/enrollment CRM fed by ad platforms and
organic inquiries, and (B) multi-channel broadcast messaging (WhatsApp,
Telegram, Facebook, email). Keep them conceptually separate when scoping
work — A is mostly "build the missing UI for a real backend," B is "build
a new system from zero."

## What the original design mockups show (found per the user's request to check old-version context)

Two original "SchoolOS CRM" design mockups exist at
`schoolos-english-center-project-fully/design/crm/crm-kanban.html` /
`.png` and `lead-profile.html` / `.png`, generated 2026-04-03 — this is
real design work for THIS project, not a competitor reference:

- **"Leads Pipeline"** — a kanban board (CRM as a top-level sidebar
  module, alongside Students/Academics/Finance) with columns New →
  Contacted → Trial Scheduled → (Enrolled, Lost implied). Lead cards show
  name, a program-interest tag, last-updated time. A visible
  **"760 / 1000 Leads" usage-limit bar** — implies lead volume itself was
  originally envisioned as a plan-tier-metered resource, relevant to
  `subscription-licensing/`.
- **Lead profile page** — a 5-stage stepper (New/Contacted/Trial
  Scheduled/Enrolled/Lost), contact card with source tag ("Facebook") and
  interest tag ("B1 Level"), **Call** and **WhatsApp** action buttons, a
  **"Convert to Student"** button, internal tags (e.g. "Price Sensitive",
  "Parent Inquiry"), a quick-note/log-call box, and an **activity feed**
  showing exactly the kind of history this system should produce: a
  WhatsApp message sent, an outgoing call logged with notes, a stage
  change, and lead creation attributed to **"Source: Facebook Lead Ads."**

## Part A: Lead CRM — what's already real (checked directly, not assumed)

This is the one future-implementation item where the honest answer is
"more built than expected":

- **`inquiries` table** (`src/models/Schema.ts:2014`): contactName,
  phone, email, `source` (walk_in/phone/web/referral),
  `interestLevel` (low/medium/high), `status`
  (new/contacted/qualified/converted/lost — matches the 5-stage design
  exactly), `assignedToId`, notes, and **`convertedApplicantId`** — a
  real link back to `applicants`.
- **`inquiryFollowUps` table** (`:2046`): type (call/email/meeting/note),
  notes, scheduledFor, completedAt, createdById — this is the schema
  behind the design's activity feed / "Log Call" / "Add Quick Note."
- **`GET/POST/PUT /api/admissions/inquiries`** — real, tenant-scoped,
  audited, full CRUD on the admin side.
- **`POST /api/admissions/inquiries/convert`** — genuinely wires the
  design's "Convert to Student" button: creates a real `applicants` row
  from the inquiry's data, links `convertedApplicantId` back, rejects
  double-conversion.
- **`POST /api/public/inquiries/[tenantSlug]`** — a real **public,
  unauthenticated** lead-capture endpoint, already resolving the tenant
  by `tenants.slug`. Already has genuinely production-grade basics: a
  strict rate limit (5 submissions/hour/IP via the real
  `src/libs/api/rate-limit.ts` utility) and a bot honeypot field. This is
  exactly the kind of endpoint an external landing page or ad-platform
  webhook would target.

## Part A: what's missing

1. **No admin UI at all.** Zero files under `src/features` for
   inquiries/CRM/leads — the entire backend above is currently invisible
   to every user. This is the single highest-leverage next step: the hard
   backend work is done, "just" build the kanban board and lead-profile
   page against what already exists.
2. **No route for `inquiryFollowUps`** — the table exists but nothing
   reads or writes it yet, so "Log Call" / activity feed has no backend
   endpoint despite the schema being ready.
3. **`inquirySource` enum doesn't distinguish ad platforms** — currently
   only `walk_in`/`phone`/`web`/`referral`. Needs `facebook_ads` and
   `google_ads` added (small migration) before those sources can be
   attributed correctly instead of collapsing into generic `web`.
4. **No real Facebook/Google ad-platform integration exists.** The
   public endpoint is a generic web-form receiver — "auto transmitted
   from Facebook/Google ads" is a real external-API integration project,
   not just internal wiring:
   - **Meta (Facebook/Instagram) Lead Ads**: requires a Meta Business
     app, webhook subscription to `leadgen` events, and signature
     verification on incoming webhook payloads (Meta signs requests —
     don't skip verifying this, an unverified public webhook accepting
     lead data is an abuse vector).
   - **Google Ads lead form extensions**: Google's equivalent webhook/
     lead-download mechanism, separate integration, separate credentials.
   - Both need per-tenant configuration (each school's own ad account
     connected, not one shared integration) — ties into
     `subscription-licensing/`'s addon-activation model.
5. **No lead-assignment UI** — `assignedToId` exists in schema, no way
   to actually assign a lead to a staff member yet.

## Part B: Broadcast Messaging — genuinely new, checked and confirmed 0% built

Checked directly: no WhatsApp Business API integration, no Telegram Bot
API integration, no Facebook Messenger integration, and **no email-sending
infrastructure at all** (no mail library installed, no `sendEmail`
function anywhere in the codebase). The only existing messaging
capability is `smsMessages` — real, but **one-to-one and log-only by this
app's established honest-simulation convention** (no real carrier call),
not a broadcast/campaign system to a segment of contacts.

Building this for real means, per channel:

- **WhatsApp**: WhatsApp Business Platform (Meta) API — requires a
  verified business account, template message approval process for
  outbound marketing-style messages (WhatsApp restricts free-form
  outbound messages outside a 24-hour customer-service window), real cost
  per conversation.
- **Telegram**: Telegram Bot API — comparatively simple (no template
  approval process, generous free tier), but requires each recipient to
  have started a chat with the school's bot first — a real adoption
  hurdle, not just a technical one.
- **Facebook Messenger**: Meta Messenger Platform API, similar
  policy constraints to WhatsApp around unsolicited outbound messaging.
  Consider whether this is actually worth building separately from
  WhatsApp given the overlap in effort and Meta's messaging policy
  restrictions on both.
- **Email**: needs a real provider integrated from scratch (Resend,
  SendGrid, or plain SMTP) — currently doesn't exist for *any* purpose in
  this app, not just broadcast. Worth checking whether transactional
  email (password resets, notifications) is wanted at the same time
  rather than building email infra twice.

**Recommendation: don't build all four channels at once.** Pick one
(WhatsApp is the most Morocco-relevant channel by a wide margin) and
prove the segment-targeting + campaign-sending + delivery-tracking model
end to end before replicating it across three more provider integrations
with three more sets of API credentials, rate limits, and policy rules to
manage.

## How the two parts connect

A lead's activity feed (Part A) should show broadcast messages sent to
them (Part B) — e.g. "WhatsApp campaign 'Fall 2024 Open House' sent" as a
timeline entry, matching the design's activity feed showing a WhatsApp
message inline with call logs and stage changes. Build Part A's UI first;
Part B's messages have nowhere meaningful to appear until the lead
profile page exists.

## Page-by-page business logic (implementation-ready detail)

### Part A — Lead CRM pages

#### 1. Leads Pipeline (kanban board, `/dashboard/admissions/leads` or similar)

- Columns = `inquiryStatus` values: New, Contacted, Qualified/Trial
  Scheduled, Converted, Lost (the reference design shows Trial Scheduled
  as its own visible column and folds Qualified into that stage's
  meaning — map the design's 5 visual stages onto the real 5-value enum
  directly, don't invent a 6th).
- Each card: contact name, source badge (walk_in/phone/web/referral, and
  once built, facebook_ads/google_ads), interest-level tag, last-updated
  time, assignee avatar if assigned.
- **Business logic**: drag-and-drop between columns calls
  `PUT /api/admissions/inquiries` (already real) with the new `status` —
  this is the one page where the already-built PUT endpoint gets its
  first real caller. Filter/search bar (by assignee, by source, by date
  range) — client-side filtering over a fetched list is consistent with
  this app's established pattern elsewhere, no need for server-side
  filter params unless lead volume genuinely gets large.
- "Add Lead" button — manual entry for phone/walk-in leads that didn't
  come through the public form, calls the existing
  `POST /api/admissions/inquiries`.

#### 2. Lead Profile (`/dashboard/admissions/leads/[id]`)

- Contact card: name, source, interest tag, phone, email, internal tags
  (free-text or a small fixed set like "Price Sensitive" — a new small
  `text[]` or comma-separated field on `inquiries`, or its own tags
  table if you want tags reusable/manageable, matching this app's
  "plain table for configurable lists" convention from `Schema.ts`'s own
  top comment).
- **Stage stepper**: visual version of the same status the kanban board
  shows — clicking a stage on the stepper should update status the same
  way dragging the kanban card does (one underlying action, two UI
  entry points).
- **Call / WhatsApp quick actions**: "Call" opens the phone dialer
  (`tel:` link, no real telephony integration needed) or, if the
  broadcast-messaging WhatsApp channel is built, "WhatsApp" opens a
  compose box that sends through that same integration and logs itself
  to the activity feed automatically.
- **"Convert to Student" button**: calls the already-real
  `POST /api/admissions/inquiries/convert` — this button can be built
  and wired **today** against existing backend, no new work needed
  beyond the button itself.
- **Add Quick Note / Log Call**: writes to `inquiryFollowUps` (needs its
  route built — see Part A gap #2 above): type (call/email/meeting/note),
  notes, optionally `scheduledFor` for a future follow-up reminder.
- **Activity feed**: reverse-chronological read of `inquiryFollowUps`
  plus derived events (lead created, stage changes pulled from
  `recordAudit()` history via the existing generic audit log, filtered to
  this inquiry — reuse the audit system rather than duplicating an event
  log, matching the same reasoning already applied to the attendance
  audit-journal question in that module's own future-implementation
  notes).

### Part B — Broadcast Messaging pages (build only after picking one channel per the recommendation above)

#### 3. Channel Connections (`/dashboard/settings/broadcast-channels`, likely super-admin or school-admin depending on whether channels are platform-wide or per-school credentials)

- One card per channel (WhatsApp/Telegram/Messenger/Email), each showing
  connection status and a "Connect" flow specific to that provider's auth
  model (WhatsApp Business Platform onboarding, Telegram bot token entry,
  SMTP/API-key entry for email).
- **Business logic**: credentials are tenant-scoped secrets — store
  encrypted, never render them back in full once saved (show a masked
  "•••• connected" state, same convention as how API keys are normally
  handled, not currently precedented elsewhere in this app since nothing
  else stores third-party secrets yet — this page is the first place
  that need shows up).

#### 4. Contact Segments (`/dashboard/broadcast/segments`)

- Define a reusable audience: e.g. "All parents of Grade 3", "Leads in
  'Contacted' stage", "All students with overdue invoices." Recommend
  building this as a set of **saved filter definitions** over existing
  real data (students/guardians/inquiries), not a manually-maintained
  contact list that drifts out of sync — a segment should be computed
  live at send-time from real current data.

#### 5. Campaign Builder (`/dashboard/broadcast/campaigns/new`)

- Pick a channel (must be connected per page 3), pick a segment (page 4)
  or a single inquiry/contact, compose the message (or pick a saved
  template — page 6), schedule now or later, review estimated recipient
  count before sending.
- **Business logic**: WhatsApp's 24-hour-window / template-approval
  restriction (noted in "What's missing" above) means the compose UI
  needs to know whether a given recipient is inside an open
  conversation window (free-form message allowed) or outside it
  (must use a pre-approved template) — this is a real constraint from the
  provider, not a UI nicety, and the campaign builder has to respect it
  or messages will simply fail to send.

#### 6. Message Templates (`/dashboard/broadcast/templates`)

- Named, reusable message bodies with `{{variable}}` placeholders (same
  pattern as the existing `smsTemplates` table — reuse that exact
  convention, don't invent a new templating syntax for this feature).
- For WhatsApp specifically: templates that will be used outside the
  24-hour window need to go through Meta's own template-approval process
  before they're usable — the UI should reflect an approval-status field
  per template (Draft/Pending/Approved/Rejected), not assume every saved
  template is immediately sendable.

#### 7. Delivery Reports (`/dashboard/broadcast/campaigns/[id]`)

- Per-campaign: sent count, delivered count, read count (where the
  provider exposes read receipts — WhatsApp does, email typically
  doesn't reliably), failed count with per-recipient failure reasons.
- **Business logic**: this app's own established honesty convention
  applies directly here — if a channel doesn't actually confirm delivery
  (e.g. basic SMTP), don't fabricate a "delivered" status; show "sent"
  only and say so plainly, the same discipline already used for the
  log-only SMS system elsewhere in this app.

## Addon or core?

**Addon.** This is sales/marketing tooling, not core school operations —
fits the `src/addons/registry.ts` model well. Recommend splitting into
two registry entries (`lead-crm` and `broadcast-messaging`) since a school
might reasonably want the CRM without the broadcast system or vice versa,
and they're separately gate-able.

## Recommended build order (highest leverage first)

1. **CRM admin UI** (kanban board + lead-profile page) against the
   already-real backend — cheapest, highest-visibility win, no new
   external integrations needed.
2. **`inquiryFollowUps` route** + wire it into the lead-profile activity
   feed — small, completes the already-modeled feature.
3. Extend `inquirySource` enum + build **one** ad-platform webhook
   (Facebook Lead Ads first — matches the design's own example) with
   proper signature verification.
4. **One** broadcast channel end to end (WhatsApp recommended) — segment
   selection, campaign send, delivery status, activity-feed integration.
5. Additional channels (Telegram, Messenger, Email) only after channel 1
   proves the model — don't build all four speculatively.
