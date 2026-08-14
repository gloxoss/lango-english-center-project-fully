# Cross-module remediation plan

## Goal
Remediate Role Portals, Parent/Guardian Portal, Live Classrooms, Student Transport, and Library Management; verify security, tenant isolation, migrations, UI routes, production build, and Docker Compose runtime.

## Phases
- [x] Phase 1: Establish baseline, repository constraints, and focused failing tests
- [x] Phase 2: Fix Role Portals ↔ Parent relationship authorization boundary
- [x] Phase 3: Complete audited Parent/Guardian security, home, finance, announcements, messaging, and evidence-upload findings
- [x] Phase 4: Harden Live Classrooms webhooks and provider isolation
- [x] Phase 5: Add Transport page authorization and browser-facing hardening
- [ ] Phase 6: Implement the complete Library Management roadmap (operational core and portal delivered; taxonomy CRUD, full management pages, member holds UI, CSV/export and finance-post adapter remain)
- [x] Phase 7: Run focused and global verification gates
- [x] Phase 8: Docker Compose build, launch, health checks, and handoff

## Working rules
- Preserve unrelated concurrent/user changes.
- Use tenant-derived context; never accept tenant identity from payloads.
- Add behavior tests before each security or lifecycle correction.
- Do not claim completion for placeholder or mock-backed UI.
- Do not weaken an existing authorization or database constraint to make tests pass.

## Errors encountered
| Error | Attempt | Resolution |
|---|---:|---|
| None yet | 0 | — |
| Portal authorization patch did not match a mojibake comment | 1 | Reapply against stable import/query tokens only |
| Combined portal test + global tsc timed out without output | 1 | Split focused tests and compiler into independent gates |
| Standalone global tsc exceeded 184-second wrapper limit | 2 | Run a longer isolated compiler gate after the library slice; use focused tests meanwhile |
