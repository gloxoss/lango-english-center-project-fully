# Copy-Paste Execution Prompts

## Agent 1 — Advanced HR

```text
Implement Advanced HR & Employee Management from the repository's current real state.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

Read, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. future-implementation/_coordination/NEXT-WAVE-AGENT-PLAN.md
3. future-implementation/human-resources-employee-management/HUMAN-RESOURCES-EMPLOYEE-MANAGEMENT.md
4. future-implementation/human-resources-employee-management/.implementation-plan/PLAN.md

The source specification is outdated: HR/payroll/leave/self-service and an employeeProfiles table already exist. Extend and migrate them; do not create parallel employee, leave, payroll, or self-service systems. Complete every phase in the corrected implementation plan, preserve existing IDs/data, and prove backward compatibility live.

You own HR feature files. Before touching any shared file listed in the coordination plan, inspect git status and coordinate rather than overwriting concurrent edits. Assign the migration number from the actual current highest migration immediately before integration; never run drizzle-kit generate.

Finish with real Docker build/migrate, migration rerun, existing-staff backfill checks, no-login employee and later-linking tests, offboarding/login tests, sensitive-field response audits, two-tenant tests, tsc and tenant-isolation analysis. Report evidence, not confidence.
```

## Agent 2 — Inventory

```text
Implement Inventory Management as an optional add-on.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

Read, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. future-implementation/_coordination/NEXT-WAVE-AGENT-PLAN.md
3. future-implementation/inventory-management/INVENTORY-MANAGEMENT.md
4. future-implementation/inventory-management/.implementation-plan/PLAN.md

Use an immutable stock-movement ledger. Do not add editable product stock or a parallel student billing ledger. Student sales integrate with existing invoices/payments; received purchases may link to expenses. All posted changes reverse through compensating movements.

You own Inventory feature paths. Treat Finance schemas/services as shared contracts and preserve concurrent work. Assign migration numbering fresh and never run drizzle-kit generate.

Complete the plan through reporting/reconciliation. Prove concurrent last-unit protection, idempotent receipt/sale/return, exact movement-to-balance reconciliation, real student Finance visibility, cross-tenant foreign-ID rejection, add-on disable safety, Docker builds/migrations, tsc and tenant-isolation analysis.
```

## Agent 3 — Hostel

```text
Implement Hostel Management v1 phases 0-3 only unless explicitly authorized to continue.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

Read, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. future-implementation/_coordination/NEXT-WAVE-AGENT-PLAN.md
3. future-implementation/hostel-management/HOSTEL-MANAGEMENT-ADDON.md
4. future-implementation/hostel-management/REFERENCE-SOLUTIONS-AND-INSPIRATION.md
5. future-implementation/hostel-management/.implementation-plan/PLAN.md

Confirm the Advanced HR employee identity contract is present before schema work. First write the policy/safeguarding ADR from the plan. Then build physical inventory, allocation lifecycle, roll call, leave/return and the Tonight dashboard. Use PostgreSQL exclusion/locking guarantees for bed and student date overlaps; occupancy is derived from allocations.

Do not copy GPL code, duplicate student/guardian/Finance data, turn roll call into academic attendance, or block emergency departure because Finance is unavailable. Assign migration numbering fresh and preserve shared files.

Prove real allocation races, atomic transfers and rollback, out-of-service impact previews, idempotent escalation, guardian/resident privacy, two-tenant/branch isolation, add-on disable safety, Docker builds/migrations, tsc and tenant-isolation analysis.
```

## Agent 4 — Guard Portal

```text
Implement the Guard & Security Portal from the current repository state.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

Read, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. future-implementation/_coordination/NEXT-WAVE-AGENT-PLAN.md
3. future-implementation/guard-security-portal/GUARD-SECURITY-PORTAL-PLAN.md
4. future-implementation/guard-security-portal/.implementation-plan/PLAN.md

The current guard-portal-view.tsx is hardcoded fake UI. Replace it with real services and data. Reuse the existing guard role, HMAC identity badges, scanner devices/sessions and server verification; do not invent another QR credential. Depend on the Advanced HR employee contract, and integrate Hostel handoffs only after Hostel phase 2 is stable.

The portal is a least-privilege gate workspace, never a searchable directory. API responses must exclude academic, Finance, medical, HR and unrelated guardian data. Bind kiosk sessions to tenant/branch/gate/device/operator and prevent replay/double release transactionally.

Complete online phases 1-4. Keep offline manifests/emergency drill automation deferred unless explicitly authorized. Prove expired assignment, wrong gate, revoked/fake/replayed QR, concurrent release, cross-branch/tenant isolation, response-field privacy, kiosk auto-lock, optional-add-on degradation, Docker builds/migrations, tsc and tenant-isolation analysis.
```

