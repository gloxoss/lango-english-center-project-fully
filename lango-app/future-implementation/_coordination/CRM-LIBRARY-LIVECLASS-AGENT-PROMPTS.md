# Copy-Paste Planning Prompts

## Agent 1 — Lead CRM and Broadcast Messaging

```text
Plan Lead CRM and Broadcast Messaging from the repository's current real state.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

Read completely, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. future-implementation/_coordination/CRM-LIBRARY-LIVECLASS-WAVE.md
3. future-implementation/lead-crm-and-broadcast-messaging/LEAD-CRM-AND-BROADCAST-MESSAGING.md
4. future-implementation/lead-crm-and-broadcast-messaging/BULK-SMS-EMAIL-ADDENDUM.md
5. future-implementation/lead-crm-and-broadcast-messaging/.implementation-plan/PLAN.md

Verify the code before planning. CRM is partially real and duplicated across admissions/crm routes and real/fake UI paths. Broadcast pages are mostly config-array mockups; SMS is simulated and the notification outbox has no email/SMS drainer.

Write a repository-verified execution plan to:
future-implementation/lead-crm-and-broadcast-messaging/.implementation-plan/EXECUTION-PLAN.md

It must define current-state inventory, canonical inquiry service/API migration, fake UI removal, follow-up/activity model, assignment/conversion safety, signed lead ingestion, broadcast schema, existing SMS/notification migration, encrypted provider secrets, template versions, segment/audience adapters, guardian routing, consent/suppression, campaign snapshot lifecycle, PostgreSQL outbox worker, provider/webhook state machines, birthday deduplication, API/pages, permissions, migrations, rollback, exact files, atomic phases and live tests.

Plan CRM completion before Broadcast. Plan email before one Morocco-capable SMS provider; defer other channels. Sending must never happen inside the campaign request. Never run drizzle-kit generate. Do not implement until the execution plan has been checked against the dirty worktree.
```

## Agent 2 — Library Management

```text
Plan the Library Management add-on from the current repository state.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

Read completely, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. future-implementation/_coordination/CRM-LIBRARY-LIVECLASS-WAVE.md
3. future-implementation/library-management/LIBRARY-MANAGEMENT-ADDON-PLAN.md
4. future-implementation/library-management/.implementation-plan/PLAN.md

Inspect the existing mock catalog, identity/student/guardian models, Finance, Communication, Attachments, permissions and migration state. Do not confuse the academic resource library with physical library circulation.

Write:
future-implementation/library-management/.implementation-plan/EXECUTION-PLAN.md

Include the verified current state; full record/edition/copy/member/policy/loan/hold/transfer/stocktake/charge model; state machines; PostgreSQL constraints; policy precedence and closure calculation; transaction locking/idempotency; return-to-next-hold allocation; Finance/Communication/Attachments adapters; server-pagination APIs; pages; imports; permissions; migrations/rollback; exact files; phased execution and concurrency/privacy tests.

Physical copies and immutable circulation events are binding. Do not create duplicate identities, generic file storage or a competing Finance ledger. Remove mock catalog data only once real endpoints exist. Never run drizzle-kit generate. This agent owns Library services that the Librarian Portal must later reuse.
```

## Agent 3 — Librarian Portal

```text
Plan the Librarian Portal as a restricted projection over Library Management.

Do not start until Library Management phases A-D and their stable service contracts exist.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

Read completely, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. future-implementation/_coordination/CRM-LIBRARY-LIVECLASS-WAVE.md
3. future-implementation/librarian-portal/LIBRARIAN-PORTAL-PLAN.md
4. future-implementation/librarian-portal/.implementation-plan/PLAN.md
5. Library Management PLAN.md and EXECUTION-PLAN.md

Inspect the hardcoded librarian portal and the implemented Library services. Write:
future-implementation/librarian-portal/.implementation-plan/EXECUTION-PLAN.md

Define role/capability/branch assignment, canonical portal route, fake data removal, service reuse map, home/circulation/holds/transfers/stocktake pages, safe member projections, forbidden fields, enumeration controls, overrides/audit, shared-desk auto-lock, add-on disable behavior, exact files and adversarial tests.

Do not build a second library backend. A designation never grants permissions. If the Library service contract is missing, mark the dependency and finish planning without inventing replacement circulation logic.
```

## Agent 4 — Live Classrooms

```text
Plan Live Classrooms from the current repository and real provider constraints.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

Read completely, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. future-implementation/_coordination/CRM-LIBRARY-LIVECLASS-WAVE.md
3. future-implementation/live-classrooms/LIVE-CLASSROOMS-ADDON.md
4. future-implementation/live-classrooms/REFERENCE-TOOLS-AND-REPOSITORIES.md
5. future-implementation/live-classrooms/.implementation-plan/PLAN.md

Inspect the mock Live Classes/Reports pages, academic offering/subject/teacher/timetable services, attendance registers, Attachments, instrumentation worker pattern, entitlement/permissions and secret-handling gaps.

Write:
future-implementation/live-classrooms/.implementation-plan/EXECUTION-PLAN.md

Include a mandatory provider/compliance spike and ADR; verified BigBlueButton API/event/recording questions; fake and BBB adapter contracts/capabilities; encrypted profile design; session saga/idempotency/repair; academic authorization and conflicts; short-lived join credentials; webhook signature/replay processing; participant interval algorithm; reviewed attendance posting; recording consent/retention; APIs/pages/workers; migrations/rollback; exact files; phases and live/fake-provider tests.

Do not build a WebRTC media server or treat the mock video grid as implementation. If no real sandbox is available, label the external integration unverified while planning internal work. Never run drizzle-kit generate.
```

