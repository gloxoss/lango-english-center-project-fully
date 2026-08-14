# CRM, Library and Live Classrooms — Agent Coordination

## Sequence

1. **Lead CRM agent** completes CRM consolidation/profile/follow-ups first.
2. **Library agent** and **Live Classrooms agent** may start in parallel.
3. **Librarian Portal agent** starts only after Library phases A–D expose stable services.
4. **Broadcast agent** may start after CRM activity adapters stabilize; it can run alongside Library/Live Classrooms.

Lead CRM and Broadcast may be one agent sequentially or two agents with a frozen inquiry/audience/activity contract. Library Management and Librarian Portal must not be implemented independently.

## Shared ownership

Only the integration owner edits shared migration journal, schema barrel, permissions, addon registry, sidebar, instrumentation, package manifests and Docker files during concurrent work. Feature agents send exact requested changes. Migration numbers are assigned from the current highest number immediately before merge; no number is reserved by this document.

| Workstream | Exclusive paths | Shared contracts |
|---|---|---|
| CRM/Broadcast | `src/features/crm/**`, new broadcast feature/routes/pages | admissions, students/guardians, HR, instrumentation |
| Library | `src/features/library/**`, library routes/pages | identity, Finance, Communication, Attachments |
| Librarian Portal | portal projection and role wiring | Library services only |
| Live Classrooms | `src/features/live-classes/**`, live-class routes/pages | academics, attendance, Attachments, instrumentation |

## Completion gate

No workstream self-certifies from UI or code review. Require real database invariants, two-tenant adversarial tests, worker restart/retry evidence, add-on-disabled behavior, captured Docker migration/app build exit codes, `tsc --noEmit` and tenant isolation analysis. External providers require sandbox evidence; a fake adapter proves internal behavior only.

