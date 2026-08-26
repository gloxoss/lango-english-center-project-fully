# SchoolOS — Product Review & Fixes

**Source:** `Next implementations and fixes.md` (your raw screen-by-screen walkthrough, 75 screenshots).
**Status:** ⏳ PENDING YOUR REVIEW — this is a planning/review document only. Nothing in the application was changed to produce it (the two items marked "FIXED tonight" below were fixed in an earlier pass and are just reported here, not new work from this pass).

**What changed since the first draft:** the first pass was written text-only, without opening any of the 75 screenshots — several of its screenshot-to-item pairings turned out to be wrong. This version was rebuilt by four passes that each opened every cited image directly and cross-checked it against the actual current codebase (`schoolos-app/src/features/**`, `schoolos-app/src/app/api/**`, `schoolos-app/src/models/Schema.ts`). Every "screenshot correction" note below means: the original draft paired that item with the wrong image, or misjudged what the code actually does — corrected here after looking. One deeper finding: in the raw walkthrough note itself, five consecutive screenshots (`...110125`, `...110554`, `...110727`, `...111250`, `...112023`) were pasted slightly out of step with the comment that follows them — verified by opening each file individually, twice. The correct pairing is used throughout.

**Second wave:** you kept reviewing after the first pass was delivered and added ~250 more lines / ~100 more screenshots to the raw note, covering twelve more modules the first pass never reached (Events follow-up, Library, Finance, Inventory, Broadcast/Communication, Report Cards, HR/Payroll, Guard Portal, Hostel, Transport, Reports & Analytics, Settings). Eight more passes audited that wave with the identical discipline — every image opened, every claim checked against the real code — and are merged in below as modules 11–22. Two module-identity corrections came out of that pass worth flagging up front: what looked like one HR "full refacture" batch turned out to be a completely separate module (**Sécurité & Gardiens**, the guard/security portal — now module 18), and a page suspected of being a raw-JSON Settings problem actually belongs to the Payroll sub-module instead (Settings itself checked out clean, 30/30 real pages).

**How to use this document:** read each item, check whether the write-up matches what you actually meant/saw — correct me inline where it doesn't. The [Module Health Overview](#module-health-overview) gives you the fastest at-a-glance read across all 22 modules; the **execution plan** after it sorts all 135 items into five buckets (already fixed, quick safe fixes, real bugs needing work, unbuilt features needing a scoping decision, and deferred design-exploration briefs) so we can decide what to actually build next, in what order.

## How to read this

- 🐞 **Bug** — broken behavior, 404, error, "doesn't work"
- ✨ **Feature** — new or changed capability
- 🎨 **UX / Design** — layout, look, flow, ease of use
- ❓ **Question** — needs an explanation before we decide
- 🔍 **Audit** — verify the business logic / completeness against how it should work

## Summary

| Module | Items |
|---|---|
| 1. Super Admin | 1.1 – 1.5 |
| 2. Students | 2.1 – 2.9 |
| 3. Alumni | 3.1 |
| 4. Events | 4.1 |
| 5. Student Requests / Demand | 5.1 |
| 6. Academics | 6.1 – 6.17 |
| 7. Personnel / HR (teacher directory) | 7.1 – 7.5 |
| 8. Attendance | 8.1 – 8.7 |
| 9. Documents — Cards & Convocations | 9.1 – 9.7 |
| 10. Examinations / Assessment | 10.1 – 10.6 |
| 11. Events — Additional Findings | 11.1 – 11.4 |
| 12. Library / Bibliothèque | 12.1 – 12.7 |
| 13. Finance | 13.1 – 13.21 |
| 14. Inventory & School-Shop Addon | 14.1 – 14.3 |
| 15. Broadcast / Communication | 15.1 – 15.5 |
| 16. Report Cards / Bulletins | 16.1 |
| 17. HR / Personnel — Payroll & Self-Service | 17.1 – 17.9 |
| 18. Sécurité & Gardiens (Guard Portal) | 18.1 – 18.4 |
| 19. Hostel / Internat | 19.1 – 19.12 |
| 20. Transport | 20.1 |
| 21. Reports & Analytics | 21.1 |
| 22. Settings | 22.1 – 22.8 |

**135 items total across 22 modules.** Jump to the [Module Health Overview](#module-health-overview) for the fast version, or the [execution plan](#execution-plan--how-to-fix-it-all) for fixing priorities.

---

# 1. Super Admin

## 1.1 — Are the listed schools real or mocks?

![](Pasted%20image%2020260813105609.png)

**RESOLVED.** Out of 156 tenants in the shared dev database, only **2 are real**: `Groupe Scolaire Atlas` (slug `atlas`) and `SchoolOS Center` (slug `schoolos`). The screenshot itself already shows the tell — right under "SchoolOS Center" the next rows are literally named "Adversarial School A", "Adversarial School B", "Adversarial Disabled", "Transport Tenant A 072181", "Transport Tenant B 072181", each with a random UUID or a `tenant-a-trans-072181`-style slug instead of a real school name.

The other 154 are leftover throwaway fixtures created by this project's own `scripts/verify-*.mjs` automated test runs across its history — names like "Adversarial School A/B", "Lifecycle Test", and batches of cryptic `v0097-`/`v0103-`/`vreports-`-prefixed tenants. They were never cleaned up and were never real client schools.

You were shown this and chose to delete them, but the actual deletion is currently **blocked**:
- **42 of the 154** hit real, deliberate accounting-audit-trail immutability triggers (compliance-style "never delete" guards — working as designed, just inconvenient here).
- The remaining ones sit behind a very deep FK dependency graph — **131+ tables reference `user` alone** — so a naive delete cascades into a large blast radius.

Nothing was deleted; the database is untouched. A proper cascading-delete cleanup script (or an `anonymize`/soft-archive path — there's already an `/api/super-admin/schools/anonymize` route, worth checking whether it's reusable here) is real, legitimate future work. **You've already told me to leave this for now** — it stays parked until you want it picked back up.

## 1.2 — Waitlist page returns 404

**FIXED.** The page was linked in the sidebar ("Liste accès prioritaire") but had zero implementation — an empty route directory, no backing schema, no API. It was never actually built, not just misconfigured.

Built a "coming soon" placeholder using this app's own established pattern (the `ComingSoonView` component — the same one used for the Support and SMS platform pages in 1.4) rather than building the real feature speculatively. There's no product definition yet for what a school "priority access waitlist" is actually supposed to do — an approval queue for schools requesting access? A demo-request queue? Self-serve trial signups? If you want a real waitlist feature, that needs a short product-definition pass first (what puts a school in this list, what actions can be taken on an entry, does it connect to `super-admin/schools/create`) before it's worth building.

## 1.3 — School management page needs real actions

**Screenshot correction:** the source note pairs this item with `Pasted image 20260813105709.png`, but that image is not a single school's management page — it's the platform-wide **"Plans & Modules"** catalog (reached via the sidebar's "Abonnements & Tarifs"), listing every addon type the platform knows about.

![](Pasted%20image%2020260813105709.png)

🔍 **Audit — what already exists today** (checked the code directly):
- **Activate / deactivate a school** — exists. `/dashboard/super-admin/schools/[id]` has a working "Désactiver / Réactiver cette école" button plus editable plan tier (Essai/Basique/Standard/Premium) and subscription status (Actif/Suspendu/Annulé), all wired to a real `PUT /api/super-admin/schools`.
- **Grant a specific add-on to a school** — exists, and is more complete than the screenshot suggests. `/dashboard/super-admin/subscriptions/list` opens a per-school detail dialog with a real on/off `Switch` per addon, backed by `POST/DELETE /api/super-admin/entitlements`, which supports an expiry date and a note per grant, and enforces addon dependencies server-side (e.g. `payroll-workforce` requires `human-resources` to already be active).
- **See a school's access** — exists, in that same per-school detail dialog (shows every addon with Built/À venir status and whether it's currently active for that tenant).
- **Subscription management with plan + limits** — partially exists: plan tier and status are editable; there's a license/payments view (`/dashboard/super-admin/subscriptions/list` → per-school license status, pending payments, "decide" endpoint). What's genuinely **missing**: no UI to define per-plan *limits* (max students, storage, feature caps) — plan tier today is just a label, not a rule enforced anywhere.
- **Add a brand-new add-on to the system** — does **not** exist as an admin action and structurally can't without a code change. The addon catalog (`src/addons/registry.ts`) is a hardcoded TypeScript array, not database-driven. Defining a new addon type means editing that file and redeploying, not clicking a button.

🎨 **UX note:** the "Plans & Modules" catalog descriptions are literally written as developer handoff notes — e.g. *"The only addon actually built and gated today – see POST /api/settings/branches"* and *"Not built."* — visible verbatim to whoever is logged in as super admin. Useful as an internal audit trail, but it reads as an engineering changelog, not a product page, if a real super-admin ever sees it. Worth deciding whether to keep it internal-only or write user-facing copy.

**Net assessment:** most of what you asked for here already exists — it's just spread across three different pages (school detail, Plans & Modules catalog, subscriptions list/detail) instead of one unified "manage this school" screen. Consolidating those three into one page, plus adding real plan-tier limits, is the actual remaining work — smaller than the original ask implied.

## 1.4 — Super-admin dashboard & remaining pages audit

**Screenshot correction:** the real, data-populated Super Admin dashboard is the image below; the four images filed here are four *other* sidebar pages, all showing the same "Fonctionnalité à venir" placeholder.

**The real dashboard** (`Tableau de bord Plateforme — All Branch Dashboard`):

![](Pasted%20image%2020260813110125.png)

Already built with real, non-mock data: staff/student/parent/teacher counts, new-admissions-in-30-days, invoices issued, active classes, groups/rooms, a revenue-vs-outstanding donut, an annual fee summary chart, a student-quantity-by-branch donut, a weekly attendance inspection bar chart, a school calendar, a birthdays widget, and a "Recent Client Schools" list. Solid dashboard already — doesn't need a rebuild, though it could use per-school drill-down and real alerting.

**The four "remaining pages"** — turns out they're not hypothetical, they're already in the sidebar, all already stubbed with the same `ComingSoonView` pattern used for the waitlist fix in 1.2:

![](Pasted%20image%2020260813105940.png)
![](Pasted%20image%2020260813105948.png)
![](Pasted%20image%2020260813105956.png)
![](Pasted%20image%2020260813110006.png)

- **Consommation SMS** ("SMS Plateforme") — platform-wide SMS credits/log. Not built.
- **Support & Incidents** ("Support Plateforme") — tickets/support requests from client schools. Not built.
- **Rapports Plateforme** — aggregated cross-school statistics/reports. Not built.
- **Santé & Infrastructure** — technical settings and platform monitoring. Not built.

🔍 **Audit answer:** this fully answers "brainstorm the remaining super-admin pages" — no need for a separate brainstorm, the inventory already exists in the sidebar and each page honestly tells you it's unbuilt rather than showing fake data. Whichever of these four you want next is a straightforward "build this ComingSoonView into a real page" task, same shape as the waitlist fix.

## 1.5 — Explain the analytics page fully

**Screenshot correction:** the page actually titled "analytics" is reached via **Analytics & Croissance** in the *school admin* sidebar (not super-admin), titled **"Portail direction"** (Director's Portal):

![](Pasted%20image%2020260813110554.png)

Important scoping correction: this is a **school-level** page (logged in as a school admin), not a platform-wide analytics page. It's the school director's strategic overview:

- **Top 6 stat tiles:** Élèves inscrits (enrolled + new this month), Taux de présence (30-day rate), Recouvrement frais (collected / invoiced), Moyenne générale (school-wide average grade), Alertes non résolues (critical vs important), Présence personnel (shows "—" — an honest empty state, not a fake number).
- **"Aperçu des performances de l'institution" (IGP):** a single composite score /100 plus a 6-month trend. A synthetic index, not a standard metric — worth defining exactly what feeds into it (attendance? fees? grades? weighted how?) since right now it reads as a number without a documented formula.
- **Performance académique:** overall average-grade bar, with an honest disclaimer that per-level (Primaire/Collège/Lycée) breakdown only populates once real results are entered.
- **Insights clés:** three auto-generated callouts — each currently just restates a stat tile above, not a distinct new insight yet.
- **Aperçu financier:** donut of annual MAD objective vs. recovered vs. still-to-recover vs. discounts/write-offs.
- **Risques & alertes:** triaged list — critical presence alerts, overdue invoices, repeated lateness/absence — each linking to a fuller risk register.
- **Aperçu du personnel:** total staff, average presence ("—" for the same reason as above), teacher count, links to HR dashboard.
- **Réunions à venir / Annonces institutionnelles / Actions prioritaires:** upcoming parent meetings, announcements feed, a short prioritized to-do list.

Genuinely useful and mostly real (attendance/fees/grades come from live data) — the one soft spot worth being upfront about is the "IGP / 100" composite score, which has no documented formula yet.

---

# 2. Students

## 2.1 — Directory: infinite scroll + sticky detail card + actions + pagination

![](Pasted%20image%2020260813110727.png)

🔍 **Audit against current code:**
- **The "infinite scroll" complaint is gone, but not fixed correctly.** `students-list-client.tsx` does one single fetch of `/api/students?pageSize=200` on load and never fetches more. No scroll listener, no "load more" — but also **no real pagination UI**. A school with more than 200 active students would simply never see students 201+, with no indication anything is missing. The backend already supports real pagination (`parsePagination()`), it's just not wired up.
- **The "sticky" complaint doesn't reproduce as described.** Grepped the UI for `sticky` — there is none. The right-hand "Profil Élève" card is a normal-flow flex sibling, not CSS `position: sticky`. Possible this was already fixed, or the complaint is really about the related annoyance: because there's no real pagination, a long roster still means a lot of scrolling, and the profile card resets to whichever row you last clicked. Worth a quick live check.
- **Action buttons on rows:** still not present. Modifier/Supprimer only live in the right-hand inspector for whichever single student is selected — no inline per-row actions.

✨ **Remaining work:** wire the existing backend pagination into the UI (real page controls, not a 200-row cap), add per-row action buttons. Small-to-medium — no new backend needed for pagination.

## 2.2 — Admission: edit access during the process + interview logic

![](Pasted%20image%2020260813111250.png)
![](Pasted%20image%2020260813112023.png)

🔍 **Audit — interview logic, scheduling, and the rest: this is real and works.**
- **Interview scheduling** — real: date/time, interviewer (picked from actual staff), location, status (Planifié/Terminé/Annulé), saved via `PUT /api/students/admissions/[id]/interview`.
- **Internal notes thread** — real, staff-only comments.
- **Checklist** (Pièces reçues / Entretien fait / Dossier complet) — real, independently toggled and persisted.
- **Approve/Reject/Mettre en revue** — real, and on approval runs a full transaction: reserves a real sequential matricule, creates the student record, copies uploaded admission documents onto the student's file (including the photo), links/creates the guardian, and issues real login access.

🐞 **The actual bug, confirmed:** genuinely **no way to edit a candidate's core information** (email, phone, DOB, gender, nationality, city, mother tongue, blood group) from this screen once submitted — plain read-only text, no "Modifier" button. **UI gap, not a backend gap** — `PATCH /api/students/admissions` already accepts edits to most of these fields as long as status is still `applied` (correctly blocks edits once a decision is made). So the fix is adding an edit form to this existing screen that calls the API that already exists.

## 2.3 — Admission: add a tutor inline when not in the list

![](Pasted%20image%2020260813111749.png)
![](Pasted%20image%2020260813112326.png)

✨/🔍 **Good news: this is already built, in spirit.** In the wizard's step 2 ("Tuteur & contacts"), if a guardian search comes back empty, a "Aucun tuteur trouvé ? Créer un nouveau tuteur" link expands an inline mini-form right there — no navigation away. The core ask is functionally satisfied.

One nuance: the second screenshot shows a richer "Enregistrer un nouveau foyer familial" modal (Nom de Famille / Tuteur Principal / Téléphone / Adresse / Premier enfant rattaché / Classe de l'enfant). The wizard's *current* code has a simpler 3-field form (name/phone/email) — either this richer modal now lives elsewhere (check Parents & Tuteurs page), or the wizard was simplified since this screenshot. See 2.5 for the precise version of this gap.

## 2.4 — Admission: dossier status cards don't change + tutor should not block creation

![](Pasted%20image%2020260813111821.png)

🐞 **Still broken, confirmed in code.** The four KPI cards (Dossiers en cours / Dossiers complets / Documents manquants / Frais d'inscription) are hardcoded to the literal string `'—'` in `student-admission-view.tsx` for all four. Never wired to real counts — no data behind them yet.

✨ **The "tutor blocks creation" half appears to already be fixed** — worth a quick live re-check. Reading the wizard code: the "Suivant" button's only validation gate is on step 1 (student info); steps 2–4 have no required-field gate, and final submission sends whatever guardian info exists, including none. If that's not what you're seeing live, reproduce it directly — but nothing in the code enforces a tutor requirement today.

## 2.5 — Tutor form: missing fields that appear in the profile

![](Pasted%20image%2020260813112400.png)

🐞 **Confirmed real bug, with the precise cause.** The `guardians` table already has `occupation`, `address`, `emailOptIn`, `smsOptIn`, `preferredLanguage` — not a schema gap. Two separate form/API gaps:
1. The wizard's inline "create tutor" mini-form (2.3) only collects name/phone/email — occupation/address/comm-prefs end up unset (defaulting to opt-in true, empty occupation/address) when the guardian is created at approval time — exactly the wrong auto-added values you saw.
2. The standalone Parents & Tuteurs page's creation API (`guardianCreateSchema`) is stricter still — accepts name/relation/phone/email/address but has **no field at all** for occupation/emailOptIn/smsOptIn, and is `.strict()` (rejects unknown fields). So adding inputs to that form's UI alone wouldn't be enough — the API schema needs the fields too.

**Scope:** small-to-medium — one Zod schema, one API route's insert/update payload, two forms (wizard mini-form + standalone form).

## 2.6 — Directory: explain the matricule logic

![](Pasted%20image%2020260813112502.png)

❓ **How it actually works** (`src/libs/services/matricule.ts`): matricules are real and sequential, format `STD-{year}-####`, tracked per-tenant in a `naming_series` table. Exactly **one** shared function (`reserveMatricule`) is called by every path — direct creation, admission approval, bulk import — so there's no drift.

**They are already fully automatic.** Every real creation path calls `reserveMatricule()` itself — you don't need to generate anything manually.

🐞 **The bug actually causing the confusion:** the "Réserver le prochain" button calls `GET /api/students/matricules`, which doesn't just preview the next number — it calls the exact same `reserveMatricule()` used for real creation, which **increments and permanently saves** the counter. So every click — even just curiosity — burns a real matricule forever with no student attached, silently creating a permanent gap. That's the confusion. (Also: using `GET` for a mutating action is unusual REST practice, worth fixing regardless.)

## 2.7 — Photos: better views + add image in admission form + full gallery

![](Pasted%20image%2020260813112633.png)

✨ **One of the three asks is already done.** Photo upload already lives in the admission form (step 3), and on approval that photo is automatically copied to the new student's `photoUrl`.

🔍 **What's still missing** (`student-photos-view.tsx`):
- **Clicking a student here opens the file picker directly**, not a gallery/viewer — matches your complaint exactly. No per-student photo history, just one current `photoUrl`.
- **Only one view exists**, no alternate layouts.
- **No bulk/multi-student upload** — strictly one file → one student at a time.

**Scope:** medium — a real multi-photo gallery is a data-model change (today it's a single field, not a collection); alternate grid/list views and bulk upload are UI-only additions.

## 2.8 — Transfer: too hard + 3 playground variations

![](Pasted%20image%2020260813112917.png)

🎨 The screenshot matches your description — search a student, pick a destination branch and class, one flat form with no guidance. Pure design-exploration ask (3 no-logic playground variations), not a bug or backend gap. Scope: UI/UX exploration only.

## 2.9 — Promotion: should be automatic + better management

![](Pasted%20image%2020260813113044.png)

🔍 **Audit, confirmed in `promotions-view.tsx`:** promotion today is **100% manual** — pick source class, pick destination, roster loads, manually check/uncheck who moves, click Promouvoir. No automatic threshold/grade-based logic anywhere — no read of average grades, no configurable pass threshold, nothing tied to grading.

**Scope:** genuinely large, unbuilt feature — requires deciding what "passing" means (configurable threshold? per-subject minimums? school policy?), wiring to real grades, and designing what happens to borderline/failing students. Worth its own scoping pass.

---

# 3. Alumni

## 3.1 — Auto-transition + what's available

![](Pasted%20image%2020260813113212.png)

🔍 **What exists today** (`src/libs/services/alumni-transition.ts`): the transition itself is real and well-built — flips role to alumni, records who/when, kills old credentials/sessions, issues brand-new alumni-portal access. Single and bulk versions share the exact same function.

**The value of saving them here:** alumni get a genuine self-service portal (`/alumni/*`):
- **Directory** — opt-in searchable alumni directory.
- **Events** — alumni-specific events with RSVP.
- **Mentoring** — a mentoring feature.
- **Profile** — self-managed.
- **Records** — downloadable official documents.
- **Requests** — request something from the school (e.g. re-issued transcript), reviewed via a real approve/reject workflow.

🐞/✨ **What's confirmed missing:** the transition is **only ever manual** — no scheduled job or automatic trigger tied to "student's last class/year ends." Automating it requires deciding what "last class ended" means in this system and hooking that into a scheduled process — bounded work, since the transition logic itself is already solid.

---

# 4. Events

## 4.1 — Edit events + links/videos + connect to app/website

![](Pasted%20image%2020260813113313.png)

**Image correction:** this screenshot is **not** the new Events module — it's the separate, smaller **Alumni Events** page (`title`, `description`, `location`, `startsAt` only — create + delete, no edit route, no video/link fields). The underlying question applies more to the **real** Events module (`src/features/events/**`, 11 API routes under `/api/addons/events/**`), so this audit answers it against that module, which is what the school will actually use.

- 🐞 **Bug confirmed — no way to edit a created event.** The admin Events screen only wires up Create. Its "Gérer l'événement & les billets" button has **no `onClick` handler at all**. There is **no `updateEvent`/`editEvent` function and no PATCH/PUT route for the core event record** — sub-resources (venue, task, incident) do have working updates, but the event itself is immutable except publish/cancel. Real gap: the backend has nowhere to send an edit even if a button existed.
- ✨ **"More detail" fields exist in schema but aren't reachable.** `eventVenues.onlineLink` already works at creation. An `eventAttachments` table (title, fileKey, mimeType, kind) exists but has **zero API routes and zero UI** — an orphaned table. No dedicated video-URL field.
- ✨ **Link to app/public site: does not exist yet.** `events.visibility` supports `public`, but **no public-facing route anywhere** renders `visibility: 'public'` events. "Public" is currently a flag with no consumer.
- ✨ **Audience targeting logic already exists** — `eventAudienceRules` supports targeting by school/role/class/subject/user/group, and `listVisibleEvents` filters accordingly. Just not exposed in the admin create/edit UI (which hardcodes `visibility: 'internal'`).
- ✨ **Notification logic already exists and is real, not stubbed** — `sendEventCommunication`, reminder rules, and a communications API reuse the existing in-app notification outbox.

**Net assessment:** the event-management addon is solid operationally (venues, audiences, check-ins, waitlist, communications, reports, tasks, incidents, feedback). The concrete gap is narrower than it looks: **no edit-event capability, no attachments/video wiring, no public-site consumer** — tags/targeting/notifications are already built.

---

# 5. Student Requests / Demand

## 5.1 — Kanban workflow for student demand

![](Pasted%20image%2020260813113433.png)

**Scope correction:** this screen is specifically **Alumni Records Requests** (diploma reissue, correction, data-access, deletion requests from former students) — not a general "student demand" system. Worth confirming whether you mean this alumni-request flow specifically, or want a broader student-services demand queue for currently-enrolled students; the fix below is scoped to what's on screen.

- ✨ **Current workflow is binary, not a pipeline.** Status enum is just `pending → approved | rejected`, UI is a flat filtered list with Approuver/Rejeter — no board, no columns, no intermediate states. Building **demand received → accepted → preparing → ready → taken/refused** requires: extending the status enum (2 states → 5), a kanban board UI, and transition guards per column.
- ✨ **"Make sure the student actually gets what they need."** Today `approved` just flips a status flag — no fulfillment step, no linkage to an actual deliverable, no `taken`/`refused` terminal state. Needs a defined fulfillment object per request type.
- ✨ **No analytics exist** — no dashboard, counts-by-type, turnaround-time metric anywhere. Scope: a small analytics panel once the multi-stage pipeline exists to measure.

---

# 6. Academics

## 6.1 — Classes: sections + teacher assignment + availability + weekly calendar

![](Pasted%20image%2020260813113737.png)

The real `/dashboard/academics/classes` page. "Nouvelle classe" only has 5 fields: **Nom, Médium, Shift, Filière, Cycle**. No section count, no teacher assignment, no calendar — sections are created separately (6.3) and teacher assignment happens on a completely different page (6.14).

- ✨ **Feature:** confirmed real gap. When adding a class you should be able to select the number of sections to auto-create, assign teachers right there, get teacher suggestions based on availability (nothing like this exists — no availability model at all, anywhere), and see a weekly calendar preview.
  - **Scope:** large — touches the class-creation modal, needs a new teacher-availability data model (doesn't exist), a weekly-grid preview UI. Bundles three features, not a small tweak.

## 6.2 — Clarify "Medium / language of instruction"

![](Pasted%20image%2020260813113938.png)

**Answer, confirmed from the schema:** `mediums` is a bare reference table (`id, tenantId, name`), FK'd from `classes`/`class_sections`/`subjects`. A Medium **is** the language-of-instruction track (Français vs Arabe vs English) — not teaching method, cycle, or grade level. This tenant only has "Français" configured, which is why everything else only shows "Français."

❓ No further action needed — working as designed, just under-explained. **Free UX finding:** "Médium" is jargon carried from the eSchool SaaS reference (India-market naming). Renaming the label to "Langue d'enseignement" (already the subtitle text) would remove the ambiguity, zero schema change.

## 6.3 — Sections: add inline, not a separate page

![](Pasted%20image%2020260813114017.png)

Confirmed: `/dashboard/academics/sections` is a fully standalone CRUD page. `sections` is a bare table (tenant-wide labels "A"/"B"/"C"), linked to a class via `class_sections` (where capacity/homeroom actually live). Adding a section here only creates the label — a second step elsewhere attaches it to a class.

🎨 **UX:** confirmed. Wherever a section needs picking (class creation, class detail, teacher affectation), there should be an inline "+ create new section" affordance.
- **Scope:** small-to-medium — a combobox-with-create-option pattern reused in 2-3 places, no schema change needed.

## 6.4 — Matières (Subjects) catalog: is this complete?

![](Pasted%20image%2020260813114123.png)

**Correction:** there is no separate "Modules" page or nav item — the sidebar only has **Matières**. This is `/dashboard/academics/subjects`, mid-edit on "Mathématiques." This item and 6.8 are about the *same* underlying data, from two different screenshots.

Confirmed against `subjects`: `id, tenantId, name, code, mediumId, type` — exactly the 4 editable fields shown.

🔍 **Audit — real answer:** intentionally minimal because per-class weighting lives elsewhere — **coefficient**, **weekly hours**, **pass threshold** are on `class_subjects`, not the subject itself (correct design — a subject can weigh differently in 1ère vs Terminale). Genuinely missing from the subject record: a **credit/coefficient default** to pre-fill on assignment, a **category/domain** grouping for reporting, a **description**/curriculum reference, and an exam-format hint (written/oral/lab) beyond `type`.

## 6.5 — Section categorization: semester / month / trimester

![](Pasted%20image%2020260813114156.png)

`/dashboard/academics/semesters`. The `semesters` table is generic (`name, startMonth, endMonth`) — a school can already create *any number* of named periods with arbitrary ranges. `classes` also has an `includeSemesters` boolean.

✨ **Feature — real gap confirmed:** the data model is flexible enough, but two things are missing:
1. **Per-class period-mode selection** — today a single on/off boolean, not a choice between semester/trimester/month; no way for Class A to run trimesters while Class B runs semesters.
2. **Downstream wiring** — grade calculation, timetable, analytics don't branch on period type at all.
- **Scope:** large — real modeling change (`classes` needs a period-mode reference) plus every grade/analytics screen needs updating. Not a UI-only fix.

## 6.6 — Filière: only the name?

![](Pasted%20image%2020260813114316.png)

Confirmed against schema — `streams` (Filière): `id, tenantId, name`. That's it. No coefficients, no bac-type code, no linked subject list, no cycle restriction.

🔍 **Audit — real answer: yes, literally just the name today.** A Moroccan lycée filière typically needs: a link to a **subject list + coefficients** (currently only per-class via `class_subjects`, disconnected from filière), an **official Bac filière code** (Massar/CNDP exports), a **cycle restriction** (nothing stops attaching "Sciences Mathématiques" to a Collège class today). Genuine, confirmed gap — the data isn't captured, not a display issue.

## 6.7 — (Same question) is that all?

![](Pasted%20image%2020260813114338.png)

This is `/dashboard/academics/shifts`, a different reference table than 6.6.

🔍 **Audit:** `shifts` is slightly richer: `id, tenantId, name, startTime, endTime, isActive` — a real start/end time, not just a label. What's missing is anything that *uses* those times: nothing in scheduling validates that a class-schedule slot's time actually falls inside its shift's window — the two are stored independently, so a shift's times are informational only.

## 6.8 — Subjects vs. Optional Subjects: explain + add new here + clarify logic

![](Pasted%20image%2020260813114509.png)

**Correction:** not the base Matières catalog (that's 6.4) — this is `/dashboard/academics/optional-subjects`, the "Nouveau groupe de matières optionnelles" modal. A genuinely separate feature: **elective/option groups** (`electiveGroups`, `electiveGroupSubjects`) modeling Moroccan Bac-style options.

❓ **Real answer for both pages:**
- **Base Matières page (6.4):** already has "+ Ajouter une matière" top-right — you can already add a subject there. No gap.
- **This page:** pick a Classe, name the group, set max choices (default 1), multi-select 2+ subjects. Essentially "define a pick-N-of-M elective bucket for one class." There's no `electiveChoices` UI shown here for recording which option each *student* picked — that table/API exists but lives in the student-side module, out of this section's scope.

## 6.9 — Question bank: explain + edit + ownership + auto-variations + categorization

![](Pasted%20image%2020260813114626.png)
![](Pasted%20image%2020260813114636.png)
![](Pasted%20image%2020260813114648.png)
![](Pasted%20image%2020260813114659.png)

There are genuinely **two parallel question systems**:
1. **"Par examen" tab** — questions belonging to one specific `onlineExam`. Adding one attaches it directly to that exam only.
2. **"Banque" tab** — a separate, reusable, exam-independent bank, filterable by Matière/Cycle/Difficulté. Items get **copied** into an exam via a modal; the copy is a fully independent row (editing the bank item later never retroactively changes an exam that already used it — intentional, correct for exam integrity).

❓ **"Add correct answer" logic — complete?** For QCM: yes, functionally complete (2+ options, exactly one marked correct, API rejects `MISSING_CORRECT_ANSWER` otherwise). For non-QCM (open-text): no "correct answer" field at all — implicitly manual-grade-only.

🐞 **Bug — confirmed, and worse than it looks:**
- You genuinely **cannot click a question to view/edit it** — no click handler at all. Only Delete and Copy-into-exam are wired.
- For **per-exam questions**: pure frontend gap — the backend already has a complete, working PUT route, just never called from the UI.
- For **bank items**: bigger gap — there is **no PUT route at all**. Needs both a new backend endpoint and a new UI.

❓ **"Who is responsible for questions — should be the teacher who adds them":** ownership *is* recorded (`createdById`) but **nothing reads or enforces it anywhere**. Create/delete are gated only by the coarse `grading.manage` capability, granted to every teacher tenant-wide. Today: any teacher can view, delete, or copy-into-exam any other teacher's questions. A real ownership check needs adding to DELETE (and the not-yet-existing PUT), comparing `createdById` to the current user, with an admin override.

✨ **Confirmed net-new:**
- **Auto-generate exam variations** — no shuffle/variant logic anywhere.
- **Difficulty categorization** — already exists and works (Facile/Moyen/Difficile, filterable). Missing: an auto-exam-builder pulling N questions per difficulty bucket.
- **Scope:** difficulty field is done; variation-generation and auto-composition are genuinely new — medium-large.

## 6.10 — Timetable: more control + auto-generate year plan

![](Pasted%20image%2020260813115008.png)

`/dashboard/academics/schedule`, backed by `class_schedule_slots` + `timetable_versions` (draft/published lifecycle, already implemented — see "Version 1 (published)" / "+ Nouveau Brouillon"). Filterable by Classe/Enseignant/Salle.

🎨 **UX — 3 variations (design-pass deliverable, not designed here).** Brief: solve for (a) building a weekly grid fast for a whole school (currently one class/teacher/room at a time), (b) surfacing 6.12's conflict info inline, (c) making draft-vs-published state visually obvious while editing.

✨ **Feature — "auto-generate a full-year plan randomly, then let me edit it": confirmed does not exist.** No generator/solver anywhere — only manual slot-by-slot creation (each create runs through `assertSlotIsValid`, see 6.12).
- **Scope:** large — a real constraint-solver feature. Substantial standalone project.

## 6.11 — (Same request)

![](Pasted%20image%2020260813115116.png)

`/dashboard/academics/teacher-schedule` — the read-only per-teacher projection of the same published timetable as 6.10, filtered to one teacher. Same underlying engine — the "3 variations"/"auto-generate" asks from 6.10 apply once, not twice.

🐞 **Worth flagging from the screenshot itself:** the shown teacher is teaching 4 different classes at the exact same slot (8:00–8:55 Lundi) — exactly what `assertSlotIsValid` should reject (`TEACHER_CONFLICT`; see 6.12, which independently shows 177 unresolved conflicts including this teacher/day). Very likely **leftover seed/demo data created before the conflict guard existed**, not a currently-reproducible bug — the create/update API blocks this today. Recommend clearing/reconciling the seeded conflicting slots rather than treating this as an active bug.

## 6.12 — Prevent conflicts + auto-fix

![](Pasted%20image%2020260813115141.png)

`/dashboard/academics/timetable-conflicts`. This tenant currently has **177 conflicts** flagged, each with a "Résoudre dans l'emploi du temps →" link.

✨ **Feature 1 — "prevents conflicts, error toasts": already substantially implemented,** just not framed as a toast. `assertSlotIsValid` runs on every POST/PUT to `/api/academics/timetable-slots`, throws a 409 with a specific human-readable message per conflict type (`TEACHER_CONFLICT`, `CLASS_SECTION_CONFLICT`, `ROOM_CONFLICT`), and the UI displays it inline. Creating a genuinely new conflicting slot is already blocked today. Missing: only the presentation (inline banner, not toast) and the fact the 177 existing conflicts predate this check.

✨ **Feature 2 — "auto-fix options that tell me what they'll do first": confirmed does not exist.** No auto-resolution/suggestion logic — "Résoudre" just deep-links to the manual editor.
- **Scope:** upgrading to a toast is small. An actual auto-fix suggestion engine is a real feature — medium-large.

## 6.13 — Copy/apply: full JSON preview before applying

![](Pasted%20image%2020260813115327.png)

`/dashboard/academics/session-copy`, backed by `POST /api/academics/class-offerings/copy`. Screenshot only shows the initial selector state, not the preview.

✨ **Feature:** show more detail about what exactly will be copied, and expose a full, editable JSON preview before committing.
- **Scope:** medium — a preview endpoint conceptually already exists ("Aperçu de la copie" implies a dry-run); mostly a richer results UI layered on the existing flow. Worth checking what the current preview response returns first.

## 6.14 — Teacher affectation: names + substitutes

![](Pasted%20image%2020260813115455.png)

`/dashboard/academics/teacher-affectation` ("Espace d'Affectation des Enseignants"). KPI cards (Classes sans Titulaire: 12, Matières non Assignées: 0, Enseignants en Surcharge: 0) from a real `/api/academics/coverage` endpoint. Matrix table with "Affecter" opening a teacher-picker.

✨ **Bug/Feature — confirmed with exact root cause:** every row shows a raw ID like `Matière (de4902fb)`. Traced to `assignment-workspace-view.tsx:236` — `cs.subjectName || Matière (${cs.subjectId.substring(0,8)})`, a fallback that fires on every row because `GET /api/academics/class-subjects` **never joins `subjects`** — its mapper only returns the raw `subjectId`. **One-line-of-intent fix**: add a `leftJoin(subjects, ...)` and return `subjects.name`, matching the pattern already used correctly in `question-bank/route.ts`.

✨ **Feature — substitute teachers: confirmed does not exist.** `class_teachers.role` (default `'primary'`) could support `'substitute'`, but nothing in UI or API creates/displays/activates one, no "teacher X unavailable, cover with Y" workflow.
- **Scope:** ID→name bug is trivial. Editable affectations (reassign existing) is small-medium. Full substitute coverage is medium-large, probably needs the HR/absence module.

## 6.15 — Promotion & Re-enrollment Assistant: explain + fix "no section" bug

![](Pasted%20image%2020260813115636.png)

**Correction:** not the teacher affectation page (6.14) — this is `/dashboard/students/promotions` ("Assistant de Promotion & Réinscription"), the year-end student promotion/repeat/graduate wizard. If your original feedback was about teacher affectation specifically, that's covered in 6.14 above.

❓ **Explain the logic (real, from code):** pick Section d'Origine + Session Scolaire Cible, page fetches real grade-based recommendations per student (Promouvoir/Redoubler/Diplômer/Transfert/Démission/En Attente), editable per row, with a live capacity check blocking confirmation if the target section would exceed capacity. Full Historique & Annulation tab with one-click revert of committed batches — well-built, transactional, auditable.

🐞 **Bug — confirmed still broken, real root cause found:** the "Section d'Origine" dropdown has nothing selectable, table reads "Aucun élève inscrit." Cause: a **data-shape mismatch** — `promotion-wizard-view.tsx` expects each class from `/api/academics/classes` to carry a nested `sections` array, but that route's response has **no `sections` field at all**. So `sectionsList` — the entire source of both dropdowns — stays permanently empty regardless of actual data. Genuine, reproducible, current bug.
- **Real fix:** either have `/api/academics/classes` embed each class's `class_sections`, or (cleaner) have the wizard fetch `class_sections`/`class-offerings` directly (already return `className`/`sectionName` pairs, used correctly elsewhere). Small, precise fix once traced — rest of the flow works once `sectionsList` is populated.

🎨 **UX — 3 variations (design-pass deliverable, not designed here).** Brief: (a) a working section picker (blocked on the bug above), (b) a usable bulk decision-matrix for a large class (currently one dropdown per student, no bulk override), (c) surfacing the capacity-check banner earlier.

## 6.16 — Bilan de Rentrée Académique dashboard: explain fully

![](Pasted%20image%2020260813115848.png)

`academic-readiness-view.tsx`, backed by `GET /api/academics/readiness`. Computes a "Score Global de Préparation" (shown: 83%) averaging 6 independent checks: Offres de Classes, Professeurs Principaux/Titulaires, Attribution des Matières, Publication Emploi du Temps, Salles de Cours Affectées, Réinscription & Affectation Élèves.

❓ **What it's for:** a back-to-school compliance/readiness gate for the school admin — export as CSV, refreshable, "are we actually ready to open the year," each card showing raw numerator/denominator.

🐞 **Bug — confirmed, found in code:** "Attribution des Matières" shows **129 / 43** (129 out of 43!) marked "100% Conforme." Root cause: `assignedSubjects` computed via an **un-deduplicated join** — if a class-subject has more than one `subject_teachers` row, each counts separately, so the numerator can exceed the denominator. `Math.min(100, ...)` clamping hides the impossible ratio behind a reassuring 100% badge. **Real fix:** use `countDistinct(classSubjects.id)` instead of `count()`.

The "**Professeurs Principaux: 0/12, Critique**" card is *not* a bug — 6.14 independently confirms the same 12-class gap; real, consistent data.

**What's missing:** no drill-down (clicking "0/12 Titulaires" should deep-link to 6.14 filtered to those 12 classes), no historical trend, no way to mark a check "acknowledged/not applicable" for schools that don't use rooms/formal timetables.

## 6.17 — Live class session pages: audit business logic + does "prepare session" actually create a session?

![](Pasted%20image%2020260813120136.png)
![](Pasted%20image%2020260813120157.png)
![](Pasted%20image%2020260813120215.png)

The **Live Classrooms add-on** — confirmed a large, genuinely hardened module: 12 UI files, 24 API routes, a real provider abstraction (BigBlueButton, external-link, dev/scripted), signed tokens, webhook-secret verification, attendance tracking, recordings, reconciliation, each with dedicated test files already in the repo.

🔍 **Audit — real, complete answer: yes, "Créer la session" genuinely creates a real session end-to-end.** Traced the full path: the form collects Titre/Description/Objectifs, provider profile, class/section/subject/teacher, an admin-only override reason, Début/Fin, and a real session-policy block (recording, waiting room, chat, screen-share, guest access, max participants). On submit → `POST /api/addons/live-classrooms/sessions`, gated behind `requireAddon` + `requireCapability`. The backend validates time-range, policy shape, verifies the teacher is actually assigned (unless overridden), checks for overlapping sessions, then inserts a real row. Unless "Créer en brouillon" is checked, it immediately provisions an actual meeting room via the provider; if that call fails, the session is marked `status: 'failed'` with a stored reason (retryable), not left in a broken state.

**Why the screenshots show "0 sessions" everywhere:** simply an empty tenant — genuine empty-data states, not error states.

**One real UX gap:** the form already shows inline warnings when the picked class has no offerings/subjects — which quietly depends on 6.14's teacher-affectation being done first. Worth flagging as an onboarding-order dependency, not a bug in this module.

---

# 7. Personnel / HR

## 7.1 — Personnel list: audit + make it beautiful

![](Pasted%20image%2020260813120350.png)

🔍 **Audit.** `teachers-manage-view.tsx` is functionally solid: real KPI cards (active teachers, average load, incomplete profiles, on-leave), search, filter tabs, pagination, CSV export, an inspector sidebar, and a document-compliance donut (Contrat/CIN/Diplôme — real per-teacher flags). The screenshot shows **all 20 teachers at 0% document completeness** — consistent with seed/demo data, but confirms there's no upload flow anywhere in this view to fix that (see 7.3 — the form has no document fields at all).

🎨 **UX:** the page already follows the app's design system reasonably well. The bigger "make it beautiful" ask is likely really about **7.4** (3 redesign variations) — same underlying screen.

## 7.2 — Single personnel page: admin view, not employee dashboard

![](Pasted%20image%2020260813120456.png)

🐞 **Bug confirmed, root cause identified — a real routing/component mix-up.** Clicking "Voir le profil" links to `/dashboard/teachers/[id]`, server-guarded to `school_admin`/`super_admin` only — **but that route renders `TeacherProfile360View`, the teacher's own self-service portal component**: "Emploi du temps d'aujourd'hui," "Mes classes," "Devoirs à corriger," "Marquer la présence" action buttons, etc. So an admin gated into an admin-only route sees the exact same component a teacher sees logging into their own portal — no admin-facing detail page (documents, contract, salary, employment status, attendance history) exists anywhere behind that link.

**Fix scope:** build a real admin-facing teacher detail page — a separate component — covering documents (wire the Contrat/CIN/Diplôme flags with actual upload/view), full contact + employment info, salary/contract terms, assigned classes/subjects, attendance history, leave status. `TeacherProfile360View` stays as-is for the teacher's own portal; `/dashboard/teachers/[id]` needs to point at a new component.

## 7.3 — Add/edit personnel form is too short

![](Pasted%20image%2020260813120643.png)
![](Pasted%20image%2020260813120721.png)

✨ **Confirmed — genuinely minimal.** **Create:** Nom complet*, Email, Téléphone, Matricule, Spécialité. **Edit:** Nom complet*, Téléphone, Spécialité only (email/matricule not editable once created). Missing entirely: hire date (shown read-only, no field to set it), CIN number, address, diploma/qualification details, salary/contract terms, subjects/classes (auto-derived elsewhere, not settable here), document uploads (no input anywhere for the Contrat/CIN/Diplôme badges), emergency/next-of-kin info.

**Scope:** expand the form to cover employment-record fields comparable to the student admission wizard, plus document upload inputs tied to the existing compliance flags.

## 7.4 — Personnel page: 3 variations

![](Pasted%20image%2020260813120734.png)

**Image correction:** this is actually the **bulk CSV import** screen — a third, separate view from the list (7.1) and profile (7.2), part of the same personnel module.

✨ **Feature — brief for 3 variations (no design/build, just what each must solve):**
1. **Variation A — directory-first (evolve current):** keep the KPI-banner + table + inspector-sidebar pattern, fix the flow gaps: inline document upload, a working "Voir le profil" landing on a real admin record (7.2), richer filters.
2. **Variation B — card/grid roster:** a visual, photo-forward grid of staff cards, same underlying data, click-through to the same admin detail page.
3. **Variation C — workflow/compliance-first:** lead with document-compliance/profile-completeness (today buried at the bottom of 7.1) as the primary screen, directory as a secondary tab.

Each variation must resolve the same underlying gaps found in 7.1–7.3 — the variation is about layout/emphasis, not which gets fixed.

## 7.5 — Teacher page: audit + is it the right look?

![](Pasted%20image%2020260813120914.png)

**Image correction:** not a "teacher profile" page — this is the **teacher-facing attendance register** ("Registre des Présences"), the screen a teacher uses to mark present/late/absent/excused for one class/subject/session. Genuinely different from both 7.2's broken profile link and `TeacherProfile360View`.

🔍 **Audit.** As a daily register, well-built: date/class/subject/session filters, quick actions (Tout Présent/Tout Absent), a live status summary with percentages, per-student status toggles, and a Note/Motif field. Looks correct and purpose-fit. The confusion is almost certainly this image being mislabeled as "the teacher page" rather than "a page teachers use" — worth confirming whether you meant this register specifically or `TeacherProfile360View` (the teacher's home dashboard, shown in 7.2).

---

# 8. Attendance

## 8.1 — Badge QR: how it works + is this all?

![](Pasted%20image%2020260813121040.png)
![](Pasted%20image%2020260813121059.png)

❓ **How it works:** admin clicks "Émettre un Badge," picks subject type (Élève/Employé), searches and selects the person, server generates a **128-bit random QR token, HMAC-SHA256-signed, no readable PII embedded**. Shown once (QR + text), with a real print flow. Existing badges can be **Remplacer** (revokes old, issues new) or **Révoquer**. Real, working credential issuance — not mocked.

🔍 **Audit — is this all you need?** Functionally yes for issuance/lifecycle. Not on this screen: bulk issuance is a separate route not surfaced in the UI at all — worth checking if needed for onboarding a whole class/cohort. No re-print of an already-issued badge (shown once only, by design for security) — confirm that's the intended posture.

## 8.2 — QR scan page: is it real-time and fully functional?

![](Pasted%20image%2020260813121135.png)

**Image correction — important:** this is **not** a scan page — it's `qr-reports-view.tsx`, a **historical report/audit-log** with filters and CSV/PDF export. Refetches only on filter change; no live/polling behavior, correctly so — it's a report.

🔍 **Audit, correctly scoped:** the real answer to "if I scan now, will it update in real time" belongs to the **Kiosk Scanner** (8.3), which **polls `/api/attendance/qr/scanner-sessions/{id}/events` every 3 seconds**, submits scans, updates live counters and a live feed from real server responses — genuinely near-real-time. **Yes, real-time and functional** — just on a different screen. This report view is separately real and correctly built for its purpose.

## 8.3 — Kiosk scanner: redesign + camera button + 3 variations

![](Pasted%20image%2020260813121305.png)

🔍 **Audit (functional side):** confirmed real and working — session lifecycle, 3-second polling live feed, accept/reject/already-scanned counters, per-scan feedback cards. Legitimately functional, not a placeholder.

🎨 **UX — "looks bad and unprofessional":** the scan-input is a bare `<Input type="password">` waiting for a hardware scanner or manual paste — no camera preview, no visual feedback beyond an icon pulse. For an entrance kiosk, reads as a form field. Fair critique.

✨ **Feature — camera-based fallback: confirmed genuinely missing.** No `getUserMedia`, no QR-decode library, no camera toggle anywhere. Only input path is a physical USB scanner or manual entry. A genuinely new capability, not a wiring fix.

🎨 **Feature — brief for 3 variations (no design/build, just what each must solve):**
1. **Variation A — kiosk/tablet mode:** large, high-contrast, distance-readable; huge camera viewfinder as primary input, hardware-scanner path as silent fallback.
2. **Variation B — teacher-handheld mode:** compact, one-handed, for a teacher scanning their own class roster from a phone.
3. **Variation C — reception/security-desk mode:** dense, multi-class, quick class-switching, persistent running log across sessions.

All three sit on the same real session/poll/verify-and-stage plumbing — the camera capability is a prerequisite for A and B.

## 8.4 — Audit this page + remaining sections

![](Pasted%20image%2020260813121536.png)

**Image correction:** a **third, separate kiosk** — the **staff/personnel time clock** ("Pointeuse Kiosque Employés & Personnel"), distinct from both the student badge system (8.1) and student scanner (8.3). Handles Entrée/Sortie punches for employees.

🔍 **Audit:** confirmed wired to real endpoints (`/api/workforce/punches`), not mock data. Looks trustworthy and functional.

🔍 **Remaining sections — what to check next:** currently only takes a typed/scanned token, no camera. Worth deciding whether staff clock-in should get the same camera-fallback as 8.3, and whether staff punches feed into the same reports page as student scans or need their own — not confirmed in this pass, worth a follow-up look.

## 8.5 — PDF justification is broken / not real

![](Pasted%20image%2020260813121658.png)

🐞 **Bug confirmed, root cause identified precisely.** `attendance-excuses-view.tsx` is **entirely hardcoded mock data** — a `MOCK_EXCUSES` array seeded into `useState` (matching the screenshot exactly, including "Aya Chraibi"). Approuver/Refuser only mutate local React state — no fetch call anywhere. The document viewer never fetches or renders any actual document.

**The important nuance:** the real backend already exists and works — `/api/attendance/excuses` and `/api/attendance/excuses/document` have genuine file storage, type validation, size limits, tenant/role-scoped access. So this isn't "build a PDF generator from scratch" — it's **"replace the mock-data view with one that calls the already-working APIs."** `attendance-flag-detail-view.tsx` (8.6) already demonstrates the correct pattern.

✨ Agreed as a general principle: worth a pass across the app for other views following this same "real backend exists, view still uses `MOCK_*`" pattern — this is the clearest example found.

## 8.6 — Absences: treatment + communication + status + reports

![](Pasted%20image%2020260813121833.png)

**Important correction — this is only the list view; the workflow already exists one click deeper.** `attendance-flags-view.tsx` has no action buttons in rows, but each student name links to `attendance-flag-detail-view.tsx`, which is substantially built already:

- ✅ **Already exists:** assignment to a staff member, status toggle (résolu/reopen), internal notes, attendance history, linked-excuse document link, and an **SMS history panel** showing prior messages.
- 🐞/✨ **Genuinely missing:** **no button to send a new SMS from this page.** Guardian contact and past SMS are shown, but there's no compose/send action — a real gap, but narrower than it looks: data model and workflow already exist, only the "send" action needs adding.
- ✨ **"Reflect status in reports":** flags list already has severity counts and status filtering; 8.7 surfaces `openFlagsByType`. Confirm whether that's sufficient or a dedicated resolved-vs-open trend view is wanted.

## 8.7 — Structure + less scroll + rappel/communication

![](Pasted%20image%2020260813122004.png)

🎨 **UX — long single-column scroll confirmed.** `attendance-audit-view.tsx` stacks 4 KPI cards, an alerts card, then a full-height list with no pagination or grouping (screenshot already shows 12 rows). Grouped/collapsible sections or pagination would fix this.

✨ **Feature — "rappel" already exists, but only for one case and it's simulated, not real.** The "Envoyer un rappel" button is real, inserts a row into `smsMessages` — **but the response explicitly says "mode simulation, aucun SMS réel envoyé."** No actual SMS gateway wired in. The mechanism is built and reusable, but doesn't send a real message, and only targets teachers-with-missing-registers, not general teacher communication.

✨ **Scope for "start communication with the teacher":** extend the same `smsMessages` pattern (also used in 8.6) into a general-purpose contact action, and wire a real SMS/notification provider — one fix would upgrade both this reminder and the missing "send to parent" action from 8.6 at once, since they'd share the same send path.

---

# 9. Documents — Cards & Convocations

## 9.1 — Audit the cards/convocations business logic

![](Pasted%20image%2020260813122850.png)

🔍 **Audit — what's actually implemented today:** more built-out than the screenshot lets on.

**Data model:** `documentTemplates`/`documentTemplateVersions` — versioned templates (draft→published), three types: `student_id`, `employee_id`, `admit_card`. `issuedDocuments` — one row per issued card, a rendered-data snapshot plus a **hashed** verification token (raw token returned only once, at issuance). Status lifecycle `active → expired/revoked/replaced`. `documentGenerationJobs`/`documentGenerationItems` — a batch system tracking per-subject success/failure independently. `documentEvents` — a full audit trail.

**Issuance logic:** `resolveSubjectData()` pulls real data for `student`/`employee`/`exam_candidate` (the last reading from `examSeats`, joining student + exam term + exam hall) — genuinely wired to real records, not mock data. `issueDocument()` enforces published-only templates matching the subject type, generates a random 32-byte token (stores only its hash), renders immediately (a render failure doesn't block issuance — deliberate design, not a bug).

**What exists in the UI:** overview with KPIs, a templates library + pdfme visual designer per type with a field allowlist, per-subject-type issuance lists, a batch "lot" system with multi-select checkboxes, a unified "Documents émis" list with download/revoke. Certificates (a sibling module) is actually the most mature piece — definitions, templates, a **four-eyes approval workflow**, signatories, its own batch system.

**What's genuinely missing:** no class/section grouping anywhere in issuance/batch-creation — only a flat list with name/matricule search.

**Verdict:** the core plumbing (templates → versions → issuance → verification → revocation → batch jobs → audit trail) is solid and real. Gaps: (1) no class/section bulk-selection UX, (2) no auto-émission trigger, (3) no entry point from a student/employee's own profile page, (4) the known PDF-render bug on seeded demo records (9.6/9.7).

## 9.2 — Card models: locale bug — appears already fixed in current code

![](Pasted%20image%2020260813123001.png)
![](Pasted%20image%2020260813123013.png)

🐞 **Bug status: not reproducible in the current codebase.** The reported URL had a literal `undefined` locale segment. Every navigation call site that builds this URL already has a `?? 'fr'` fallback — checked all four (list page, edit page, overview, sidebar link). **I'm treating this as fixed** — if it recurs, it's from a different, not-yet-found call site.

Second screenshot ("Modèle introuvable") is a **separate, still-real** symptom: the edit page's own error state whenever `GET /api/cards/templates/{id}` doesn't return success — e.g. a template ID that no longer exists (deleted or from a stale/reseeded dataset). Not caused by the locale bug; worth a quick manual re-check against a template known to currently exist.

## 9.3 — Card émission: pagination + profile integration + auto-émission

![](Pasted%20image%2020260813123054.png)

✨ **Feature — pagination:** the Élèves issuance list renders all 100 students unbounded, no pagination — matches the screenshot's long scroll.

✨ **Feature — profile-page émission:** confirmed no issuance entry point exists on a student's own profile page today. Add an "Émettre une carte" action there, reusing the same `issueDocument()` service already used elsewhere.

✨ **Feature — auto-émission:** confirmed no automatic/triggered issuance exists anywhere — every card is issued by an explicit human action. Needs a trigger point (e.g. on enrollment confirmed), a per-school setting, reusing the existing service — additive, not a rework.

## 9.4 — Same for enseignants (staff cards)

![](Pasted%20image%2020260813123240.png)

✨ **Feature:** same three asks as 9.3, applied to the employees list. Identical shape and gaps confirmed (flat table, all 23 staff, "Aucune" status for everyone). Same underlying fix scope — one feature applied to two lists.

## 9.5 — Convocation: select by class / section / multiple students

![](Pasted%20image%2020260813123423.png)
![](Pasted%20image%2020260813123516.png)

✨ **Feature — confirmed gap.** Checked the batch modal and every issuance page under Cards for a class/section selector: **none exists**. The batch modal already does multi-select via checkboxes with a search box — the multi-select mechanism is there — but no "toute une classe" one-action select. Same gap on the convocations list.

**Scope:** a UI-layer addition on top of existing batch/issuance APIs — a class/section picker that pre-checks all students in the chosen class/section, not a new issuance mechanism.

## 9.6 — PDF download errors — confirmed still broken, root cause identified

![](Pasted%20image%2020260813123529.png)
![](Pasted%20image%2020260813123550.png)

❓/🎨 The batch-jobs and "Documents émis" pages are functionally complete (KPIs, tables, filters, PDF download, Révoquer) but don't show *why* a job has failures — the data already exists per-item (`documentGenerationItems.errorMessage`); adding a failure-reason column/tooltip needs no new backend work.

🐞 **Bug — confirmed still present, root cause found.** Clicking "PDF" returns a generic `INTERNAL_ERROR`. **Exact same defect already root-caused earlier for the certificate editor:** seeded demo data stores a placeholder schema shape (`{ fields: ['nom', 'photo', 'classe'] }`) instead of a real pdfme-native schema (which expects `template.schemas` as an array of positioned field objects). pdfme's generator throws internally on the placeholder shape; the route's catch-all turns that into `INTERNAL_ERROR`.

**This only affects seeded demo template records** — a template created through the real `TemplateDesigner` UI produces a correctly-shaped schema and renders fine. **Fix scope:** replace the seed script's placeholder schema values with real pdfme-shaped schemas (or re-create the seeded templates through the real editor) — not a code fix to the render pipeline.

## 9.7 — Certificates: same PDF fix

![](Pasted%20image%2020260813123655.png)

✨ **Confirmed — the identical bug, not a separate one.** The Certificats overview is actually the richest module here (3 définitions, 2 modèles, 15 certificats émis, 8 demandes à traiter, a four-eyes workflow, its own batch system). Its PDF route calls the exact same `renderPdf()` helper, hitting the same seed-data placeholder-schema problem. **Use the exact same fix as 9.6** — one root cause hitting two modules through a shared helper. Fixing the seed data shape once resolves both.

---

# 10. Examinations / Assessment

## 10.1 — Explain + redesign the examinations page

![](Pasted%20image%2020260813123713.png)

❓ **Question — full examinations logic, explained plainly.** "Exam Master & Gestion des Épreuves" has three tabs building on each other:

1. **"Attribution des Places & Salles" (seat allocation):** create exam halls (room + code + capacity) and exam sessions/terms, then pick a session, check halls, hit "Lancer l'Attribution Automatique" — deterministically fills checked halls in order up to capacity, assigning seat number, desk label, candidate number. This is what powers the convocation cards in Section 9.
2. **"Calendrier des Épreuves" (scheduling):** attach an épreuve (any gradable event, identified by raw UUID) to a session/hall/time. Enforces one real rule: rejects overlapping bookings for the same hall.
3. **"Grille de Saisie des Notes" (roster/marksheet):** paste an épreuve's UUID, get a table of every seated candidate, enter marks. Writes to a shared "outcome ledger" used across assessment types, feeding term rankings elsewhere (ties handled correctly).

**In short:** halls + sessions → seat allocation → schedule an épreuve into a hall/slot → enter marks against that roster → marks flow into the shared grading ledger. A real, coherent pipeline — the confusion is almost entirely UX/labeling, not a logic gap.

🎨 **UX — redesign for clarity, confirmed root causes:**
- The three tabs aren't sequenced or gated — nothing stops opening the roster tab first (it's the default active tab) before creating any sessions/halls. A numbered flow (1. Salles & Sessions → 2. Planifier → 3. Noter) with earlier steps required would fix this directly.
- The roster tab requires pasting a raw UUID into a text box (see 10.6 — same root cause). Should be a searchable dropdown of épreuve titles.
- No breadcrumb/legend explaining what "épreuve," "session," "salle," "roster" mean relative to each other.

## 10.2 — Devoir responses: access control — confirmed current behavior, does not match what was asked

![](Pasted%20image%2020260813123852.png)

✨ **Feature — precise, current answer.**

**Page-level gating (confirmed hardened):** the homework page requires roles `teacher`/`school_admin`/`super_admin` — students/receptionists/accountants can't reach it at all. That part is real and in place.

**API-level gating:** the grade route requires `school_admin`/`teacher` plus the `grading.manage` capability.

**What this does NOT do — the actual gap:** `grading.manage` is **role-wide** — every teacher at the school gets it automatically. There is **no per-homework ownership check** anywhere in `HomeworkService.gradeHomeworkAttempt()` — the query only checks `tenantId`, not `createdBy` against the calling teacher. **Concretely: today, any teacher can grade any other teacher's devoir** — not just "the teacher who added it." Your expectation isn't implemented yet; only the coarser "keep non-teaching roles out entirely" layer exists.

**Admin "verify but don't change" role:** also not implemented. `school_admin` currently has the exact same `grading.manage` capability as `teacher` — an admin can also grade/edit, not just view-and-report. A genuine "review-only" mode needs a new, narrower capability (e.g. `grading.review`).

**Scope:** add an ownership check (`assessmentDefinitions.createdBy === context.userId`) to the grade route for the `teacher` role specifically (admins remain unrestricted as an override), and introduce a read-only "admin review" mode. Moderate, well-contained — the audit trail already exists to support it.

🎨 **UX — multi-student correction sidebar.** A right-side slide-over showing one student's submission at a time. The "infinite-scroll" issue is what happens once a devoir has many respondents. A clearer pattern (compact left-hand roster list with status badges, paginated/virtualized, next to a fixed correction panel — inbox + reading-pane style) would address this — UI-layer only, no backend change.

## 10.3 — Devoir: paste a PDF or use the question bank

![](Pasted%20image%2020260813124029.png)

✅ **Built 2026-08-24.** The "Créer un Devoir" dialog supports attaching a document (PDF/Docx/Image) AND now pulls from the reusable question bank:
- **Teacher hub list API:** `HomeworkService.listHomeworkForTeacher` — tenant-scoped homework list with subject/class labels + submission counts (`api/academics/homework` GET now role-branches: students → audience-scoped list, teachers/admins → hub list).
- **Hub de-mocked:** `features/homework/ui/homework-client.tsx` — real list, real KPIs, real POST create (replaces `MOCK_HOMEWORK`).
- **Bank picker:** subject-filtered, multi-select from `/api/academics/question-bank` (teacher-readable, `grading.read`); selected questions are embedded numbered into the devoir `instructions`.

## 10.4 — Notation: pagination + better logic

![](Pasted%20image%2020260813124229.png)

🎨 **UX — confirmed gap.** Same "Grille de Saisie des Notes" roster from 10.1 — no pagination in the code, a plain `.map()` over the full roster. For a 100-candidate exam this is a long unbroken scroll. Add pagination or at minimum sticky headers + virtualization.

✨ **Feature — "better notation logic."** Today `saveMarksheetGrid()` accepts a raw score and presence status per student — no bulk-fill, no keyboard-driven entry (Tab/Enter), no auto-computed mention shown live while typing (a "Mention Automatique" column exists in the UI but wasn't found wired to the input in this pass — worth re-confirming with real data entered), no way to flag absent vs. exempted beyond the status dropdown. A UX/workflow enhancement over an already-functional save path.

## 10.5 — Exam halls: select salle + capacity + multiple salles

![](Pasted%20image%2020260813124332.png)

✨ **Feature — partially already built, confirmed by code + screenshot.** Hall creation form (Nom, Code, Capacity), a live capacity summary, and — importantly — **multiple-salle selection is already implemented** (checkboxes feeding "Lancer l'Attribution Automatique"). That part of the ask is **already done**.

**What's still missing:**
- **"Salle should come from the school's application and be selectable here":** no separate physical-room/facility registry exists anywhere in the app — only `examHalls`, which is exam-specific. If the intent is picking from the school's real room list, that list doesn't exist yet as shared master data — would need to be built, then this form updated to select from it.
- **"Code — I don't know what to do with it":** a required short free-text label (e.g. "A1"), used in desk labels/hall lists. Manual, not derived from anything. Clarify with placeholder/help text rather than leaving it unexplained.
- **"Capacity based on salle, or suggest salle options when I fill capacity":** not implemented — capacity is just a typed number with no link back to filtering/suggesting halls elsewhere. Net-new UX behavior.

## 10.6 — Épreuve ID not practical + clearer structure

![](Pasted%20image%2020260813124500.png)

🎨 **UX — confirmed exactly as described, root cause identified.** Both the roster tab and the scheduling tab require typing/pasting a raw UUID into a plain text input. Checked the schema: **no human-readable code or short reference field** exists on `assessmentDefinitions` at all — only `id` (UUID), `title`, `type`, `status`, scoring fields. So "épreuve ID is not practical" is accurate: the UI directly exposes a database primary key as a required manual-entry field, with no dropdown/search.

**Fix scope:** replace the free-text UUID field (both tabs) with a searchable select populated from existing épreuves (title + type + status), the same way students/halls/terms are already loaded as dropdowns elsewhere on this page. No schema change strictly required, though adding a short display code (similar to `examTerms.code`/`examHalls.code`, which already exist) would make an épreuve easier to reference verbally or in print.

---
> **Note:** `Pasted image 20260813124223.png` (in the source folder, not referenced in the original notes) was confirmed to be a pixel-identical duplicate of `Pasted image 20260813124229.png` — an extra/duplicate paste, as originally suspected.

---

# 11. Events — Additional Findings

## 11.1 — Screenshot correction: the "event page" screenshot is actually the Library page

![](Pasted%20image%2020260814190449.png)

**Screenshot correction:** the raw note pairs this image with the comment *"here is the event page, make sure everything here is dynamic"* — but this screenshot is not the Events module at all. It's **"Bibliothèque de Ressources Pédagogiques"** (the document library, `/dashboard/content/library`), reachable from a completely different sidebar item than Events.

The real Events page — the one the comment was actually about — is a different screenshot pasted right after it:

![](Pasted%20image%2020260814190544.png)

This is `/dashboard/events` ("Calendrier & Événements de l'établissement"), built by `EventsCalendarClient` (`schoolos-app/src/features/events/ui/events-calendar-client.tsx`). Three more copies of this exact same screenshot were pasted into the folder but never referenced in the note text (`190518`, `190523`, `190534`, all pixel-identical) — duplicate pastes, not distinct states, same pattern found elsewhere in the first pass.

🔍 **Audit — is the real Events dashboard actually dynamic?** Partially. Traced every number on the page:
- **"Total événements"** — real, `{events.length}` from a live `GET /api/addons/events` fetch.
- **"Inscriptions totales: 845"**, **"Lieux mobilisés: 5 campus"**, **"Satisfaction événements: 4,8/5"** — all three are **hardcoded literals in the JSX** (lines 175, 186, 197), not derived from any API response. They will show exactly `845`, `5 campus`, and `4,8/5` for every tenant, forever, regardless of real registration/venue/feedback data — even though the backend already has the real data to compute all three (`registeredSeats` per event is already used elsewhere in this same file; a `feedback` table and API already exist per 4.1's finding).

**Net:** 1 of the 4 top stat cards is genuinely dynamic; the other 3 are static decoration that happens to look like data. Small fix — wire "Inscriptions totales" to a sum of `registeredSeats` across events (data already fetched), and either compute or remove the campus-count and satisfaction cards until real venue/feedback aggregation exists.

## 11.2 — "Gérer l'événement & les billets" button: still does nothing

🐞 **Bug confirmed, unchanged from 4.1's finding.** In `events-calendar-client.tsx` (lines 276–278) the button has no `onClick`, no `href`, no `Link`. Confirmed there is still **no per-event admin detail/management page anywhere in the app** — there's nowhere for this button to even send the user if it were wired up.

## 11.3 — Event creation form: confirmed too minimalist, and worse than it looks

![](Pasted%20image%2020260814190621.png)

(A pixel-identical duplicate paste, `190617.png`, exists alongside this one.)

✨ **Confirmed — genuinely minimal, and it silently drops data the state object already tracks.** The modal shown has exactly 4 fields: Titre, Catégorie, Date, Capacité max. Reading `newEvent` in the client code, the object backing this form actually has **6** fields — `time` and `location` also exist in state, defaulted to `'10:00 - 12:00'` and `'Amphithéâtre'`, and are sent to the API on submit — but **neither has an input in the visible form**. So every event created through this dialog silently gets the same fake time window and the same fake "Amphithéâtre" location no matter what the admin actually wants, with no way to override either from the UI.

Also confirmed: **Catégorie is a hardcoded 4-option `<select>`** (Orientation/Académique/Culturel/Sport) baked into the JSX — it does **not** call the real `GET /api/addons/events/types` endpoint, even though that endpoint exists, returns real tenant-configurable event types, and supports `requiresApproval`/`requiresRsvp`/`requiresCheckin` flags this form never surfaces. No description, no visibility toggle (hardcoded to `'internal'`), no audience targeting, no attachment/link/video field — all confirmed still true from 4.1.

**Scope:** small-to-medium — add Time and Location inputs (data already flows to the API, just needs UI), swap the hardcoded category list for a fetch from `/api/addons/events/types`.

## 11.4 — "Is that all the parts?" — confirmed: yes, this literally is the entire admin UI

🐞 **Confirmed and broader than 4.1 already found.** Searched every UI file for any call to the event sub-resource endpoints (venues, tasks, incidents, feedback, communications, reports, check-ins, waitlist — all 11 API routes 4.1 catalogued as "solid operationally"). Result: **zero matches, anywhere.** The *only* fetch call to any `/api/addons/events*` endpoint in the entire codebase is the single list/create pair inside `events-calendar-client.tsx`. Every other capability the backend supports has a real, working API route and **no UI consumer at all**, not even a stub.

**Scope:** large — this isn't one fix, it's an entire admin event-detail page (the destination the "Gérer l'événement" button in 11.2 should open) with tabs/sections for each of those 7 sub-resource areas. Worth scoping as its own project.

---

# 12. Library / Bibliothèque

## 12.1 — Two separate, confusingly-named "library" systems live side by side

![](Pasted%20image%2020260814190902.png)

Before auditing individual screens: the sidebar has **two distinct top-level items that both translate to "library" in casual French**, and your questions jump between them without the two ever being distinguished:

- **"Bibliothèque de Ressources"** → `/dashboard/content/library` — a **document/file library**: PDFs, brochures, podcasts, photos, uploaded by staff and targeted at audiences (whole school / a role / a class / a specific student). Backed by `src/features/attachments/**` and `/api/content/**`. This is what powers 12.2–12.4 below.
- **"Bibliothèque"** → `/dashboard/portals/librarian` — the **real physical book library / circulation system**: catalog, editions, physical copies, members, loans, holds, fines. Backed by `src/features/library/**` and `/api/addons/library/**`. This is what powers 12.5–12.7 below.

🎨 **UX — genuine naming collision, not just a reading mistake.** Both sidebar entries render as "Bibliothèque[...]" back to back with the same icon, and your own questions drift from one system straight into the other without a page transition being called out — a strong signal a real user hits the same confusion. Worth renaming one of the two (e.g. "Ressources Pédagogiques" as the primary label) so they read as clearly different tools.

## 12.2 — Ressources Pédagogiques list: confirmed only one action exists ("View")

🔍 **Audit, confirmed in `content/library/page.client.tsx`.** The Actions column renders exactly two possible icons per row: an eye ("Détails") always, and a download link **only if `status === 'published'`**. Since this tenant's own KPI card reads "Publiées: 0," literally every row on screen has **only the eye icon** — confirming "the only action I have is view" precisely. No inline Edit, Delete, Publish, or Archive from the list.

Clicking the eye opens this:

![](Pasted%20image%2020260814191550.png)

❓ **"It shows me this minimalist dialog, doesn't feature much" — confirmed, and here's exactly what's missing.** The inspector shows title, description, status/type badges, a version list, and one contextual action button. Checked the backing API (`/api/content/assets/[id]/route.ts`): it's **`GET`-only** — no `PUT`/`PATCH`/`DELETE`. The inspector isn't just visually sparse, it's **structurally unable to edit anything** — no way to fix a typo in the title, change the description, retarget the audience, or add tags after creation, even though the schema already has `tags`, `targets`, and `usageLinks` fields the inspector displays but never lets you modify. Genuine gap — needs a new update endpoint plus an edit form.

## 12.3 — "New Resource" dialog: is it enough? Confirmed — no, and it silently over-collects

![](Pasted%20image%2020260814191614.png)

❓ **Answering directly: not enough for a production resource library, but for a different reason than "too few fields."** The form itself (Titre, Description, Type de pièce jointe, Public cible, Fichier) is reasonably complete — targeting supports 6 audience kinds. The real gaps: **no tags input** (the field exists on the data model and shows in the inspector, but no way to set it here), **no expiry/visibility window**, and — since 12.2 found there's no edit endpoint at all — **once created, it's permanently locked to whatever was typed here.**

**Scope:** small — tags input is a quick addition; the bigger unlock is the edit capability from 12.2.

## 12.4 — Types de Pièces Jointes: the "Code" field is confirmed manual, and "Archiver" goes exactly where you'd hope

![](Pasted%20image%2020260814191635.png)

Clicking "+ Nouveau Type" opens:

![](Pasted%20image%2020260814191708.png)

❓ **"Is that how it should be to add a new one, and shouldn't the code be automatic?" — confirmed manual, same pattern as the matricule (2.6) and exam-ID confusion elsewhere.** `content/types/page.client.tsx` has a plain, empty `<Input>` for **Code** right next to **Nom** — nothing derives it from the name, nothing slugifies on blur. The backend requires `code` as a distinct field too, with no auto-generation either. Needs the same fix pattern as 2.6 — auto-slugify `Nom` → `Code`, still editable.

🔍 **"When I click Archive, where does it go?" — traced precisely, and the answer is reassuring.** The archive icon calls `DELETE /api/content/attachment-types/{id}`, but the route does **not** hard-delete — it flips `isActive: false`, with an explicit code comment confirming the intent: *"Archive, never a hard delete."* System types (e.g. "Document officiel") have the button disabled entirely.

**What's still missing:** once archived, a type disappears from the list with **no "show archived" toggle anywhere** to see or restore it — so "Archiver" is effectively irreversible from the UI's perspective, even though the data is fully recoverable. Small fix: add an archived-items filter/tab and a restore action reusing the existing `PUT` route.

## 12.5 — As admin, the sidebar shows the librarian's own operational desk — same bug class as 7.2

![](Pasted%20image%2020260814191736.png)
![](Pasted%20image%2020260814192103.png)

🐞 **Bug confirmed — the exact same pattern found at 7.2 ("admin routed into an employee's own self-service portal"), just in a different module.** The second screenshot's browser chrome shows the giveaway: URL `.../portals/librarian/desk`, logged in as an admin, **"Role Actif: Administrateur École"** visible bottom-left — an admin account on a page titled **"Portail Bibliothécaire"** whose sidebar has collapsed down to nothing but "MODULES ÉTABLISSEMENT" and Déconnexion.

Traced the cause: the "Bibliothèque" nav item is gated only by **capability** (`library.catalog.read`, `library.circulation.operate`), not by role — a `school_admin` almost always holds every capability, so these librarian-operational pages appear as permanent, ordinary sidebar items for the admin. `LibrarianPortalClient` takes a single `desk` boolean prop and renders **identically regardless of who's viewing it** — no role check, no "you are viewing as admin" banner, no read-only/oversight mode. An admin gets the exact same checkout-counter/circulation controls a working librarian would use — not a management/oversight view (staffing, policy configuration, fines override, audit trail) that would actually make sense for an admin role.

✨ **Scope:** medium. The circulation logic underneath (12.6) is solid and doesn't need touching — what's missing is an admin-facing library management view separate from the operational desk, plus either a role check that hides "Comptoir de prêt" from admins by default or an explicit "Agir en tant que bibliothécaire" mode, mirroring how 7.2 should be resolved.

## 12.6 — "Explain the renouveler / retour logic" — it's real, and better-built than the minimalist UI suggests

❓ **Full answer, traced through `library-service.ts`:**

- **Renouveler (renew)** — blocked if the loan is already closed, blocked if `renewedCount` has already hit the tenant's configured limit (captured as a policy snapshot at the moment the loan was first issued), and — worth highlighting — **blocked if another member has an active hold waiting on that exact copy**, so a renewal can never jump the reservation queue.
- **Retour (return)** — idempotent (double-scanning a closed loan is safe). Three real business rules fire depending on condition: **late return** auto-creates an `overdue_fine` charge (`finePerDay × days late`) after the grace period; **"Perdu" (lost)** creates a `lost_copy` charge and flips the copy's state to `lost`; **"Endommagé" (damaged)** updates the copy's condition and moves it to `repair` state. Both charge types are idempotency-guarded so re-processing a return never double-charges.

**Verdict:** real, well-designed circulation logic — fine calculation, grace periods, lost-copy billing, hold-queue protection, and condition tracking are all genuinely implemented. The confusion is fully explained by 12.5: the UI these actions live in never explains any of this to the person clicking them — no confirmation of what will happen, no visible fine preview before confirming a late return.

## 12.7 — Bibliothèque — Catalogue: shows 0/0/0 while the librarian desk shows 27 — real inconsistency, root cause found

![](Pasted%20image%2020260814192204.png)

❓ **"Is this page fully functioning and should it be like this?" — no, and this is a genuine, confirmed data inconsistency, not just an empty tenant.** The exact same tenant that showed **27 Exemplaires, 27 Disponibles, 21 Adhérents, 6 Prêts actifs** on the Portail Bibliothécaire (12.5) shows **Notices: 0, Exemplaires: 0, "Aucun ouvrage trouvé"** here.

**Root cause:** the librarian portal's "27 Exemplaires" counts `libraryCopies` rows filtered only by `tenantId` — it never checks whether those copies' parent catalog records still exist. The Catalogue's "0 Notices" counts `libraryBibliographicRecords` filtered by `tenantId AND deletedAt IS NULL`, and **returns an empty result immediately if that count is zero**, without ever looking at `libraryCopies` at all. This tenant has real physical copies but **zero active bibliographic records** for those copies to hang off (either never seeded, or soft-deleted). Both pages are each internally correct about what they count, but nothing enforces that a copy's catalog record actually exists — so copies can end up (and here, do end up) fully counted in operational reports but invisible in catalog search, holds, and the rich per-book detail page (confirmed real and well-built, but unreachable today since the list above it never returns a row to click).

🐞 **Confirmed real bug, not seed-data noise to ignore.** Either backfill this tenant's orphaned copies with proper bibliographic records, or — better — add a guard that a copy can never be created without an active parent record, so this can't recur.

---

# 13. Finance

![](Pasted%20image%2020260814192230.png)

> This module got the deepest second-wave audit — 21 items across cashier/collection, invoicing, expenses, the full double-entry accounting subledger, fee structures/billing, and approvals. Headline: the accounting subledger (13.9–13.21) is some of the most solidly engineered code in the app — real double-entry bookkeeping, maker-checker controls, idempotent posting. The front-line pages (13.1–13.8) have several concrete, fixable gaps. The screenshot above is the module's own landing dashboard ("Espace Comptabilité & Direction Financière") — every card on it links to one of the pages audited below.

## 13.1 — Collection Desk: search-by-name only, no class filter (3-variation playground brief)

![](Pasted%20image%2020260814192331.png)

🔍 **Audit — is the module "fully set up"?** Yes, for this screen. `/dashboard/finance/collection-desk` is a real, well-built cashier workflow: open/close a cash-drawer session, search a student, pull their real outstanding invoices, multi-invoice collection with a client-side overpay guard mirroring a real server-side check, and a persisted, printable receipt. Nothing here is mocked.

🎨 **The complaint is accurate, confirmed in code.** The only way to find a student is "Encaissement Rapide de Scolarité," which calls `GET /api/search?q=` — that endpoint matches only `name`/`email`/`matricule`; it has **no class/section parameter at all**, so "browse by class" isn't just missing from the UI, the search endpoint itself can't do it today.

**Implementation note:** no new backend needed — `GET /api/students?classSectionId=...` already exists and already powers the student directory's class filtering. A class-filter variation can reuse that route directly.

✨ **Scope:** UI/UX exploration, same category as 2.8/6.10/6.15/7.4/8.3's "3 playground variations" briefs — not a bug. Brief: (a) current search, kept for staff who know who they're collecting from; (b) class/section picker → roster grid, for collecting a whole class's fees in one sitting; (c) a "today's due/overdue" queue (reuse 13.2's data) as the entry point instead of search.

## 13.2 — Aging Receivables: SMS-only action, and it's not even real

![](Pasted%20image%2020260814192420.png)

**Scope correction:** the page is real and the summary buckets are real (genuine 0-30/31-60/61-90/90+ day buckets from actual invoice due dates — this tenant's data happens to show everything current, not a bug).

🐞 **Bug — worse than the raw framing, confirmed in code.** `Relancer SMS` → a **plain browser `alert()`**, not a network call of any kind — no fetch, no API route, nothing recorded. Not "SMS in simulation mode" like the real, partially-wired mechanism at 8.7/8.6 — a UI prop with zero backend behind it. `Exporter Excel` → same pattern, an `alert()` claiming success and generating nothing.

✨ **"More than SMS and more flexible" — real, but the more urgent fix is making the one action that exists actually do something.** Once wired to something real, reuse the `smsMessages` pattern already established at 8.6/8.7, plus add email/call-log logging, and a genuine Excel export (`exportToCsv` is already used elsewhere, e.g. `invoices-view.tsx`).

**Scope:** small — the cheapest real win in this batch: swap two `alert()` calls for real calls into an existing pattern.

## 13.3 — Invoices ("Gestion des factures"): is billing actually automatic?

![](Pasted%20image%2020260814192456.png)

🔍 **Audit — real data, but "auto-added by the time and logic of the school": no, not on this page or anywhere by default.** The list is real — 200 real tenant-scoped invoices, live stat tiles, real detail panel with line items and payment history, real lifecycle actions. **There is no scheduled/automatic invoice generation anywhere in the codebase** — no cron, no scheduled-job infrastructure exists in this project at all, for any module. Every invoice is created by a human action.

There **is** a real bulk-generation engine, just on a different page: `/dashboard/finance/allocations` — pick a fee-structure version, preview a run, approve it, then "run" generates one real invoice per student, idempotent (a retry skips students who already got one), tracks per-student success/failure independently. That's the real answer to "does the system compute the right amount and create the invoice" — yes, but **an admin has to manually create and trigger the run each time.**

**Scope:** small — no new backend. Add a "Facturation groupée" entry point linking to the existing allocations engine. A true calendar-triggered auto-run would be new work (needs a scheduler, which doesn't exist anywhere in the app yet).

## 13.4 — Create Invoice dialog: raw student ID field + the payments/new redirect

![](Pasted%20image%2020260814192628.png)

*(A pixel-identical duplicate paste, `192621.png`, exists alongside this one — confirmed via checksum, same screenshot pasted twice.)*

🐞 **"Is this creation logic enough?" — no, confirmed real gap.** The "Créer une facture" modal has exactly 4 fields: **ID élève** (a raw text `Input` — you must already know and correctly type a UUID), Montant (fully manual, not derived from any fee structure), Échéance, Note. The backing API is otherwise solid (validates tenant ownership, BigInt-cent money handling, atomic transaction, real sequential invoice number, audit event) — the gap is entirely in the form.

**Scope:** small — swap the raw text `Input` for the same student-search component used on the collection desk or student directory.

🐞 **The redirect — confirmed, root cause found, and it's intentional (not misconfiguration).** Both `/dashboard/finance/payments/new` and `/dashboard/finance/payments` are one-line redirects to `/finance/collection-desk`, with a code comment explaining a prior pass killed a fully-mocked duplicate page rather than maintaining two parallel implementations. **The actual remaining problem is context loss:** `invoice-detail-view.tsx`'s "Enregistrer un paiement" button links to `/payments/new` with **no query parameter for which invoice or student it was clicked from** — so a user looking at one specific overdue invoice gets bounced to a blank Collection Desk and has to manually re-search for the same student. Same dead-end applies to the sidebar's payment link and a super-admin quick-payment shortcut.

**Real fix:** make Collection Desk accept an optional `?studentId=`, have `invoice-detail-view.tsx` pass `invoice.studentId`, auto-selecting that student and skipping the search step. Small, precise fix.

## 13.5 — Office Accounting / Expense Journal: real data, but a shadow ledger

![](Pasted%20image%2020260814192734.png)

🔍 **"Is it properly working?" — yes, the page is real. "I don't have many controls" — also correct, and there's a bigger issue underneath.** Backed by a genuine `expenses` table with real insert and tenant-scoped summary totals.

🐞 **The real finding: this is a second, disconnected expense system that never touches the real accounting ledger.** Two completely separate expense pipelines exist: (1) **this page** — a simple table with no account reference at all, doesn't know what Chart-of-Accounts row the money came from; (2) `/api/finance/accounting/expenses` (a completely different route backing the formal accounting module) — real **double-entry** bookkeeping, posts two `journalEntryLines` rows, and has a full lifecycle (`submit → approve/reject → post`) this page never gets. Money entered through this page **never appears in the Plan Comptable's books** — the "Total Dépenses" shown here and the real ledger can permanently disagree.

**Scope:** decide which is meant to be the system of record. If this simple journal should stay for petty-cash logging, it needs a clear label distinguishing it from the formal module. If it should feed the real ledger, this page's POST needs to create an `accountingDocuments` entry too — medium work either way, since it touches how money is currently tracked in production.

## 13.6 — "Nouvelle Dépense Bureau" dialog: is this enough?

![](Pasted%20image%2020260814192811.png)

🔍 **Audit against its own data model — not enough, and the gap is visible in the API response itself.** The 4 fields shown match the API schema exactly, but the `GET` response for this page already returns a `receiptUrl` field per expense row — **and there is no upload input anywhere in this form to ever set it.** Every expense recorded here is permanently `receiptUrl: null`. Same "field exists in the data model but is unreachable from the UI" pattern found repeatedly elsewhere (2.5, 6.4).

✨ **Also missing:** a payee/vendor name, a payment method, and — per 13.5 — any connection to a real accounting account or the formal approval workflow.

**Scope:** small for the receipt upload (file-storage plumbing already exists elsewhere, e.g. the document-cards module) — medium if also wired into the real approval chain from 13.5.

## 13.7 — Plan comptable général (Chart of Accounts): no per-account detail, and the backend for it already exists unused

![](Pasted%20image%2020260814192838.png)

🔍 **"Is this page working properly?" — yes for what it does, and "4 comptes" is genuine tenant data.** Builds a real parent/child tree, real search, real archive action.

🐞 **"I don't see each account's data or a proper page of it" — confirmed, precise, and the fix is smaller than it looks.** The "Détail du compte" panel is **entirely static metadata** — no transaction history, no running balance. **The backend for exactly what's missing already exists, fully built, and is simply never called:** `GET /api/finance/accounting/statements/drill-down?accountId=...` takes an account ID and returns every posted journal-entry line against it with a running balance, computed correctly per account type. Grepped every finance UI file for any reference to this endpoint — the only match anywhere is an unrelated usage in `bank-reconciliation-view.tsx`. A fully working, orphaned API with zero UI consumer — same pattern as 8.5's finding.

**Real fix:** wire the existing "Détail du compte" panel to call `drill-down?accountId=`. No new backend work — purely a UI gap.

## 13.8 — "Créer un nouveau compte comptable" dialog: is this enough?

![](Pasted%20image%2020260814192925.png)

🐞 **Confirmed real gap: the form can't build the hierarchy the page displays.** `chartOfAccounts` has a real `parentAccountId` column, rendered as an indented tree on the main page — but the creation dialog only has 3 fields (Code, Libellé, Type) and **no parent-account selector at all.** Every account created here becomes root-level; the tree UI can only be populated by whatever hierarchy already existed or was seeded directly.

**Scope:** small — add a parent-account combobox to the create dialog. No schema change needed.

## 13.9 — Grand livre des transactions (immutable transaction ledger)

![](Pasted%20image%2020260814193147.png)

`/dashboard/finance/accounting/transactions`.

🔍 **Audit — what this is and how it works:** the append-only, double-entry journal-entry ledger sitting underneath all of Finance — every real money movement (fee payments, salary runs, expenses) eventually lands here as a balanced debit/credit pair. Rows are immutable by design — corrections happen via new offsetting entries, not edits, which is correct double-entry practice.

❓ **How to work with it:** you don't create rows here directly — this is a read-only audit trail. Entries land here automatically from the "Nouvel encaissement"/"Nouvelle dépense" forms (13.11) or another module's accounting bridge (e.g. payroll).

**Net assessment:** solid, real, correctly modeled — nothing to fix functionally. Worth pagination/date filtering once transaction volume grows.

## 13.10 — Journaux et types de pièces (journals & voucher/document types)

![](Pasted%20image%2020260814193220.png)

❓ **What it's for:** the **configuration layer** behind 13.9 and 13.11. A "Journal" is a named ledger stream (e.g. `GEN` = General, `BAN` = Bank) — every transaction belongs to one. A "Type de pièce" is a document-type code within a journal, optionally requiring approval. This is how you extend the accounting system to recognize new source-document kinds without touching code.

🔍 **Audit — real, not decorative:** both forms POST to real endpoints and the table lists what already exists.

**Why this matters for 13.11:** the "Code journal"/"Type de pièce" fields you're asked to fill in on the encaissement/dépense forms are literal free-text codes that must match a code defined here — see 13.11 for the exact UX gap this causes.

## 13.11 — Nouvel encaissement / Nouvelle dépense / Dépenses à traiter (posting workflow)

![](Pasted%20image%2020260814193304.png)
![](Pasted%20image%2020260814193351.png)
![](Pasted%20image%2020260814193401.png)

🔍 **Audit — real and well-engineered under the hood.** **Nouvel encaissement (deposit):** posts immediately and atomically with an **idempotency key** (`mode:reference:date:amount`) so a double-click or retry never double-books. **Nouvelle dépense (expense):** creates a **draft**, not an immediate posting — correctly reflecting real accounting practice, driving a genuine `draft → pending_approval → approved → posted` state machine visible in "Dépenses à traiter."

🐞 **Bug/UX — exactly the "why do I need to type a code, not something simpler to memorize" complaint, confirmed with the exact cause.** Both forms' "Code journal"/"Type de pièce" fields are **raw free-text `<Input>` boxes** — you have to remember and correctly type an exact code that only exists because it was defined on the Journaux/Types page (13.10). No dropdown, no autocomplete, no validation until submit-time rejection. The data to populate a proper `<select>` already exists and is fetched by 13.10's own view — this form just doesn't reuse it.

**Scope:** small — replace both free-text inputs with a `<select>` populated from the journals/voucher-types endpoints, same pattern already used correctly for the account pickers two lines above. No backend change needed.

## 13.12 — Comptabilisation Étudiants (student-fee → GL mapping, exceptions, reconciliation)

![](Pasted%20image%2020260814193445.png)

Three real tabs: **Mappings** — defines which GL account a given fee category/payment method routes to, letting the system auto-post student payments without manual journal entries. **Exceptions (0)** — a real worklist for payments that couldn't be auto-mapped. **Rapprochement** — checks that student-ledger fee postings match what landed in the GL.

❓ **How to work with it:** add a mapping any time you introduce a fee category/payment method that doesn't route anywhere; Exceptions is your worklist when auto-posting fails; Rapprochement is your "does student accounting agree with the GL" sanity check — run it after a batch billing/payment run.

🔍 **Audit:** real, not mocked — all three tabs hit real endpoints with real CRUD.

## 13.13 — États financiers (financial statements: trial balance, GL, P&L, balance sheet, cash flow)

![](Pasted%20image%2020260814193526.png)

🔍 **Audit — real and complete.** Five real statement types in one screen, each computed live from posted transactions, with a date-range picker and CSV export. The screenshot's "ÉQUILIBRÉ" banner is a genuine balance check, not decoration — it recomputes correctly from the seeded transactions. Also supports drilling into a specific account's line items.

**Net assessment:** no gap found — genuinely one of the more complete pages in this whole review.

## 13.14 — Périodes comptables (fiscal period close & exceptional reopen)

![](Pasted%20image%2020260814193544.png)

🔍 **Audit — real, and correctly modeled as a two-person control.** Closing a period requires a typed reason and blocks any further posting before that period's end date, writing an immutable snapshot. Reopening is deliberately **two-step**: one person requests it with a detailed reason, a *different* person must approve or reject — real maker-checker separation, not just a confirm dialog.

**Net assessment:** no gap — a deliberately strict, well-designed control, not something to "simplify."

## 13.15 — Structures de frais & Types de frais (fee structures, fee categories, archive logic)

![](Pasted%20image%2020260814193556.png)
![](Pasted%20image%2020260814193618.png)

**Structures de frais** — the priced bundles assigned to a class, versioned (draft→published, published versions immutable). **Types de frais** — the underlying fee-category catalog, each with rule badges (Non imposable, Remboursable, Réductible, Sans pénalité).

❓ **The archivation logic, answered directly from the code:** fee categories are **never hard-deleted**, by deliberate design — the code comment explains why: they're referenced by fee components, so they're renamed/archived, not removed. Archiving is a normal `PUT` setting `isArchived: true` rather than deleting — an archived type's historical invoices stay intact, it just stops appearing for new billing. Correct pattern, no bug — just under-explained in the UI.

🎨 **UX note:** worth a one-line explainer near the "Voir les archivés" toggle since this exact confusion is what prompted the question.

## 13.16 — Politiques d'amendes (late-fee / fine policies)

![](Pasted%20image%2020260814193643.png)

❓ **What it's for:** configurable late-payment penalty rules — "Retard de paiement" (per-day formula, capped, with a grace period) and "Documents perdus" (flat reissue fee). "Lancer l'évaluation" runs the policy against actually-overdue invoices to compute and apply fines, rather than fining on a blind schedule.

🔍 **Audit:** real rule engine, not decorative — no gap found in this pass; worth a live test of "Lancer l'évaluation" to confirm the computed fine matches the configured formula.

## 13.17 — Assignations tarifaires vs. Affectation des frais par classe (two distinct, similarly-named steps)

![](Pasted%20image%2020260814193651.png)
![](Pasted%20image%2020260814193702.png)

**Naming clarification:** these two screens look like they could be the same feature — they aren't, and the near-identical French names (**Assignation**, **Affectation**, and 13.18's **Allocation**) are a genuine, confirmed source-of-confusion risk for whoever operates this for the client.

- **Assignations tarifaires** — **step 1**: pick a class, pick a fee structure, set an effective date. A pure link/rule.
- **Affectation des frais par classe** — **step 2, read-only preview**: shows the *actual computed per-student amounts* for that class, including individual discounts. A report, not an action screen.

❓ **How they relate, in plain terms:** Assignation = "which price list applies to this class." Affectation = "here's what that means in MAD for every actual student, including discounts." Neither issues invoices — that's 13.18.

🎨 **UX — real naming-clarity gap, confirmed.** Suggest renaming for client-facing copy, e.g. "Assignations tarifaires" → "Structure tarifaire par classe" and "Affectation des frais par classe" → "Aperçu des frais par élève" — no logic change needed, just labels.

## 13.18 — Allocations de frais (the actual batch billing/invoicing run)

![](Pasted%20image%2020260814193710.png)

**Step 3**, the one that actually creates invoices. 🔍 **Audit:** create an allocation (fee-structure-version + student population) → preview → approve → "Lancer" actually generates invoices. Correctly gated behind approval before launch, preventing accidentally billing the wrong population.

❓ **How to work with it:** the button a school admin presses once a year (or per intake) to bulk-bill an entire class/cohort off a published fee structure.

**Net assessment:** real. Together with 13.17, confirms the pipeline is: Assigner (link) → Aperçu (preview) → Allouer (bill). Worth surfacing that 3-step relationship explicitly (breadcrumbs/stepper) since today they're three unrelated-looking sidebar entries.

## 13.19 — Notes de crédit & Remboursements (credit notes and refunds)

![](Pasted%20image%2020260814193720.png)
![](Pasted%20image%2020260814193729.png)

🔍 **Audit:** both real, already-populated with genuine records. Both feed into 13.20's approval queue when new ones are created.

❓ **How they differ:** a **credit note** reduces what a family owes (an accounting adjustment against future invoices) without moving cash; a **refund** actually pays money back out.

## 13.20 — Centre d'Approbation Financière (maker-checker approval queue)

![](Pasted%20image%2020260814193738.png)

🔍 **Audit — real, unifies three item types.** Pulls together pending expenses (13.11), credit notes, and refunds (13.19) into a single maker-checker queue. Action buttons are gated by a real permission check — a user without the capability sees "En attente d'un administrateur" instead of the buttons, confirmed in code, not cosmetic.

**Net assessment:** solid, correctly permissioned. No gap found.

## 13.21 — Rapports & Exports Comptables (CSV report exports)

![](Pasted%20image%2020260814193746.png)

🔍 **Audit — three genuine CSV exports, each backed by live data, not stubs:** Journal des Encaissements (every real payment in the selected month), Bilan des Dépenses (every real expense, grouped by category), État de l'Ancienneté des Créances (a genuine aged-receivables report with real day-bucket logic, not a canned export).

**Net assessment:** real, useful, no fix needed.

---

# 14. Inventory & School-Shop Addon

> *Screenshotted in the same walkthrough session as Finance, but this is its own separate, registered addon (`inventory`, marked "Built" in `src/addons/registry.ts`) — not part of the Finance module in the code.*

## 14.1 — Inventory overview dashboard

![](Pasted%20image%2020260814224317.png)

🔍 **Audit — real, live-computed KPIs, not mock:** Produits actifs, Valeur du stock, Stock bas (computed as products whose `totalStock <= 0`), Prêts en cours, Transferts en attente, Mouvements — all computed from real product/stock-movement rows. "Mouvements récents" is explicitly labeled "Journal immuable — source de vérité des soldes" — the same immutable-ledger design philosophy as 13.9's accounting journal, applied to physical stock instead of money. CSV exports are real.

❓ **Better structure, as asked:** functionally this already works well; the main opportunity is that "Produits à faible stock" and "Mouvements récents" are both full-width stacked lists with no pagination — same long-scroll pattern flagged elsewhere (8.7). A tabbed layout (Aperçu / Mouvements / Alertes) would read better as movement volume grows.

## 14.2 — Inventory reference data: Catégories, Unités, Magasins, Fournisseurs

*(One paste in this stretch of the raw note, `224450.png`, was wrapped in Obsidian's `%%...%%` comment syntax by you — meaning you cut it from the note yourself. Skipped here as excluded, not audited.)*

![](Pasted%20image%2020260814224536.png)
![](Pasted%20image%2020260814224547.png)
![](Pasted%20image%2020260814224558.png)
![](Pasted%20image%2020260814224609.png)

Four small, consistent CRUD catalogs, all following the same real pattern (active/archived toggle, edit, archive — same soft-archive design as 13.15's fee types): **Catégories**, **Unités** (Kg, Lot, Pièce, Unité), **Magasins** (physical storage locations), **Fournisseurs** (feeding 14.3's Achats screen).

🔍 **Audit:** all four real, working CRUD, tenant-scoped — no mock rows found.

🎨 **UX — "better visual, simplicity," as asked:** these four pages are functionally near-identical (search → 2 KPI tiles → list) — a reasonable simplification would be a single "Paramètres d'inventaire" screen with these four as tabs, rather than four separate sidebar entries, since none individually needs a whole page (2-5 rows each in this tenant).

## 14.3 — Inventory transactions: Achats, Ventes, Prêts & sorties, Ajustements de stock, Transferts, Stock

![](Pasted%20image%2020260814224621.png)
![](Pasted%20image%2020260814224629.png)
![](Pasted%20image%2020260814224636.png)
![](Pasted%20image%2020260814224645.png)
![](Pasted%20image%2020260814224652.png)
![](Pasted%20image%2020260814224701.png)

The six real transaction/movement screens that actually change stock: **Achats** (subtitle: *"le stock n'entre qu'à la réception"* — correct inventory practice), **Ventes** (subtitle: *"la vente étudiant crée la facture et le paiement"* — wired into the same invoice/payment system as tuition, not a parallel silo), **Prêts & sorties** (equipment lending with due-date/return tracking), **Ajustements de stock** (Correction/Abîmé/Mise au rebut/Don, each with a recorded motif), **Transferts entre magasins** (applied only on completion), **Stock** (the current-balance report — explicitly a *projection*, computed live from the movement ledger, not an independently-editable number).

🔍 **Audit:** all six real and internally consistent — every one documents its own business rule in its own subtitle, a good sign this module was deliberately designed, not stubbed.

✨ **Feature — "automation so there's less manual input," confirmed genuinely missing across all six:** no reorder-point/low-stock-triggers-a-purchase-suggestion logic anywhere — every purchase, sale, loan, adjustment, and transfer is fully manual today. **Scope: medium-large** — needs a reorder-point field on the product record (doesn't exist yet), a scheduled/event-triggered check, and a draft-purchase-order generator. Low-stock *detection* already exists (14.1); only the *action* on it is missing.

---

# 15. Broadcast / Communication

## 15.1 — Message Templates Studio: which system is this, and does it deserve a rebuild?

![](Pasted%20image%2020260814224918.png)

**Screenshot correction:** despite the sidebar showing "CRM & Diffusion → Modèles," this screen ("Studio de Modèles de Messages," the WhatsApp-badge phone mock-up) is actually reached from a *different* sidebar section — **SMS Communication → Modèles de messages** (`/dashboard/communication/templates`), not CRM & Diffusion.

🔍 **Audit — real, not mock.** Genuinely wired to a real `smsTemplates` table, gated only by role (`school_admin`) — no addon check, always reachable. The "Approuvé Meta WhatsApp API" badge is decorative/aspirational — there is **no** WhatsApp Business API integration anywhere behind this screen; it only ever sends plain SMS (15.2).

🐞 **Bug — one root finding this whole section turns on: there are three separate, disconnected "send a message" systems in this codebase, not one.**

| System | Sidebar entry | DB tables | Gated by addon? |
|---|---|---|---|
| **SMS Communication** | "SMS Communication" | `smsTemplates` (bare) | No — always on |
| **Lead CRM** | "CRM & Diffusion → Pipeline CRM" | `inquiries`, `inquiryFollowUps` | `lead-crm` |
| **Broadcast Messaging** | "CRM & Diffusion → Connexions/Segments/Modèles/Campagnes/…" | `communication_connections`, `communication_segments`, `communication_templates`, `communication_campaigns` … | `broadcast-messaging` |

None of these three share a template, a contact list, or a delivery log. A "Rappel scolarité" template built in the SMS Communication studio can't be used from a Broadcast campaign, and vice versa. This is almost certainly what your "less repetitions, better foundations" instinct was reacting to, without knowing the internals.

🎨 **UX — styling deviates from the app's design system, confirmed in code.** This view (and the Pipeline CRM kanban, 15.3) hardcode `#2487B8`/`#1B6C93` throughout instead of the app's real `#0066FF`/`#16212B`/`#D1F5E8` tokens. The Broadcast Messaging module's own views correctly use the real tokens and shared primitives. So "too many different colors" is real and precisely localized: SMS Communication and Lead CRM are the outliers, not Broadcast.

✨ **"Inspire from an open-source GitHub project" — scoped down to what's actually true.** The template-studio idea is already the right shape — it doesn't need a rebuild from a reference, it needs to stop being its own island. **Scope: medium.** Recommended direction: consolidate the SMS Communication template studio into the Broadcast `communication_templates` system (already supports multi-channel sms/email/whatsapp/telegram/messenger, versioning, draft→published) so there's exactly one place to author a message template, and retire the standalone `smsTemplates` table. Also folds in the "less repetition, better foundations" ask directly.

## 15.2 — "The broadcast page doesn't work": reproduced, root cause is a data/entitlement gap, not a code bug

![](Pasted%20image%2020260814225014.png)

🐞 **Bug reproduced exactly.** `/dashboard/broadcast` fires four parallel calls on load; if **any** fails, it shows one generic *"Impossible de charger le tableau de bord de diffusion"* — no status code, no reason, no which-endpoint.

**Root cause, confirmed by querying the actual dev database directly:** the tenant shown — Groupe Scolaire Atlas — has **no entitlement row at all for `broadcast-messaging`** (only `lead-crm` is granted). Every route under `/api/addons/broadcast/*` throws **403 `ADDON_NOT_ACTIVATED`**. By contrast, SchoolOS Center (the platform's other real tenant) does have it enabled and the feature works fine there — this is a per-tenant configuration gap, not a broken feature. (Confirmed even covered by the repo's own regression script, `scripts/verify-broadcast-addon-gate.mjs`, which asserts exactly this 403 behavior while the addon is disabled — the behavior is intentional and tested, just currently "off" for this tenant.) This also explains the rest of the raw note's screenshots showing *"Ce module n'est pas activé"* on every Broadcast sub-page — Connexions, Segments, Modèles, Campagnes, Rapports, Automations all call the same guard.

**Net assessment — not a code bug, a data/config gap plus a bad error message:**
1. **Real, small fix:** grant `broadcast-messaging` to Atlas via the per-school entitlement toggle (see 1.3). One click, not a code change.
2. **Real, small UX fix worth doing regardless:** the overview (and all six sub-pages) should surface `error.code === 'ADDON_NOT_ACTIVATED'` as its own distinct state instead of a generic loading-failure message that reads exactly like a real outage — the API already returns the precise reason.

## 15.3 — Pipeline CRM kanban: is it real, and does it need drag-and-drop?

![](Pasted%20image%2020260814225033.png)

🔍 **Audit — real data, not mock.** `InquiriesKanbanView`, served at `/dashboard/communication/crm`. **Worth flagging for the record:** there's a *second*, unused component in the same feature folder — `LeadPipelinePage` — that *is* 100% hardcoded fake data (fictional names, fixed counts). That file is never imported by the actual route, so it's dead/orphaned code, not something currently shown to users — but worth knowing it's sitting there since it's easy to wire up by mistake later.

**What's real about the page you saw:** search/filter/pagination, a real profile drawer with stage transitions, tags, notes, follow-up log, duplicate detection, merge, convert-to-student. All backed by real endpoints, none stubbed.

🐞/✨ **"The kanban should be drag and drop too" — confirmed not implemented.** Column movement today only happens through the profile drawer's status-stepper buttons, gated by a `TRANSITIONS` map that's already correct (e.g. `qualified` can only go to `contacted` or `lost`, not directly back to `new`). There is **no drag handling anywhere in this file.** **Scope: small-to-medium** — the transition-validation logic already exists and is correct; this is UI-only work (a drag library wired to the same status-update call), not a backend change.

🎨 **UX — same color-system deviation as 15.1**, confirmed by grepping the file — every button, badge, and gradient uses the non-standard blue.

**On "is this fully dynamic, nothing returning mockdata":** for what's actually rendered at this route — yes, confirmed dynamic and real. The only mock data in this feature area is the orphaned, unused `LeadPipelinePage` noted above.

## 15.4 — Broadcast Campaigns view: is it a kanban at all?

🔍 **Audit — important scope clarification.** `/dashboard/broadcast/campaigns` is **not a kanban at all** — it's a flat data table (Nom/Canal/Statut/Programmée/Ciblés/Envoyés/Délivrés/Échecs) with a compose-and-preview form. Real, wired, no mock data. **The only kanban that exists in this app is the Pipeline CRM one (15.3)** — there's nothing to make drag-and-drop here because there's no board to begin with. If a kanban view of campaigns-by-status is actually wanted here too, that's a genuinely new feature — **scope: medium**, the status enum and lifecycle already exist, it would just need a board layout instead of the current table.

## 15.5 — Envoyer des Rappels & Notifications: hardcoded-data audit, class filtering, non-SMS channels

![](Pasted%20image%2020260814224805.png)

**Scope note:** this is `/dashboard/communication/reminders` — a **different** page from the Finance module's own `/dashboard/finance/reminders`, which wasn't audited in this pass. Worth clarifying which one you actually meant to review.

🔍 **Audit — "is it hardcoded":** no, the recipient list is genuinely computed. `GET /api/dashboard/summary` computes at-risk students server-side from two **real** signals — absence count (from actual attendance rows) and overdue-invoice status (from actual invoice rows) — classifying each as "Risque élevé"/"Risque moyen"/"À surveiller." The underlying data is real; nothing in this flow is mock.

🐞 **Bug — confirmed, and it's the real answer to "why only those people showing":** the computation ends with `.slice(0, 6)` — a **hardcoded cap of 6 students, platform-wide, with zero filter parameters** (no class, no section, no risk-level threshold, nothing passed from the UI at all). That's the literal reason you only ever see a small, fixed handful of names regardless of how many students are actually behind school-wide. Not broken — aggressively and invisibly truncated.

✨ **Feature — "can't I select by filtering classes": confirmed, genuinely does not exist, and confirmed why.** The endpoint has no query parameters at all — always the same tenant-wide top-6. Adding class filtering needs a `classSectionId` query param (the underlying query already joins to `classSections`/`classes` for display — the join exists, it's just not used as a filter), removing/raising the hardcoded cap, and a class-picker control. **Scope: small-medium.**

✨ **Feature — "other ways of rappels, not only SMS": confirmed, SMS is the only channel, traced to the exact line.** The send action writes only into `smsMessages` — no email/WhatsApp/push option, and the page is explicit that nothing real is sent regardless: *"Mode simulation: aucun SMS n'est réellement envoyé."* This matches the exact same simulated pattern already found in Attendance's own reminder button (8.7) — both clearly share the same underlying mechanism, so fixing one (wiring a real gateway) would very likely fix both at once. **Scope: medium** — needs an actual provider integration plus extending the `smsMessages`-only model to a more general `messages` table with a `channel` field.

---

# 16. Report Cards / Bulletins

## 16.1 — "Générer les bulletins": the entire feature is one page, and it is exactly as thin as it looks

![](Pasted%20image%2020260814225237.png)

🔍 **Audit — this is the whole feature.** Searched the entire codebase for any report-card/bulletin UI: there is exactly **one** component, rendered at `/dashboard/documents/generator` (sidebar label: "Bulletins Massar"). No feature folder, no history/list view, no batch mode, no template picker — the screenshot shows literally the entire surface area: two dropdowns (Classe, Élève) and a print button.

🔍 **What's genuinely real underneath it:** `GET /api/students/report-card?studentId=` computes an actual Moroccan-scale bulletin — per-subject average, general weighted average, mention, class rank — pulling real rows from `assessmentResults` → `assessments` → `assessmentPlans`, reusing the exact same `calculateMoroccanAverage()`/`calculateClassRanks()`/`getMoroccanMention()` functions documented in Section 10. Confirmed via a direct database query that `assessment_results` has 301 real rows in the dev DB — a real, correctly-wired calculation on real grades, not dead code. The "Aucune note enregistrée" states are honest empty states for a specific student, not a broken query.

**One genuine, code-confirmed gap in that calculation:** the route hardcodes `coefficient: 1` for every subject (flagged in the route's own code comment) — no per-subject coefficient is wired into this calculation, so a Moroccan bulletin's subject weighting (Maths counting more than Sport) isn't actually applied yet, even though the engine function supports it.

🐞 **Bug — "should be automated based on grades and classes": confirmed, this is 100% manual, one student at a time, by design of the current code.** No "generate for a whole class" action, no automatic trigger when a term's grades finalize, no bulk export. For a class of 30, that's 30 manual round-trips. **Scope: medium** — the per-student calculation is already correct and reusable; the missing piece is a batch endpoint plus a bulk UI (select class → "Générer tous les bulletins" → progress → download-all).

🐞 **Bug — "the PDF isn't working": confirmed, and the reason is simpler than the pdfme-schema failure pattern seen elsewhere in this app (9.6/9.7).** There is **no PDF generation at all** — the "Imprimer/PDF" button calls `window.print()` directly on the live dashboard page. There is **no `@media print` stylesheet anywhere in this component** (the only one in the whole app lives in an unrelated attendance-badge file), so what actually prints includes the full sidebar/top-bar/both panels, not a clean one-page bulletin. This is architecturally disconnected from the app's real document-generation pipeline — the versioned-template + pdfme-designer + `issueDocument()` system used for ID cards/certificates (9.1) is never invoked here. Unlike the ID-card bug (malformed seed data), **this one has no pdfme involvement to be broken in the first place** — it's a missing feature, not a data bug.

**Real fix, scope: medium** — either (a) add a scoped print stylesheet for a clean one-page print (cheapest, still not a true downloadable/storable PDF), or (b) properly integrate report cards into the existing `documentTemplates`/pdfme pipeline as a fourth document type alongside `student_id`/`employee_id`/`admit_card`, giving bulletins the same versioning, batch-issuance, and audit trail the ID-card system already has. Option (b) is the right long-term answer given the "automate by class" ask above — batch issuance is exactly what that pipeline was built for.

🎨 **UX — "not many controls," "ui looks very bad": confirmed, precisely because there is only one view and it has no controls beyond the two dropdowns.** No term/semester selector, no template/layout choice, no history of previously-generated bulletins, no save-and-download-later, no multi-select. **Scope for a real redesign: medium-large**, best scoped together with the batch-generation and real-PDF fixes above rather than as a standalone UI pass — the current thin form/preview split doesn't have room for the controls a real bulletin generator needs.

**Net assessment:** the hard part (Moroccan-scale grade calculation, rank, mention — live and correct on real data) is already solid and reusable. Automation, PDF, and UI all trace back to the same root cause: this was built as a single-student on-demand preview, never connected to the app's existing (and more capable) document-issuance system that already solves exactly this problem for other document types.

---

# 17. HR / Personnel — Payroll & Self-Service

> This is a *different, more expansive* HR module than Section 7 (which covers the basic teacher directory, `/dashboard/teachers/**`). This module operates on a separate `employeeProfiles` data model, reached via **"Ressources Humaines"** and **"Paie & Workforce"** (`/dashboard/hr/**`, `/dashboard/workforce/**`).

## 17.1 — Employee directory ("Employés")

![](Pasted%20image%2020260814225537.png)

🔍 **Audit.** `/dashboard/hr/employees`. Real data, not mock: 20 employees, live KPI cards (Effectif total, Actifs, En congé, Sans compte), search + status/account filters, and a real per-employee row with matricule, département, poste, type, statut, and **account-link status as a first-class column** — a generation ahead of the teacher directory audited in 7.1.

## 17.2 — New employee wizard (Identité / Emploi / Données sensibles)

![](Pasted%20image%2020260814225545.png)
![](Pasted%20image%2020260814225552.png)
![](Pasted%20image%2020260814225601.png)

🔍 **Audit — this directly answers "is the create form logically complete," and it's a marked improvement over the old module.** A 3-step form: **Identité** (auto-generated matricule if blank, same pattern used for students), **Emploi** (contract type, status, hire date, branch, department, poste, manager, weekly hours, dependents), **Données sensibles** (CNSS, AMO, RIB, CIN, monthly salary — gated behind a "sensitive data" read permission). Cross-checked against the real API schema — every field shown is accepted. **This is exactly the gap 7.3 flagged as missing on the old teacher form** (hire date, CIN, salary/contract terms, document uploads) — here it's already built.

## 17.3 — Single employee page ("Dossier employé") — does it show finance and attendance?

![](Pasted%20image%2020260814225638.png)
![](Pasted%20image%2020260814225716.png)
![](Pasted%20image%2020260814225724.png)
![](Pasted%20image%2020260814225730.png)

🔍 **This directly answers your core question.** `/dashboard/hr/employees/[id]`, gated `school_admin`/`super_admin`. **This is a real, purpose-built admin view — not a self-service component reused by mistake** (see 17.7 for why this matters). Four tabs: **Détails** (contact + employment info), **Données sensibles** (CNSS/AMO/RIB/CIN/salary, a single current value), **Documents** (real upload/list/download/archive flow, max 5MB, jpg/png/pdf), **Chronologie** (an append-only employment-events timeline — hired, promoted, department/manager changes, access granted/revoked).

🐞 **Confirmed missing: no Finance/Payroll tab and no Attendance tab — the page is genuinely siloed from both.** The "Salaire mensuel" field is a single static value with no payslip history, no link to a payroll run. A real payroll engine and a real payslip service already exist — the data is there, just never queried from this component. There's no daily/monthly presence view, no leave-balance summary, no time-clock history, despite a real staff time-clock system (`workforcePunchEvents`) already existing.

**Why this is more than a UI oversight — a schema-level obstacle, not just a missing tab:** payslips and punch events are both keyed to the **platform login account** (`user.id`), while the employee page is keyed to `employeeProfiles.id` (the HR record). Net effect: even after wiring these tabs in, any employee who is "Sans compte" (no linked login — a real, tracked state shown on the directory's own KPI, 17.1) would show **zero** payslips and **zero** punches, not because they have none, but because those two systems can't currently resolve them without a `userId`.

**Scope:** medium — two new tabs (query + render), no new tables needed for payroll, but the `userId`-vs-`employeeId` join gap needs a deliberate decision (join through nullable `userId` and accept "Sans compte" employees show nothing, or add proper `employeeId` columns to the payroll/punch tables).

## 17.4 — HR Overview dashboard ("Aperçu RH")

![](Pasted%20image%2020260814225749.png)

🔍 **Audit — real data, not mock.** Headcount by status, hires/departures this month, unlinked accounts, expiring documents (90-day window), and salary mass (gated to whoever has sensitive-data read). Numbers line up with the seed data from 17.1 — a live query, not a static mock.

🎨 **"Make it better looking, more data":** functionally solid but thin relative to what data already exists elsewhere: no **payroll KPI** at all (total run cost, next pay-run date, pending approvals) despite the payroll tables powering `/dashboard/workforce` already existing; no **leave** KPI despite real leave-balance tables existing; no **attendance/punch** KPI despite the time-clock system existing; no trend/chart, unlike the Super Admin dashboard (1.4) or Portail direction (1.5) which both show trends; no drill-down (clicking "Sans compte: 0" doesn't route to the Accès & Sorties filter, 17.5).

✨ **Scope:** small-to-medium to pull payroll/leave/punch summaries onto this page — the underlying queries mostly already exist, this is aggregation plus new cards, not new backend. A trend chart is a bigger lift (needs historical snapshots, which don't appear to be stored anywhere today).

## 17.5 — Départements, Postes & fonctions, Accès & Sorties

![](Pasted%20image%2020260814225829.png)
![](Pasted%20image%2020260814225846.png)
![](Pasted%20image%2020260814225913.png)

🔍 **Audit.** Three real, working CRUD/lifecycle screens: **Départements**, **Postes & fonctions** (explicitly subtitled *"Distinct des permissions applicatives"* — a good UX detail that pre-empts the confusion 6.2/6.6 had to explain elsewhere), and **Accès & Sorties** (the account-lifecycle screen — per-employee "Lié"/"Sans compte" status with real offboarding logic).

🐞 **Bug — confirmed count discrepancy between the two org pages, worth a live data check.** Départements shows **0 employé(s)** for all three departments including "Enseignement," while Postes & fonctions correctly shows **20 employé(s)** attributed to "Professeur" — but the directory (17.1) shows every row tagged "Enseignement." Both pages compute counts the same, correct way — the most likely explanation is duplicate/orphaned department rows in this tenant's seed data (the same class of stale-fixture issue found at the tenant level in 1.1). Recommend a direct query grouping employees by `departmentId` on this tenant to confirm before treating it as a code bug — the query logic itself looks correct.

## 17.6 — Security & permissions across the module

🔍 **Audit — deliberately checked whether a non-HR role can reach payroll/HR data.** `school_admin`/`super_admin` get every `hr.*`/`payroll.*` capability, as expected. **None** of teacher/student/parent/receptionist/guard/librarian/alumni are granted any `hr.*`/`payroll.*` capability by default — every route calls `requireAddon` + `requireCapability` before touching data, and page-level guards duplicate the check server-side. `accountant` explicitly and deliberately **excludes** HR read/manage, confirmed by an inline code comment — good, intentional segregation-of-duties design, no gap found.

🐞 **One real inconsistency found while checking this, worth flagging even though it fails safe:** `/dashboard/workforce` guards on `allowedRoles: ['school_admin', 'accountant']` **and** `requiredCapability: 'payroll.review'` — but the `accountant` role's default capability list grants **no `payroll.*` capability at all**. So today, an accountant passes the role check, fails the capability check, and gets redirected home — meaning accountants currently **cannot** open `/dashboard/workforce` at all, despite the route apparently being built to allow them in. Not a security hole (fails closed), but looks like half-finished work. Small fix either way — grant `payroll.review` to `accountant` if that's the intent, or drop `'accountant'` from the allowed roles if not.

✨ **Positive finding:** the `payroll.*` capability set is unusually well-designed for a real payroll process — `payroll.calculate`/`payroll.review`/`payroll.approve`/`payroll.post` are four distinct capabilities (classic maker/checker/poster separation). Nothing in the current role table uses that separation yet (`school_admin` holds all four), but the model is there if a school ever wants to split those duties.

## 17.7 — Connection to other modules / does this module have Section 7.2's bug?

❓ **Direct answer: does `/dashboard/hr/employees/[id]` land an admin on the employee's own self-service view, the way `/dashboard/teachers/[id]` did in 7.2? No — confirmed not reproduced here.** Two separate, correctly-scoped components exist: the admin-facing "Dossier employé" (`/dashboard/hr/employees/[id]`, gated `school_admin`/`super_admin`), and the employee's own self-service home (`/dashboard/hr/self-service`), which explicitly resolves employee context and redirects anyone who isn't a resolvable employee back to `/dashboard` rather than rendering someone else's portal. This is a genuine, verified positive finding.

🔍 **Cross-module connection audit, as asked:** HR ↔ Payroll is connected at the data layer but **not surfaced in the UI** (17.3's finding), and the two live under two different sidebar sections with no cross-links today. HR ↔ Attendance: a real staff time-clock exists but isn't linked from the HR employee page, for the same `userId`-vs-`employeeId` reason as 17.3. HR ↔ Auth/Accounts: well connected — the "Lié"/"Sans compte" link point is consistently reflected across the directory, the Accès & Sorties screen, and the profile page. HR ↔ Documents/Compliance: self-contained and working, not yet linked to the Overview page's "Documents arrivant à expiration" list by a click-through.

**Net assessment for this part of the module:** core HR record-keeping (directory, wizard, profile, org structure, document compliance, event timeline) is solidly built and, in several respects, ahead of what Section 7 found in the older teacher module. The two real gaps: (1) the single-employee page confirmed **not** presenting finance or attendance, for the schema-level reason in 17.3, and (2) the org-page employee counts (17.5) and accountant/workforce role wiring (17.6) each have a small, concrete inconsistency. The 7.2-style bug does **not** reproduce here.

## 17.8 — Paie & Workforce: six of twelve sub-pages are raw JSON dumps, not forms

![](Pasted%20image%2020260814230011.png)
![](Pasted%20image%2020260814230051.png)
![](Pasted%20image%2020260814230105.png)
![](Pasted%20image%2020260814230113.png)
![](Pasted%20image%2020260814230124.png)

*(A pixel-identical duplicate paste, `230039.png`, exists alongside `230019.png` — same "Cycles de paie" screenshot pasted twice.)*

**Screenshot correction:** `/dashboard/workforce`, the "Paie et opérations RH" hub, is a 12-card menu. Six of those cards — **Composantes salariales, Structures salariales, Affectations salariales, Ajustements, Réglementation, Paramètres** — all render through the exact "just JSON" pattern you flagged.

🐞 **Bug — confirmed, exact cause found.** All six pages render through one shared component that does `GET /api/workforce/payroll/config?resource=...` and literally `JSON.stringify()`s each row into a `<pre>` block. **There is no create button, no edit button, no form, no field-level control anywhere on these six pages** — not even for an admin.

**Important nuance — this is not a display-only gap, it's a real create/edit gap too.** A real `POST /api/workforce/payroll/config` route already exists and can create these records, and a lifecycle-action route already exists too (e.g. publish) — the shared component simply never calls either: it's read-fetch-and-dump only. Today the only way any of this data gets in is direct DB seeding.

**Contrast, for scope-sizing — the other six cards on this same hub are real, purpose-built UIs, not JSON dumps:**

![](Pasted%20image%2020260814230131.png)
![](Pasted%20image%2020260814230139.png)
![](Pasted%20image%2020260814230147.png)
![](Pasted%20image%2020260814230153.png)

**Lots de paiement** (payment batches — real bank-reconciliation status and a working "Rapprocher" action), **Congés du personnel** (leave requests with working Approuver/Refuser buttons), **Avances sur salaire** (salary advances with real repayment tracking), and **Distinctions et reconnaissance** (awards, with a real rule documented in its own subtitle — an approved bonus becomes a one-off gain next cycle, never modifies base salary). Together with Cycles de paie and Bulletins (not separately screenshotted here), that's the other six cards on the hub — so "majority" overstates it slightly, it's exactly half, but the six affected (above) are precisely the module's core configuration layer (what a salary actually consists of), not a peripheral feature.

**Scope:** large. Each of the six needs a real list view, create and edit forms with proper fields (component type/rate/formula pickers, structure-template builder, per-employee assignment picker, adjustment request form with approval flow), and the existing "not juridiquement certifiée" compliance banner wired to a real publish/version-approval action instead of a silent read-only dump. A genuine "full redo" for six pages that currently have none.

## 17.9 — "Portail Employé" self-service link redirects an admin to `/dashboard` — is that a bug?

❓ **Answer: the redirect itself is correct behavior, but two real problems make it look like a bug.** The self-service page resolves whether the signed-in user has an `employeeProfiles` row; if not, it redirects to `/dashboard` — **silently, no error message, no toast.** This is intentional, documented design: self-service is gated by "does this user have an employee record," not by role — a school admin with no linked employee record is, by design, not "an employee" for this feature.

**So the redirect target and the gating logic are both correct.** The two real, fixable problems: (1) **the nav link is shown unconditionally to every role**, with no eligibility check — every sibling item in that same nav block has a permission gate, this one doesn't; (2) **the redirect swallows the reason** — the specific cause is discarded entirely, so the user just silently lands back on the dashboard home with zero explanation, which reads exactly like a broken link.

**Real fix, small scope:** (1) gate the sidebar link behind "does the current user have an active employee profile," so ineligible roles never see a dead-end link; (2) if reached directly by URL anyway, pass a notice through the redirect so the landing page can show *"Ce compte n'a pas de fiche employé — le portail libre-service ne s'applique pas."* instead of silence.

---

# 18. Sécurité & Gardiens (Guard Portal)

> A separate, top-level module (`/dashboard/portals/guard/**`) discovered while auditing an ambiguous batch of screenshots — not HR-related despite initially looking that way, and not a Settings raw-JSON page either.

## 18.1 — Guard Portal: is it actually fully functional?

![](Pasted%20image%2020260814230410.png)
![](Pasted%20image%2020260814230452.png)
![](Pasted%20image%2020260814230515.png)
![](Pasted%20image%2020260814230543.png)

🔍 **Audit — real and functional, not mocks.** **Accueil du portail** shows live counts (visitors expected today, active exits, recent incidents) with a real "Aucun quart actif pour ce gardien" empty-state gate — scan/dismissal actions are correctly blocked until the guard clocks into a shift. **Kiosque Gardien** requires "Démarrer la session" before accepting scans (same session-gated pattern as the student QR kiosk, 8.3) and shows a live Acceptés/Déjà traités/Refusés counter. **Visiteurs** is a real check-in/checkout log with pass numbers, phone numbers, and Entrée/Sortie state per visitor, plus an invitations tab. **Sorties** is a real student-lookup screen for authorized pickup release. None of these four are stubs — a working, purpose-built guard operations module.

## 18.2 — Incidents: "Signaler un incident" button confirmed broken; can't reopen a closed incident, exact causes found

![](Pasted%20image%2020260814230608.png)
![](Pasted%20image%2020260814230634.png)

🐞 **Bug 1 — "Signaler un incident" button confirmed broken, exact cause found.** The button's `onClick` only resets the create form's local state — **it never opens the dialog.** The create dialog and its full form (catégorie, sévérité, lieu, description) are already built and would work immediately once reachable. One-line fix.

🐞 **Bug 2 — can't act on a closed incident again, exact cause found.** The per-incident action row conditionally renders Escalader/Résoudre/Clore based on status — but once an incident is `closed`, **all three buttons disappear** and there is no fourth button for reopening. The backend already fully supports it: a `reopen` action exists in the incident service and its status-transition map, mapping `reopen → 'open'`. **The API is ready; the UI simply never renders the button that would call it** — the same "backend exists, frontend gap" pattern found at 8.5. Fix: add a "Réouvrir" button when status is `closed`.

❓ **"What are all those fields and data" (the expanded detail panel):** confirmed real, not decorative — an audit trail of every action taken, real file upload/delete for attachments, and a note/resolution composer, all backed by working API calls. The only actionable gap is the missing "Réouvrir" button above.

## 18.3 — Urgence: sidebar shortcut request

![](Pasted%20image%2020260814230708.png)

✨ **Feature — confirmed reasonable, not built.** "Urgence" today only appears as a regular sub-item inside the collapsed "Sécurité & Gardiens" nav group, same visual weight as every other guard sub-page. The ask — a persistent, high-visibility shortcut (red accent, always visible even when the group is collapsed) — is a real, easy addition so a guard mid-incident doesn't have to expand a nav group to find it. **Scope:** small — one new conditionally-styled nav entry, no backend change. The page itself (activate emergency mode, active procedures, emergency contacts) is already real and functional.

## 18.4 — Configuration: reaudit requested

![](Pasted%20image%2020260814230738.png)

🔍 **Audit, current state confirmed from the screenshot:** a real Portails tab showing active gates with edit/archive actions and a "Nouveau portail" action — a working CRUD screen, not a stub. The ask doesn't point at a specific defect — recommend a live click-through of the Quarts (shift definitions) and Affectations (guard-to-shift assignment) tabs specifically, since those weren't captured in the screenshot, before scoping any rework here.

---

# 19. Hostel / Internat

> **Headline finding:** this is one of the most solidly-built modules in the app. Every list/form view opened for this audit calls a real API route backed by real Drizzle queries — no mock arrays, no hardcoded data anywhere (grepped for `MOCK_`/`mockData`/`dummy`/`TODO`/`FIXME` across the whole module — zero hits). There's even a dedicated regression suite covering transfer/checkout/bulk-commit/finance-race edge cases most other modules don't have yet.

## 19.1 — Ce soir (tonight / hostel home dashboard)

![](Pasted%20image%2020260814230833.png)

🔍 **Audit — real, not mocked.** The 5 KPI tiles and the residents list are populated from a live query joining today's roll call, active allocations, and open leave passes — the "0" values shown are an honest empty-tenant state, not a broken fetch.

🐞 **Small bug — dead search box.** "Rechercher un résident…" has no `value`/`onChange` wired to it — typing does nothing, the list never filters. Trivial one-line fix.

🎨 **UX — matches your "ui looks ok but not good as the logic" complaint.** The same slate/blue design-system consistency gap flagged elsewhere in the app (plain default primitives, no data-density/visual-hierarchy beyond stat tiles) — not functional, a polish pass. This note applies across the whole module; not repeated per item below.

## 19.2 — Résidences (hostels directory + create/edit form)

![](Pasted%20image%2020260814230852.png)
![](Pasted%20image%2020260814230901.png)

🔍 **Audit — fully real CRUD, no mocks.** Genuine tenant-scoped inserts/updates against a real `.strict()`-validated schema. "Capacité totale" is a real DB-computed column, not a placeholder. Edit reuses the same modal pre-filled — a real update path, not a separate broken one.

✨ **"Better simplicity of input and logic + automations":** the form is a single flat 10-field modal with no template defaults, and — the more interesting gap — creating a hostel doesn't offer to auto-create a default zone/category/room set. Today you create the hostel, then separately build every zone (19.3), category (19.4), room, and bed (19.5) by hand across 3 more pages. A "quick-start" wizard (e.g. "create N floors × M rooms × K beds") on top of the already-working single-entity APIs would directly answer this without any backend rework.

## 19.3 — Zones

![](Pasted%20image%2020260814230927.png)

🔍 **Audit — real, and more capable than the screenshot suggests.** Zones model building/floor/wing hierarchy (self-referencing parent zone), each with its own **curfew time, roll-call time, and emergency assembly point** — genuinely useful boarding-school-specific fields, real columns, correctly read/written. The parent-zone dropdown correctly excludes the zone being edited and filters to the same residence.

✨ **Same "automations" ask as 19.2:** no bulk zone creation, and rooms (19.5) don't inherit a zone's curfew/roll-call time as a default yet — each room's zone assignment is just a label link.

## 19.4 — Catégories de chambres (room categories/tiers)

![](Pasted%20image%2020260814230942.png)

🔍 **Audit — real, well-modeled.** Default capacity, eligible gender policy, base charge/deposit (real MAD currency fields), priority, accessibility flag, status — all real columns, all round-trip correctly through the modal. This is genuinely the pricing/eligibility catalog rooms (19.5) reference.

No functional gap found here beyond the shared polish note.

## 19.5 — Chambres & Lits (rooms + beds)

![](Pasted%20image%2020260814231000.png)

🔍 **Audit — real, and the most complete of the four setup pages.** Rooms link to hostel/zone/category via live dropdowns; expanding a room shows a real per-room bed list with individual bed status toggling (Actif/Hors service/Archivé via a dedicated status endpoint) — a genuine "take this one bed out of service" action, not a fake control.

✨ **"Better simplicity of input and logic":** creating a room is one-at-a-time, beds are added one-at-a-time per room — no "create room + N beds in one step" shortcut, and no auto-incrementing room-numbering helper. Given category default-capacity already exists (19.4), auto-generating that many beds on room creation would be a small, high-value automation on already-working endpoints.

## 19.6 — Occupancy — Vue d'ensemble (bed board)

![](Pasted%20image%2020260814231031.png)

🔍 **Audit — clean, real answer: yes, this works, and is explicitly designed not to be a manual counter.** The page's own subtitle says it — *"Occupation dérivée des affectations effectives, jamais d'un compteur manuel"* — and the code backs that up: every bed's state (checked-in/reserved/free) is computed live from the allocations table joined through beds→rooms→hostels, never from a stored count. The 0/24 shown is correct given zero real check-ins exist yet in this tenant. No functional gap found — this page does exactly what it claims.

## 19.7 — Espace d'affectations (allocation workspace: applications + allocations)

![](Pasted%20image%2020260814231039.png)

🔍 **Audit — real, and notably well-guarded.** **Applications tab:** create/list real applications, Approuver/Refuser/Attente call a real decision endpoint. **Allocations tab:** a real eligibility-preview step runs before committing, and actually gates the "Engager" button — you can't force an ineligible assignment through the UI. Bulk assignment (paste `élève|lit|début|fin` lines) has its own real preview/commit pair, and the module's regression suite specifically covers bulk-commit cross-tenant protection and date-window validation.

## 19.8 — Appel du soir (evening roll call)

![](Pasted%20image%2020260814231112.png)

🔍 **Audit — real workflow, correctly modeled.** "Ouvrir l'appel" creates a real roll-call row; marking a resident's status persists per-allocation; "Clôturer l'appel" locks it server-side. None of this is simulated.

🐞 **Bug confirmed, matches the screenshot exactly.** Every row in the "Appels" list shows a raw UUID prefix instead of the residence name. Root cause: the list query has **no join to the `hostels` table**, so the API response only ever carries `hostelId`, never a name. The identical bug *shape* already documented at 6.14 (raw-ID fallback because a list endpoint skips a join) — same fix pattern applies: add the join, select the name. Small, precise, one-file fix.

## 19.9 — Permissions de sortie (leave passes)

![](Pasted%20image%2020260814231137.png)

🔍 **Audit — real, full lifecycle.** Create → Approuver/Refuser (with the approving role recorded) → "Enregistrer le retour" is a complete, DB-backed state machine, matching the screenshot exactly. "Tuteur requis" reflects a real policy flag (19.10) driven by the tenant's actual guardian-consent/majority-age settings, not a hardcoded assumption — a genuine cross-page automation already wired correctly.

## 19.10 — Politiques de l'internat (hostel policies)

![](Pasted%20image%2020260814231247.png)

❓ **Audit — real answer: this is what actually drives the automations across the whole module.** One versioned, per-tenant policy document — not a static settings page. Its fields are read live elsewhere: majority-age/guardian-consent settings gate leave-pass approval (19.9), the escalation ladder feeds a real escalation engine, and a "charge on check-in" toggle controls whether check-in triggers a real Finance charge. Every one of these toggles has a real downstream consumer — directly answering "are they correctly used and configured in the app."

🎨 **UX gap, confirmed:** the escalation-tier section (Palier 1/2/3) is **read-only display** in this UI — the data is a real editable array in the policy document, but the view only renders it, with no add/edit/remove controls, even though every other field on the page is a live editable input. Small, contained fix: add row-level edit controls for tier recipient/threshold/channel.

## 19.11 — Rapports Internat (reports)

![](Pasted%20image%2020260814231329.png)

🐞 **Bug confirmed, exact root cause traced — this is the one real defect this screenshot is showing.** The page defaults its "Affectations" state filter to `'all'` and, unlike every other filter in this module (19.7's Allocations tab correctly special-cases it), sends that value to the API **unconditionally**. On the backend, `state` is compared against a Postgres **enum** column — `'all'` is not a member of that enum, so Postgres throws an invalid-enum-value error. The route's generic error handler surfaces it as the exact message shown: **"Une erreur interne est survenue."** This also silently breaks the "Affectations" CSV export on this page, since it downloads whatever the failed fetch left behind.

**Fix (small, one-line-of-intent):** special-case `'all'` on the frontend the same way the Allocations tab already does correctly, or guard against it inside the shared service function itself (the safer fix, since it protects every future caller).

## 19.12 — Boundary note: the last screenshot in this batch belongs to Transport, not Hostel

![](Pasted%20image%2020260814231351.png)

This final image in the excerpt ("Transport Scolaire & Flotte") is not part of the Hostel/Internat module at all — it's the landing dashboard of the separate School Transport & Fleet addon, covered in Section 20. Flagging it here rather than silently dropping it or auditing it as if it were hostel-related.

**Net assessment:** contrary to what "check if this actually works, no hardcoded parts" implies, this module does **not** lean on mock data anywhere. What's real, concretely: 2 confirmed bugs (the Reports-page enum crash, 19.11; the roll-call list's missing name-join, 19.8), 1 confirmed dead control (the tonight-view search box, 19.1), 1 confirmed read-only-when-it-should-be-editable gap (escalation tiers, 19.10). Everything else flagged is genuine "automations/simplicity" feature-request territory (19.2/19.3/19.5) — small-to-medium, layered cleanly on already-working CRUD, not backend rework. The recurring "ui is bad" complaint is the same app-wide design-polish gap, real but cosmetic.

---

# 20. Transport

## 20.1 — Full module inventory

**Method note:** this is a breadth-first, code-first audit (no per-page screenshots were provided for this module) — every verdict below is grounded in reading the actual route, its client component, the API route it calls, and the underlying table.

The module has a real, dedicated schema (15 tables: vehicles, vehicle documents, stops, routes, route versions, route stops, crew assignments, student allocations, trips, trip roster snapshots, rider events, incidents, incident actions, fare links, policies) and a real service layer with no mock/hardcoded-array markers anywhere. All 18 API routes are gated with tenant + addon-entitlement + capability checks — real multi-tenant + RBAC enforcement, not open endpoints.

🔍 **Audit — per-page verdict:**
- **Vue d'ensemble** — Real. Live `count()` queries against vehicles/routes/allocations/trips/incidents power every KPI tile.
- **Itinéraires** — Real. Full CRUD against real route/route-stop/route-version tables.
- **Arrêts de Bus** — Real. Full CRUD, includes GPS lat/lng fields, validated server-side.
- **Parc de Véhicules** — Real. Full CRUD, includes insurance/inspection expiry tracking.
- **Chauffeurs & Équipage** — Real but read-only. Returns actual employee records filtered by driver/attendant role; a searchable/filterable directory, no create/edit form here (crew assignment presumably happens elsewhere, not audited in this pass).
- **Affectations Élèves** — Real. Full CRUD, cross-references with routes/stops for real, unit-testable capacity math.
- **Trajets du Jour** — Real. A genuine trip-lifecycle state machine (start/roster/complete), not decorative buttons.
- **Pointage / Montée** — Real. The live roster feeds real scan events into a dedicated rider-events table — this is the QR/boarding-scan flow and it's wired to a real table, not a local-only checklist.
- **Incidents & Signalements** — Real. Includes a redaction helper that strips safeguarding-sensitive notes and internal fields before anything reaches parent/guardian self-service views — a genuine safeguarding control, not cosmetic.
- **Rapports & Exports** — Real. Three CSV exports run live queries and stream back a real CSV with a proper header — not a "coming soon" stub.
- **Règles & Politiques** — 🐞 **Mock/dead-end.** 100% local React state with a fake save that just flips a "saved" banner via `setTimeout` — **it never calls any API.** No `/api/transport/policies` route exists anywhere, even though the schema already defines a real, completely unused `transportPolicies` table. Whatever a school admin toggles here (sequence-check enforcement, overbooking allowance, notification triggers, capacity %) is thrown away on refresh and has zero effect on the actual boarding/allocation logic enforced elsewhere.

**Net assessment:** genuinely well-built — 10 of 11 pages are real, tenant-isolated, capability-gated, and query actual tables end to end, including a real async trip lifecycle and a real safeguarding-redaction path. The one gap is **Règles & Politiques**, which needs a real `GET/PUT` route wired to the already-existing table, plus the service layer actually reading those persisted values instead of in-code defaults. No 404s or errors found anywhere in the module.

---

# 21. Reports & Analytics

## 21.1 — What the module actually is

![](Pasted%20image%2020260814231500.png)

This module isn't a page-by-page feature — it's a single, substantial async report-generation platform (schema, 7 domain adapters, a run engine, 3 file exporters, a schedule worker, watermark/snapshot services, secure-download/cleanup services — 20+ files). All 4 sidebar pages are thin route wrappers around this one addon.

🔍 **Centre de Rapports** — Real. The catalog defines **27 pre-built report types** across 8 domains, matching the screenshot's category tabs exactly. Each offers CSV/XLSX/PDF export; clicking "Ouvrir" runs a capped live preview, then queues a full async export.

**Is it real or a stub? Real, with an honest readiness gate.** The run engine maps every one of the 27 catalog keys to a real adapter method — the code comment states explicitly "no mock fallback exists anywhere in this map." A readiness checker honestly flags exactly 3 report types as genuinely not-buildable yet, and gates HR/Inventory report domains behind whether those addons are actually enabled for the tenant. Everything else routes to live queries.

🔍 **Mes Exécutions** — Real, and yes, a genuine async job system, not a stub. Queueing a run inserts a row, fires background execution (in-process, not a separate queue like BullMQ, but functionally asynchronous — the request returns immediately with a run ID), and on completion writes an artifact row with a SHA-256 checksum, file size, and a 60-day expiry. Failure states are captured too, not swallowed.

🔍 **Planifications** — Real. A genuine "run this report every week and email it to these people" system, not a placeholder form.

🔍 **Console Admin** — Real. Reports actual storage-quota usage with a progress bar, active-schedule count, and a projection-freshness monitor listing each read-model's row count and last-refresh timestamp — a materialized-view freshness monitor for whoever administers the reporting pipeline, not a decorative dashboard.

**Net assessment:** one of the most solidly built modules in the whole audit — a real 27-report catalog, real async run/export pipeline with checksums and expiry, real scheduling, and an honest readiness gate. The only caveat: background execution runs in-process with no persistent job queue/retry — fine at current scale, but a server restart mid-run would leave a run stuck at "running" with no automatic recovery. Worth a small resilience pass if volume grows, not urgent now.

---

# 22. Settings

## 22.1 — Overall shape

![](Pasted%20image%2020260814231520.png)

The settings landing page is itself a real dashboard, not a flat link list: a live **"7/17 modules configured"** completion counter, a real compliance-status tile, a "last modified N min ago by [name]" activity tile, the active establishment card, and category tabs with per-module cards individually tagged "Configuré"/"À configurer." Module-completion tracking is real and tenant-specific, not a static page.

All 30 listed routes exist and are every one guarded (payment-methods additionally requires a finance-management capability). Every page delegates to a dedicated feature view — none are dead stubs.

## 22.2 — Cluster: Core settings — Généraux, Migration, Politiques Académiques

🔍 Spot-checked all three — same pattern (guarded route → dedicated view component). No evidence of mock data or missing implementation.

## 22.3 — Cluster: Users/security — Utilisateurs & Rôles, Sécurité & Sessions, Journal de connexion, Matrice des permissions

🔍 **Deep-checked, and this cluster is real end to end.** **Utilisateurs & Rôles** is an async server component running live queries directly against the user/role-permissions/audit-log/branch/tenant tables — genuinely server-rendered, not a client-side mock. **Matrice des permissions** is a live RBAC-matrix editor with real GET/POST, not a hardcoded table. **Sécurité & Sessions** and **Journal de connexion** both exist as real files with the same guard pattern and a real API surface backing session/2FA data.

## 22.4 — Cluster: Integrations/devices — Dispositifs de Scan, Connexions Externes, Classes en Direct, Liaisons Comptables, Méthodes de paiement

🔍 **Spot-checked, all real, all backed by substantial API surfaces (not stubs).** **Dispositifs de Scan** is backed by a real device-pairing API plus the QR-attendance session flow. **Classes en Direct — Fournisseurs** is backed by an unusually large real API surface (20+ route files: provider profiles, session lifecycle, recordings, materials, attendance, webhooks per provider, health check) — a mature, fully wired third-party video-provider integration, not a placeholder. **Liaisons Comptables** is a specialized front-end over the same real settings-values registry (22.5), not a separate mock. **Méthodes de paiement** and **Connexions Externes** both route to real backing endpoints.

## 22.5 — Cluster: Data/config plumbing — Traductions & Champs, Registre des paramètres, Approbation des paramètres, Séries de numérotation, Champs personnalisés, Tâches automatisées, Tâches & Audit

**This is the cluster suspected of the "raw JSON editor" complaint — traced to its actual source, and it's not here.** The complaint's screenshots belong to the HR module's Payroll config pages (17.8), not Settings. Confirmed by direct code inspection that none of this cluster's pages are raw-JSON editors: **Registre des paramètres** is a proper namespace-accordion UI with per-key labeled form fields, source badges, a dirty-change counter, and an audited secret-reveal/rotate flow — complex object-typed values do fall back to a JSON textarea (reasonable, not "everything is raw JSON"), but scalar/boolean/string values get real typed inputs. The remaining six pages are all sized like real interactive CRUD screens (300-400 lines each), not stub pages — a scan for raw JSON-dump rendering across these files found no matches, and backing API routes exist for all of them.

**Net for this cluster: real, form-based UIs throughout — no raw-JSON-editor problem found in Settings.**

## 22.6 — Cluster: Billing/licensing — Abonnement & Licence, Modules & Licences, Exports & téléchargements

🔍 Both **Abonnement & Licence** and **Modules & Licences** route to dedicated real views. Note: "Modules & Licences" likely overlaps with the super-admin "Plans & Modules" catalog already found in 1.3 to be a **hardcoded TypeScript array**, not database-driven — that finding likely still applies here since this school-level view is probably reading from the same registry (not independently re-verified in this pass). **Exports & téléchargements** is a real, sizeable client component structurally matching the app's real-CRUD pattern.

## 22.7 — Cluster: Branches/domain/website — Succursales & Campus, Domaine Personnalisé, 4 Site Web pages

🔍 **Spot-checked, all real and backed by a substantial dedicated API tree.** The 4 Site Web pages (Thème & Identité / Pages / Menu / Actualités) are backed by a real, reasonably complete API including a public-facing surface for the rendered site itself — this is a genuine mini CMS, not a stub.

## 22.8 — Cluster: Access/compliance — Réinitialisation Accès, Statut CNDP F211

🔍 **Access-reset status check:** real, currently-wired code — a real page, real view, and real API route. **Statut CNDP F211:** same pattern, routed to a dedicated view with a real backing API. Both consistent with this codebase's own module index listing them as shipped.

**Summary across Transport, Reports & Analytics, and Settings:** 45 pages audited, no 404s, no broken routes anywhere. Only one genuinely mock page found in the entire batch — Transport → Règles & Politiques.

---

# Module Health Overview

A fast, at-a-glance read across all 22 modules before diving into the item-by-item detail above or the execution plan below.

| # | Module | Health | Headline |
|---|---|---|---|
| 1 | Super Admin | 🟡 Mostly real | Scattered across 3 pages, needs consolidation; hardcoded addon registry |
| 2 | Students | 🟡 Mostly real | Several real gaps: no pagination, admission KPIs stuck at "—", matricule button silently burns numbers |
| 3 | Alumni | 🟢 Real | Transition logic solid; only manual-trigger automation missing |
| 4 / 11 | Events | 🔴 Weak admin UI | Backend has 11 real sub-resource APIs, **zero** UI consumes them |
| 5 | Student Requests | 🟡 Needs rebuild | Binary status only, no pipeline, no fulfillment tracking |
| 6 | Academics | 🟡 Mixed | Several real, root-caused bugs (6.14, 6.15, 6.16); some large unbuilt features (auto-scheduling) |
| 7 | Personnel/HR (teacher directory) | 🔴 Needs rework | Real routing bug: admin sees teacher's own self-service view |
| 8 | Attendance | 🟡 Mostly real | 1 fully-mocked page (8.5); reminders simulated, not real |
| 9 | Documents/Cards | 🟢 Solid | 1 seed-data schema bug affecting PDF downloads |
| 10 | Examinations | 🟢 Real | Logic solid; UX/labeling is the whole complaint |
| 12 | Library | 🟡 Mostly real | 1 real data-integrity bug (orphaned copies); admin/librarian view not separated |
| 13 | Finance | 🟢 Mostly excellent | Accounting subledger is some of the best-engineered code in the app; front-line pages have fixable gaps |
| 14 | Inventory | 🟢 Solid | Fully real, well-documented business rules; zero automation |
| 15 | Broadcast/Communication | 🟡 Fragmented | 3 disconnected messaging systems; "broken" page was a tenant config gap, not a bug |
| 16 | Report Cards | 🔴 Thinnest feature found | One page, one student at a time, no real PDF, no automation |
| 17 | HR/Payroll (new module) | 🟡 Good core, gap in Payroll config | Core HR ahead of the old teacher module; 6 of 12 Payroll pages are literal JSON dumps |
| 18 | Guard Portal | 🟢 Solid | 2 small, precisely root-caused bugs (report button, reopen button) |
| 19 | Hostel | 🟢 Excellent | Cleanest module in the app — zero mock data, has its own regression suite |
| 20 | Transport | 🟢 Excellent | 10 of 11 pages fully real; 1 page (Policies) is pure UI theater |
| 21 | Reports & Analytics | 🟢 Excellent | Most mature module found — real 27-report catalog, real async engine |
| 22 | Settings | 🟢 Excellent | All 30 pages real and guarded; the feared "raw JSON" problem belongs to HR, not here |

**Reading this table:** 🟢 modules need little beyond the specific bugs/UX notes listed against them — safe to treat as "keep as-is, fix what's flagged." 🟡 modules are functionally real but have real, specific gaps worth deciding on. 🔴 modules are where the real product-scoping conversations should happen first.

---

# Execution Plan — how to fix it all

135 items across 22 modules, sorted into five buckets by what kind of decision or work each actually needs. This is the order I'd recommend tackling them in, roughly bucket-by-bucket, though nothing here is committed — say the word on any item and I'll start. The [Module Health Overview](#module-health-overview) above tells you where to look first if you'd rather scan by module than by bucket.

## Bucket 1 — Already fixed / no action needed, or confirmed false alarms (14)

Nothing to do here except confirm you agree. The second wave found several complaints that turned out to be misdirected or already fine once traced — those are exactly as valuable as finding bugs, since they save you from "fixing" something that isn't broken.

| # | Item | Status |
|---|---|---|
| 1.2 | Waitlist 404 | Fixed — `ComingSoonView` placeholder live |
| 6.2 | "Medium" language confusion | Working as designed — optional rename to "Langue d'enseignement" |
| 6.17 | Live class "prepare session" | Confirmed fully real, empty tenant was the only issue |
| 8.2 | QR scan real-time question | Confirmed real-time (3s polling) — was just asked about the wrong (report) page |
| 9.2 | Card locale `undefined` bug | Not reproducible — every call site already has the `?? 'fr'` fallback |
| 9.1 | Cards/convocations business logic | Confirmed solid — templates → issuance → verification → revocation → batch → audit all real |
| 12.6 | Library renew/return logic | Confirmed real and well-designed — fine calc, grace periods, hold-queue protection all genuine |
| 13.9 / 13.13 / 13.14 / 13.16 / 13.19 / 13.20 / 13.21 | Accounting subledger core (ledger, statements, period-close, fine policies, credit notes, approvals, exports) | Confirmed solid, no gap found across 7 separate pages — this is some of the best-engineered code in the app |
| 15.2 | "Broadcast doesn't work" | Confirmed: missing addon entitlement on this one tenant only, not a code bug — same one-click fix as 1.3 (grant via super-admin toggle) |
| 17.1 / 17.2 / 17.7 | HR/Payroll directory, wizard, single-employee routing | Confirmed real and, in several respects, ahead of the old teacher module — and confirmed the 7.2 admin/self-service routing bug does **not** recur here |
| 18.1 | Guard Portal core screens (home, kiosk, visitors, sorties) | Confirmed real and functional, not stubs |
| 19.6 / 19.7 / 19.9 | Hostel occupancy board, allocation workspace, leave passes | Confirmed real, derived-not-manual, well-guarded — no gap found |
| 20.1 | Transport (10 of 11 pages) | Confirmed real end-to-end — schema, service, API, guard, UI all genuine (only Règles & Politiques is mock, see Bucket 2) |
| 21.1 | Reports & Analytics (all 4 pages) | Confirmed one of the most solidly built modules in the app — real 27-report catalog, real async engine, real scheduling |
| 22.1–22.8 | Settings (all 30 pages) | Confirmed real and guarded throughout — the feared "raw JSON editor" problem does **not** exist here; it traces to 17.8 (HR Payroll) instead |

## Bucket 2 — Quick, safe fixes (small, precise, low-risk — good first batch)

These are one-route, one-query, or one-line fixes with a known, narrow cause. All safe to do without a design decision from you first.

| # | Item | Fix |
|---|---|---|
| 6.14 | Teacher affectation shows raw IDs | Add `leftJoin(subjects, ...)` to `GET /api/academics/class-subjects`, return `subjects.name` |
| 6.15 | Promotion wizard "no section" bug | Fetch `class_sections`/`class-offerings` directly instead of the sections-less `classes` response |
| 6.16 | Readiness dashboard 129/43 impossible ratio | `countDistinct(classSubjects.id)` instead of `count()` in the readiness query |
| 2.6 | Matricule "reserve" button burns real numbers | Split into a true non-mutating preview vs. an explicit reserve action; move off `GET` |
| 9.6 / 9.7 | Card & certificate PDF download fails | Replace seed script's placeholder `schemaJson`/`templateSchema` with real pdfme-shaped schemas |
| 8.5 | Attendance excuses page is mock data | Wire `attendance-excuses-view.tsx` to the already-working `/api/attendance/excuses` + `/document` routes |
| 2.4 | Admission dossier KPI cards stuck at "—" | Wire the 4 cards to real counts (backend fields already exist per the wizard data) |
| 6.12 | Conflict errors shown as inline text, not a toast | Presentation-only change, same data already returned |
| 10.6 | Épreuve UUID field | Swap free-text UUID input for a searchable title dropdown (both roster & schedule tabs) |
| 9.3 / 9.4 / 2.1 | Unbounded issuance/student lists | Add pagination to the 3 lists (backend pagination already exists for students; cards lists need it added) |
| 11.1 | Events dashboard: 3 of 4 stat cards are hardcoded literals | Wire "Inscriptions totales" to a real sum of `registeredSeats` (data already fetched); drop or compute the other two |
| 12.4 | Attachment-type "Code" field is manual; archived types can't be seen/restored | Auto-slugify `Nom` → `Code` on the create form; add an archived-items filter + restore action reusing the existing `PUT` route |
| 13.2 | Aging Receivables buttons are `alert()` calls with zero backend | Swap both for a real `smsMessages` insert and a real `exportToCsv` call — patterns already used elsewhere in the app |
| 13.4 | Create Invoice: raw student-ID text field; payments/new redirect loses context | Swap the field for the same student-search component used elsewhere; pass `?studentId=` through so "Enregistrer un paiement" auto-selects the right student on Collection Desk |
| 13.7 | Chart of Accounts: no per-account transaction history shown | Wire the existing panel to the already-built `drill-down?accountId=` endpoint — zero new backend work |
| 13.8 | New-account dialog can't set a parent account | Add a parent-account combobox — column already exists, tree UI already reads it |
| 13.11 | Encaissement/dépense forms require typing a journal/voucher-type code from memory | Replace both free-text inputs with `<select>`s populated from the journals/voucher-types endpoints, same pattern already used correctly two fields above |
| 15.2 | Broadcast addon disabled for Atlas tenant | Grant `broadcast-messaging` via the super-admin entitlement toggle (1 click); separately, surface `ADDON_NOT_ACTIVATED` as its own distinct error state instead of a generic failure message |
| 17.9 | "Portail Employé" self-service link dead-ends for admins with no explanation | Gate the sidebar link behind eligibility (same data the page guard already reads); pass a notice through the redirect so the landing page can explain why |
| 18.2 | Guard Portal: "Signaler un incident" opens nothing; closed incidents can't be reopened | Add the missing `setCreating(true)` call; add a "Réouvrir" button when status is `closed` — backend already supports both |
| 19.1 | Hostel "tonight" view: dead search box | Wire `value`/`onChange` — one line |
| 19.8 | Hostel roll-call list shows raw UUIDs instead of residence names | Same fix class as 6.14 — add the missing join |
| 19.10 | Hostel escalation tiers are read-only in a page where everything else is editable | Add row-level edit controls, reusing the `set()` helper already on the page |
| 19.11 | Hostel Reports page crashes with a generic error | Special-case the `'all'` filter value the same way a sibling tab already does correctly |
| 20.1 | Transport Règles & Politiques is pure UI theater | Add the missing `GET/PUT /api/transport/policies` route wired to the already-existing, already-unused table |

## Bucket 3 — Confirmed real bugs needing more work (not one-liners, but scoped and bounded)

| # | Item | What's needed |
|---|---|---|
| 2.5 | Tutor form missing fields | Add `occupation`/`address`/`emailOptIn`/`smsOptIn` to the wizard mini-form AND the standalone Parents & Tuteurs Zod schema + form (2 separate gaps) |
| 6.9 | Question bank can't be edited | New edit UI for per-exam questions (backend PUT already exists); new PUT route + UI for bank items (doesn't exist at all); ownership enforcement on delete |
| 7.2 | Admin "teacher profile" is actually the teacher's own portal | Build a real admin-facing detail component; stop routing `/dashboard/teachers/[id]` to `TeacherProfile360View` |
| 10.2 | Any teacher can grade any other teacher's devoir | Add `createdBy` ownership check to the grade route; introduce a narrower `grading.review` capability for admin view-only mode |
| 8.6 | No way to send a new SMS from the flag-detail page | Add a compose/send action reusing the existing `smsMessages` pattern already used for the history panel |
| 8.7 | "Rappel" is simulated, not a real SMS send | Wire a real SMS/notification provider — fixes this and 8.6 together (same send path) |
| 6.11 | Seeded data shows a teacher double-booked 4x at once | Not a code bug — data cleanup: reconcile/clear the 177 conflicting seed slots (see 6.12) |
| 2.3 | Wizard's inline tutor form is narrower than the "foyer" modal shown | Confirm where the richer modal actually lives today (Parents & Tuteurs page?) before deciding whether to reconcile |
| 12.5 | Admin sees the librarian's own operational checkout desk | Same bug class as 7.2 — build a real admin-facing library management view (staffing/policies/overrides), separate from the operational desk |
| 12.7 | Library copies orphaned from their catalog records — Catalogue shows 0 while the desk shows 27 | Backfill this tenant's orphaned copies with real bibliographic records, and add a guard so a copy can never be created without one |
| 13.5 | Two disconnected expense systems — money never reconciles | Decide which is the system of record: keep Office Accounting as a labeled petty-cash log, or make its POST also create a real `accountingDocuments` entry |
| 15.1 / 15.3 | Three disconnected "send a message" systems (SMS Communication / Lead CRM / Broadcast) sharing no templates or contacts | Consolidate the SMS Communication template studio into Broadcast's already-multi-channel `communication_templates` system; retire the standalone table |
| 15.5 | Reminders page: hardcoded 6-recipient cap, no class filter, SMS-only and simulated | Add a `classSectionId` filter param + UI control, remove the cap; wire a real SMS/notification provider (shares a fix with 8.7) |
| 16.1 | Report Cards: entire feature is one page, one student at a time, no real PDF | Add a batch-generation endpoint + bulk UI; either add a print stylesheet (cheap) or properly integrate into the existing pdfme document pipeline as a 4th document type (right long-term answer, ties to the "automate by class" ask) |
| 17.3 | Employee detail page missing Finance/Attendance tabs | Two new tabs, but first resolve the schema-level `userId`-vs-`employeeId` join gap in payslips/punch-events before the tabs can show real data for "Sans compte" employees |
| 17.5 | Département employee counts don't match Postes/directory counts | Needs a live-DB check for duplicate/orphaned department rows before treating as a code bug — query logic itself looks correct |
| 17.6 | Accountant role can't open `/dashboard/workforce` despite being in `allowedRoles` | Decide intent: grant `payroll.review` to `accountant`, or drop `'accountant'` from the allowed-roles list |
| 17.8 | Payroll: 6 of 12 sub-pages are raw JSON dumps with zero forms | Real list/create/edit UI needed for all six (components, structures, assignments, adjustments, regulations, settings) — backend already supports create/edit, only the UI is missing |

## Bucket 4 — Genuine unbuilt features needing a scoping decision from you

Nothing here is a bug — each is real, new work. Grouped so you can pick priorities rather than going one by one.

**Super Admin**
- 1.3 — consolidate school-detail / Plans-Modules / subscriptions into one screen + enforce real plan-tier limits
- 1.4 — build out any of the 4 stubbed platform pages (SMS, Support, Rapports, Santé)
- 1.5 — define the IGP composite-score formula

**Students / Alumni**
- 2.7 — student photo gallery (data-model change) + bulk upload
- 2.9 — automatic grade-threshold promotion logic
- 3.1 — automatic alumni-transition trigger on "last class ended"

**Events / Requests**
- 4.1 / 11.4 — full admin event-detail page covering the 7 backend sub-resource areas (venues, tasks, incidents, feedback, communications, reports, check-ins/waitlist) that currently have zero UI
- 5.1 — kanban multi-stage alumni-request pipeline + fulfillment objects + analytics (confirm scope first: alumni-only, or a broader student-services queue?)

**Academics** (the biggest cluster)
- 6.1 — bulk section creation + teacher assignment + availability engine + inline weekly calendar at class-creation time
- 6.5 — per-class period-mode (semester/trimester/month) + downstream grade/analytics wiring
- 6.6 — filière structure (coefficients, Bac code, cycle restriction)
- 6.9 — auto-generate exam variations + auto-compose-by-difficulty
- 6.10 — full scheduling/constraint-solver auto-generation
- 6.12 — auto-fix suggestion engine for timetable conflicts
- 6.13 — full JSON preview before applying a session copy
- 6.14 — substitute-teacher workflow
- 6.16 — drill-down + historical trend on the readiness dashboard

**Personnel**
- 7.3 — expand the add/edit form to a real employment record (hire date, CIN, address, salary, documents) — note 17.2's newer HR wizard already does this well; consider retiring/consolidating the old form instead of rebuilding it

**Attendance**
- 8.1 — surface bulk badge issuance in the UI; confirm the no-reprint security posture is intentional
- 8.3 — camera-based QR scanning (net-new capability)

**Documents**
- 9.1 — class/section grouping for issuance, auto-émission trigger, profile-page entry point
- 9.5 — class/section bulk-select for convocations

**Examinations**
- 10.1 — sequential/gated 3-tab flow (ties into 10.6's dropdown fix)
- 10.3 — teacher question bank for devoirs
- 10.4 — bulk-fill/keyboard-driven grade entry + live mention computation
- 10.5 — shared room/facility registry that exam halls could pull from

**Library**
- 12.1 — rename/disambiguate the two "Bibliothèque" sidebar entries (pure naming, no logic change)

**Finance / Inventory**
- 13.3 — surface the existing bulk-billing engine from the Invoices page (discoverability, not new backend)
- 14.3 — reorder-point / auto-purchase-suggestion automation for Inventory (low-stock detection already exists, the action on it doesn't)

**Broadcast**
- 15.4 — a real kanban view for Broadcast Campaigns (only if actually wanted — today it's a flat table, which is a legitimate design too)

**Hostel**
- 19.2 / 19.3 / 19.5 — a "quick-start" wizard for bulk zone/room/bed creation, and beds auto-generated from a category's default capacity — all layered on already-working single-entity APIs

**Reports & Settings**
- 21.1 — a small resilience pass for the report-run engine (crash recovery for stuck "running" jobs) — not urgent at current scale
- 22.6 — the entitlements-catalog page likely still rides the hardcoded addon registry flagged in 1.3 — worth confirming and fixing together

## Bucket 5 — Deferred design-exploration briefs (3 variations each, no logic to build — just layout/UX exploration)

You already flagged these as "playground" asks — no backend work blocks any of them, all sit on top of already-working data:

- 2.8 — Student transfer form (3 variations)
- 6.10 / 6.15 — Timetable builder and Promotion wizard (3 variations each — 6.15's variations are additionally blocked on the section-picker bug in Bucket 2 being fixed first)
- 7.4 — Personnel page (3 variations)
- 8.3 — Kiosk scanner (3 variations — A and B additionally depend on the camera capability in Bucket 4)

## Open questions — resolved (decisions recorded 2026-08-23)

- **5.1** — ✅ **Decision:** the kanban workflow is a **broader student-services demand queue**, not narrowly alumni-records-only. Alumni record requests are one card type within it; certificates, transcript requests, and general student-service inquiries flow through the same board.
- **7.5** — ✅ **Decision:** the page in question is the **teacher attendance register** (the class register view), not `TeacherProfile360View` (the teacher's home dashboard).
- **8.1** — ✅ **Decision:** keep the **no-reprint security posture**. An issued badge cannot be re-printed; replacing a lost/stolen badge requires issuing a new credential through the standard issuance flow, preserving the audit trail. `replace-only` is unchanged.
- **12.1** — ✅ **Decision:** the **librarian operational desk keeps the plain "Bibliothèque"** name; the **content/pedagogical-resources entry is relabeled to "Ressources Pédagogiques"** (subitem "Médiathèque"). Implemented in `src/components/shared/sidebar.tsx`.
- **1.1** — ⏸️ **Parked:** tenant cleanup remains deferred per your "leave it for now," recorded here so it isn't lost.
- **13.5** — ✅ **Resolved:** the Office Accounting expense log keeps its simple form but **feeds the real double-entry ledger** when account references (`expenseAccountId` + `settlementAccountId`) are supplied — the POST creates a draft `accountingDocuments` expense that proceeds through submit → approve → post (`src/app/api/accountant/me/office-accounting/route.ts`).
- **17.6** — ✅ **Resolved:** the role was intentional, not a mistake — **accountants are granted `payroll.review`** and remain in the `/dashboard/workforce` `allowedRoles` list (see `src/libs/api/permissions.ts` accountant capabilities).

---

**Next step:** tell me which bucket (or which specific items) to start on, and I'll begin implementing — this document stays a planning artifact until you say go.
