# Next-Wave Agent Coordination Plan

## Sequence

1. **Agent HR** completes Advanced HR first. It owns the evolution of `employeeProfiles` and employee identity services.
2. **Agent Inventory** may run in parallel with HR. It owns Inventory feature files and coordinates only Finance integration contracts.
3. **Agent Hostel** begins after HR's stable employee-profile API/schema lands. Implement phases 0–3 for v1.
4. **Agent Guard** begins after HR. Its core work may run alongside Hostel, but Hostel handoff integration waits until Hostel phase 2 APIs are stable.

## Shared-file collision protocol

Each agent must inspect `git status --short` before touching shared files. Only one designated integration agent edits each of these at a time:

- `migrations/meta/_journal.json`
- `src/models/Schema.ts`
- `src/libs/api/permissions.ts`
- `src/addons/registry.ts`
- `src/components/shared/sidebar.tsx`
- `package.json` / lockfile

Feature agents build schema/routes/UI in feature folders first, then send the integration agent the exact export, permission, registry, sidebar and migration entries required. Migration numbers are assigned immediately before merge from the actual current highest number; the present observed highest is `0072`, but this is not a reservation.

## Ownership

| Agent | Exclusive feature paths | Shared dependencies |
|---|---|---|
| HR | `src/features/hr/**`, new advanced HR routes/pages | existing payroll, leave, employee self-service, Better Auth |
| Inventory | `src/features/inventory/**`, inventory routes/pages | Finance invoices/payments/expenses |
| Hostel | `src/features/hostel/**`, hostel routes/pages | HR employees, academic placements, Finance, Attachments |
| Guard | `src/features/guard/**`, guard routes/page | badges/scanners, students/guardians, HR, optional Hostel |

## Global completion gate

No agent self-certifies from code inspection. Each must provide captured exit codes for migration and app builds, live HTTP evidence, PostgreSQL invariants, two-tenant adversarial checks, `npx tsc --noEmit`, and `npx tsx scripts/check-tenant-isolation.ts`. Test add-on disabled behavior and preserve unrelated dirty-worktree changes.

