# What is done and what is left

_Rebuilt by `node .agent-hub/hub.mjs sync-audit` on 2026-09-24 10:19. Do not edit by hand: move work forward with hub commands (verify, progress, swept, claim --reopen)._

**27 done · 18 in review · 8 partial · 5 open** (of 58 findings). Pages: 30 fixed and waiting for a re-sweep, 0 confirmed on screen.

- **Done** = the finding file is in [findings/done/](findings/done/): fixed, and checked by an agent other than the fixer.
- **In review** = fixed and logged with `done`, waiting for another agent to `verify`. **Partial** = started; the note says what is done and what is left. **Open** = not started.

## Open

| ID | Sev | Problem | Note |
|---|---|---|---|
| [S-7](findings/S-7.md) | P1 | ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French) | Hardcoded French strings not migrated (large, ongoing). |
| [S-13](findings/S-13.md) | P2 | Exam planning exists twice | /academics/exams and /assessment/exam-master both still exist. |
| [S-15](findings/S-15.md) | P2 | Two director dashboards with overlapping KPIs; IGP unexplained | IGP still unexplained; dashboards still overlap. |
| [S-24](findings/S-24.md) | P2 | Three matricule formats in one tenant | Several matricule formats still in use. |
| [S-55](findings/S-55.md) | P3 | Public school site: no menu, home ignores news, low-contrast hero | Public site still has no default menu or news on home. |

## In review (fixed, waiting for a second agent)

| ID | Sev | Problem | Fix |
|---|---|---|---|
| [S-12](findings/S-12.md) | P2 | Timetable: duplicate generate buttons, 2-hour grid | opencode-1: One canonical generation workflow: the legacy Generer Tout Automatiquement CTA/modal/handler removed from schedule-client; generation stays with the versioned draft->generate->publish flow (SchedulePu Waiting for a second agent to verify. |
| [S-14](findings/S-14.md) | P2 | Sidebar lists add-on modules the tenant has not enabled | opencode-1: Sidebar add-on gating completed: the broadcast parent entry now carries addon broadcast-messaging (it targeted an addon-gated page while untagged, so tenants without the add-on saw the entry and the c Waiting for a second agent to verify. |
| [S-22](findings/S-22.md) | P2 | Leadership admin calls HR API when HR add-on is off | claude-finance: Leadership admin no longer calls /api/hr/departments when the HR add-on is off: the page checks hasAddon(tenant, 'human-resources') on the server and passes hrEnabled; the client skips the departments Waiting for a second agent to verify. |
| [S-26](findings/S-26.md) | P2 | Settings page: wrong "Configuré" state, raw English actions, spec codes | claude-finance: Settings hub: 'Annexes & Multi-Sites' is 'configured' only when the multi-branch add-on is enabled and the school has more than one campus; recent changes show translated actions (Settings.auditAction Waiting for a second agent to verify. |
| [S-33](findings/S-33.md) | P2 | "{count} demandes" rendered without a value | claude-finance: The alumni requests card used the count sentence key totalRequests ('{count} demandes') as its title without a count. It now uses a plain title key Students.totalRequestsLabel ('Total des demandes' /  Waiting for a second agent to verify. |
| [S-34](findings/S-34.md) | P2 | Student photos: broken files counted, upload hint names a format nobody has | claude-finance: Student photos: the API now checks each saved photo file (uploadedFileExists) and returns kpi.missingFiles; the page shows an amber banner when files are missing (counts stay equal to the with_photo f Waiting for a second agent to verify. |
| [S-36](findings/S-36.md) | P2 | Invoices on phone: desktop table squeezed, status off-screen | claude-finance: Invoices on phone: below md the page renders one card per invoice (number + status badge, student, class · guardian, amount / remaining / due date; tap opens the same detail panel), the 7-column table Waiting for a second agent to verify. |
| [S-44](findings/S-44.md) | P2 | Staff campus switcher renders for parents, students and super admin (403 on every page) | claude-finance: Header renders the campus switcher only for the roles GET /api/settings/branches serves (school_admin, super_admin with a selected school, teacher, accountant, receptionist, guard, librarian) and not  Waiting for a second agent to verify. |
| [S-45](findings/S-45.md) | P2 | Parent sidebar reuses staff labels | claude-finance: Parent menu uses family wording instead of staff labels (Accueil, Présences de mes enfants, Factures & paiements, Messages de l’école, Demandes & documents, Mes préférences; fr/en/ar under Navigation. Waiting for a second agent to verify. |
| [S-46](findings/S-46.md) | P2 | Seed data contradicts itself (library loans, live-class dates) | claude-finance: seed-full.ts: (1) copies on open loans are set to checked_out right after the loans are inserted, so available = total - open loans; (2) live-class dates now match their status (live started minutes a Waiting for a second agent to verify. |
| [S-54](findings/S-54.md) | P2 | Expired hostel stays stay "checked_in" forever | claude-finance: Expired stays no longer vanish: getTonight now also returns overdueCheckouts (checked_in allocations whose end date has passed, per hostel, with student, room/bed and end date) plus summary.overdueChe Waiting for a second agent to verify. |
| [S-56](findings/S-56.md) | P2 | Inventory quantities read as thousands ("+12.000" for 12) | claude-finance: Stock quantities no longer read as thousands: new libs/format-quantity.ts (fr-FR grouping, only real decimals, max 3) used for the overview and stock movement badges, the stock balance badge and the p Waiting for a second agent to verify. |
| [S-47](findings/S-47.md) | P3 | Empty subtitle rendered as "—" (teacher class card, parent child picker) | claude-finance: Empty values no longer render as a lone dash: the teacher class card joins only the parts that exist (a class with no subjects reads '17 élève(s)'), and the parent child picker hides the class line wh Waiting for a second agent to verify. |
| [S-48](findings/S-48.md) | P3 | Parent amounts unformatted ("24000 MAD") | claude-finance: Added one shared display formatter (libs/finance/format-money.ts: grouped thousands, max 2 decimals, currency last) and used it on the parent finance page (outstanding, invoice net/paid/remaining, pay Waiting for a second agent to verify. |
| [S-49](findings/S-49.md) | P3 | Super-admin dashboard text glitches | claude-finance: Super-admin dashboard text: summary API now returns userCount per school (same count as the schools list), so 'Écoles clientes récentes' shows 'N utilisateurs'; 'Aujourd''hui' (rendered with a stray q Waiting for a second agent to verify. |
| [S-50](findings/S-50.md) | P3 | Transport allocations list without React keys | claude-finance: Root cause was bigger than missing keys: GET /api/transport/allocations returns joined rows ({ allocation, student, route }) while the page read flat fields, so every column and the row key were undef Waiting for a second agent to verify. |
| [S-51](findings/S-51.md) | P3 | Cards "Émissions récentes" never shows the recipient | claude-finance: Cards overview 'Émissions récentes' now shows who each card belongs to: the overview API joins the holder's name (user scoped to the same tenant) and each row shows the name with the card type underne Waiting for a second agent to verify. |
| [S-57](findings/S-57.md) | P3 | Raw enum values, two money formats, stale "current" year, overlapping widget | claude-finance: Raw values translated: payroll statuses (Badge looks up Workforce.payrollStatus.*, 15 values, fallback kept), teacher employment type (Teachers.employmentTypes.*), student placement status and its lab Waiting for a second agent to verify. |

## Partial

| ID | Sev | Problem | Done / left |
|---|---|---|---|
| [S-19](findings/S-19.md) | P1 | Late fees are assessed but never billed, and can double | CODE COMPLETE: 0156 applied to schoolos and schoolos_audit (non-destructive, journal idx 157), billing once, waiver, legacy flag, 3 Finance labels added in fr/en/ar (human-authorized over gemini-2 locale lock; check-missing-i18n-keys 0), finance suite 29 files / 159 passed on main DB, tsc 0. left: hub done (blocked: S-32 claim by codex-2 covers /dashboard/finance/fine-policies), then second-agent verify and sweep of fine-policies (claude-finance) |
| [S-32](findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Done: teacher re-sweep of all 88 nav routes on localhost:3557 -> 0 redirect failures (the Done-when for that role; failures present are dev-server MIME and globals.css console noise, none of them bounces). Left: accountant re-sweep of the same 88 routes, running now after my dev server died mid-run and had to be restarted; then close with both results. (codex-2) |
| [V-1](findings/V-1.md) | P1 | Finance home shows 6 000 MAD overdue, every other screen shows 3 000 | done: every overdue figure (finance home, dashboard, reminders, receivables, student 360, portal widget) now uses libs/finance/definitions (net minus paid, past due, open statuses, campus, Casablanca date). left: on-screen check that finance home, dashboard, invoices and reminders show the same overdue total, then swept (claude-finance) |
| [S-17](findings/S-17.md) | P2 | Classes page developer copy; Filière/Cycle empty for lycée classes | Done: "classe(s) réelle(s)" copy removed. Left: Filière / Cycle still empty for lycée classes. |
| [S-23](findings/S-23.md) | P2 | Audit log shows internal names and writes rows on view | Done: create/update/delete have French labels. Left: other actions and internal module names/UUIDs still raw; audit rows on plain views not re-checked. |
| [S-30](findings/S-30.md) | P2 | No payment history screen; payments routes land on the cash desk | Done: the link was relabelled to the cash desk. Left: no payment history screen exists. |
| [S-37](findings/S-37.md) | P2 | Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL | Done: new strings translated to Arabic. Left: dashboard widgets, security menu and class names still French; brand bidi not re-checked. |
| [S-29](findings/S-29.md) | P3 | Overdue totals agree everywhere except the finance home (confirms V-1) | done: code aligned with V-1. left: the same on-screen reconciliation as V-1 (claude-finance) |

## Done

| ID | Sev | Problem | Evidence |
|---|---|---|---|
| [S-1](findings/done/S-1.md) | P0 | Five Communication pages ran entirely on invented data | claude-1 fixed; verified by a second agent in the Agent Hub (claude-auditor): 5 routes deleted, ui-reality tests 44 passed. |
| [S-2](findings/done/S-2.md) | P1 | SMS reminders page shows a false all-clear | claude-1 fixed; verified by a second agent in the Agent Hub (gemini-2): paginated audience, opt-in and custody re-checked at send. |
| [S-3](findings/done/S-3.md) | P1 | General ledger silently empty, reports say "Équilibré" | codex-1 fixed; verified by a second agent in the Agent Hub (claude-1): skipped payment postings raise exceptions. |
| [S-4](findings/done/S-4.md) | P1 | Empty checks scored as 100 % (readiness, attendance, collection, SMS) | confirmed in code by claude-auditor (not re-swept on screen): 0/0 now yields null or "à configurer" in readiness, dashboard summary and super-admin SMS. |
| [S-5](findings/done/S-5.md) | P1 | Report card generator: "Moyenne générale 0.00/20" with no marks, print enabled | already fixed in tree, closed by claude-1; verified by a second agent in the Agent Hub (claude-auditor): report-card tests 6 passed, print gated on graded card, term required. |
| [S-6](findings/done/S-6.md) | P1 | Translation keys used in code are missing (users see raw keys or blanks) | confirmed in code by claude-auditor (not re-swept on screen): check-missing-i18n-keys reports 0 missing keys. |
| [S-8](findings/done/S-8.md) | P1 | Gate pickup does not re-check guardianship at release | closed by claude-1; verified by a second agent in the Agent Hub (claude-auditor): release-live-link tests 2 passed, live link re-read FOR UPDATE. |
| [S-9](findings/done/S-9.md) | P1 | Promotion wizard: wrong defaults and misleading numbers | confirmed in code by claude-auditor (not re-swept on screen): promotions API enforces target year after the active one, blocks pending decisions (409 PENDING_DECISIONS). |
| [S-18](findings/done/S-18.md) | P1 | Header claims CNDP compliance on every page; the school has not filed | claude-1 replaced the static badge with the real CNDP status (staff only); verified by a second agent in the Agent Hub (claude-auditor, code read). |
| [S-20](findings/done/S-20.md) | P1 | Emergency headcount ignores manual attendance | opencode-1 fixed: Emergency/onsite headcount now uses canonical manual Attendance truth; S-20 Done-when passes. Verified by codex-2: Re-ran their proof: npx vitest run src/app/api/__tests__/onsite-headcount.test.ts -> 1 passed, and it covers the plan case of manual attendance alone. Read the implementation: the headcount query combines manual_latest with attendance_scan_events and guard_gate_scan_events entries and subtracts exits (direction exit with result_status accepted or released) within today bounds, which is exactly the prescribed formula (manual present + scans - exits). The kiosk now tracks cameraActive and cameraError and renders CameraOff, so the badge no longer claims an active WebRTC viewer when the camera failed. Done-when (headcount equals present students after manual roll call) holds. |
| [S-21](findings/done/S-21.md) | P1 | Approvals inbox shows "0 en attente" when the director has no approval authority | claude-1 fixed; verified by a second agent in the Agent Hub (gemini-2): missing-authority state shown. |
| [S-35](findings/done/S-35.md) | P1 | Accountant gets 403 on class sections and semesters on the cash desk | claude-1 fixed; verified by a second agent in the Agent Hub (claude-auditor, code read): accountant can read class-sections and semesters; writes still academics.manage. |
| [S-38](findings/done/S-38.md) | P1 | HR self-service locked for every employee | codex-s38 fixed; verified by a second agent in the Agent Hub (codex-1). |
| [S-39](findings/done/S-39.md) | P1 | Super-admin dashboard shows invented numbers | codex-s3940 fixed; verified by a second agent in the Agent Hub (codex-1): constants removed. |
| [S-40](findings/done/S-40.md) | P1 | Super-admin revenue: collected > billed, "Reste dû 0" | codex-s3940 fixed; verified by a second agent in the Agent Hub (codex-1). |
| [S-41](findings/done/S-41.md) | P1 | Auth rate limit counts every page's session check, per IP | codex-s41 fixed; verified by a second agent in the Agent Hub (codex-1). |
| [S-10](findings/done/S-10.md) | P2 | Homework page shows developer copy and "0 %" for 0/0 | confirmed in code by claude-auditor (not re-swept on screen): developer copy ("Liste réelle", "Grand Livre Sync", "+ +") no longer found. |
| [S-11](findings/done/S-11.md) | P2 | Marksheet and grade entry: no title or link back to the exam list | opencode-1 fixed: Marksheet and grade-entry empty states now carry truthful titles and a translated link back to the exam list (Grading.backToExamList in fr/ar/en) pointing at /dashboard/academics/evaluations; no fabri Verified by codex-2: Independent verification on merged target f42c2bc: marksheet and grade-entry truthful empty states, translated back-to-exam-list links, and grading.manage guard pass. Read exactly at ref origin/student-directory-hardening = f42c2bc41cb2386afed52244c5355c31c8a91f96 via git show (no checkout, no edits): marksheet/page.tsx line 37 links to /dashboard/academics/evaluations and line 43 renders t(backToExamList), with requireServerPage grading.manage unchanged at line 20; grade-entry-view.tsx lines 165 and 171 link to the same evaluations route and render the same key. The key backToExamList is present once in each of locales fr.json, en.json and ar.json. |
| [S-16](findings/done/S-16.md) | P2 | Academics index redirects the director to the teacher schedule | confirmed in code by claude-auditor (not re-swept on screen): academics index sends managers to readiness, others to teacher-schedule. |
| [S-25](findings/done/S-25.md) | P2 | Header shows a fake identity when the session call is slow | confirmed in code by claude-auditor (not re-swept on screen): fake "Utilisateur / user@ecole.ma" fallback removed from the header. |
| [S-27](findings/done/S-27.md) | P2 | Cashier sessions: green "Écart cumulé 0 MAD" with zero sessions | confirmed in code by claude-auditor (not re-swept on screen): cashier sessions show a neutral empty state. |
| [S-28](findings/done/S-28.md) | P2 | Receivables aging treats not-yet-due invoices as late and offers an SMS reminder | confirmed in code by claude-auditor (not re-swept on screen): receivables API has a notDue bucket; "Relancer" only renders for overdue invoices with a balance. |
| [S-31](findings/done/S-31.md) | P2 | Developer copy on finance screens | confirmed in code by claude-auditor (not re-swept on screen): the developer finance strings are gone. |
| [S-42](findings/done/S-42.md) | P2 | Certificates module untranslated; raw keys on screen | confirmed in code by claude-auditor (not re-swept on screen): Certificates.* keys present, checker 0 missing. |
| [S-43](findings/done/S-43.md) | P2 | `HR.colStatus` missing on 3 HR pages | confirmed in code by claude-auditor (not re-swept on screen): HR.colStatus / HR.colDate present. |
| [S-52](findings/done/S-52.md) | P2 | Parents and students can read any event by ID (drafts, staff-only) | codex-1 fixed; verified by a second agent in the Agent Hub (claude-1): parent GET on the audited event returns 404, family view has no management buttons. |
| [S-53](findings/done/S-53.md) | P2 | Salary payment batches skip the RIB check; no bank export | codex-1 fixed; verified by a second agent in the Agent Hub (claude-1). |

## Other verified work (not an audit finding)

- `page:/dashboard/students/transfers` by gemini-1, verified by gemini-2: Resolved all 4 closeout items: CAPACITY_NOT_CONFIGURED semantics, attestation/notification removal, legacy projection script, full regression gate, and visual evidence re-capture
- `page:/dashboard/communication/campaign-composer` by claude-1, verified by gemini-2: Composer rewired onto the real Broadcast domain: real connections, segments and templates from /api/addons/broadcast, plus real create, preview, schedule and approve against /api/a
- `page:/dashboard/communication/delivery-reports` by claude-1, verified by gemini-2: Delivery reports now read the real Broadcast log: per-campaign counts from GET /api/addons/broadcast/campaigns and full counts plus byStatus from GET /campaigns/[id]/report, with d
- `task:check-ui-fixture-imports` by claude-1, verified by gemini-2: check:ui now catches a production screen that renders fixture records imported from a data module directly, the shape the state-seeding rule missed. The rule follows the import to 
- `task:communication-i18n-copy` by claude-1, verified by gemini-2: Added 18 Broadcast keys in fr, en and ar for the truthful states and the rewired composer (openRate, clickRate, notAvailable, notTrackedHint, noDeliveryEvents, topChannel, reportsR
- `task:tsconfig-next-dist-include` by claude-1, verified by gemini-2: Separate infrastructure fix, kept out of the Communication work. Starting a dev server with a custom NEXT_DIST_DIR wrote that dist dir into the tsconfig include list, and the gener
- `page:/dashboard/students/promotions` by gemini-1, verified by gemini-2: Consolidated canonical promotion workflow, P1-P20 tests, runtime reconciliation, visual capture A-K
- `task:attendance-final-closeout` by opencode-1, verified by antigravity-1: Attendance implementation-complete: Phase 7B consumer convergence (dashboard/Student360/roster/reminders/reporting canonical), Phase 8 real roll-call UI (section-id wiring fixed, c
- `task:page-audit-status` by claude-auditor, verified by opencode-1: Audited all 58 findings against the working tree and hub log: 26 done (14 hub-verified incl. 5 I verified now, 12 confirmed in code), 9 partial, 23 open. Moved the 26 to findings/d
- `task:hub-done-automation` by claude-auditor, verified by opencode-1: Hub now manages the audit folder: done -> REVIEW, verify --ok archives to findings/done/ with links/pages/STATUS rebuilt, verify --fail -> PARTIAL, claim --reopen moves back, new c
- `task:migration-0156` by claude-finance, verified by codex-2: Journal idx for 0156_fine_assessment_unique changed 156 -> 157: origin/student-directory-hardening already uses idx 156 for 0155_attendance_rate_nullable, so the old value would du
- `task:payment-exception-ledger-guard` by claude-finance, verified by codex-2: Payments now raise a gl_post_skipped exception only for schools that keep a ledger (active chart of accounts), same rule as refunds; real posting failures always raise. Retry still
- `task:overdue-definition-alignment` by claude-finance, verified by codex-2: V-1 remainder: student 360 finance totals now use the shared invoiced/overdue definitions (drafts and credited invoices no longer count as owed or overdue; Casablanca date), and th
- `task:alumni-lifecycle-remediation` by gemini-2, verified by antigravity-1: Alumni lifecycle hardening complete: AL1-AL15 invariants, pg_advisory_xact_lock concurrency serialization, 16/16 vitest tests passing, 9/9 runtime reconciliation checks passing, 8/

## Needs attention

- **Stale claim** `task:promotion-verification-remediation` held by gemini-1 (silent > 45 min): anyone may take it.
- **Stale claim** `S-19` held by codex-1 (silent > 45 min): anyone may take it.
- **Waiting for verification** `task:sweep-docs` by codex-2.
- **Waiting for verification** `task:audit-db-migrations` by claude-finance.
- **Waiting for verification** `S-12` by opencode-1.
- **Waiting for verification** `S-44` by claude-finance.
- **Waiting for verification** `task:alumni-events-hardening` by antigravity-1.
- **Waiting for verification** `S-47` by claude-finance.
- **Waiting for verification** `task:merge-recovery` by codex-2.
- **Waiting for verification** `S-48` by claude-finance.
- **Waiting for verification** `S-50` by claude-finance.
- **Waiting for verification** `S-51` by claude-finance.
- **Waiting for verification** `S-56` by claude-finance.
- **Waiting for verification** `task:alumni-events-release-remediation` by antigravity-1.
- **Waiting for verification** `S-22` by claude-finance.
- **Waiting for verification** `S-54` by claude-finance.
- **Waiting for verification** `S-49` by claude-finance.
- **Waiting for verification** `task:locale-batch-1` by claude-finance.
- **Waiting for verification** `S-14` by opencode-1.
- **Waiting for verification** `S-46` by claude-finance.
- **Waiting for verification** `S-57` by claude-finance.
- **Waiting for verification** `task:hub-page-lock-granularity` by claude-finance.
- **Waiting for verification** `S-33` by claude-finance.
- **Waiting for verification** `S-45` by claude-finance.
- **Waiting for verification** `S-36` by claude-finance.
- **Waiting for verification** `S-34` by claude-finance.
- **Waiting for verification** `S-26` by claude-finance.
- **Rejected** `task:attendance-integration` (by claude-1): Could not re-run the proof, so this needs a verifier with the branch checked out. The deliverable lives on integration/attendance-on-student-directory @ 3b1f50d
