# Employee Self-Service Portal — Implementation Plan

> Read `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` FIRST. Read the source spec `EMPLOYEE-SELF-SERVICE-PORTAL-PLAN.md` in this same folder — it's a terse outline, not a fully fleshed-out spec like some other future-implementation docs; this plan fills in the missing detail. Read this plan's §1 before anything else — the real starting point is different from what the source doc implies.

## 1. Critical correction: this page already exists, and it's entirely fake

`src/app/[locale]/(dashboard)/dashboard/hr/self-service/page.tsx` already renders `<EmployeePortalView />` (`src/features/crm/ui/employee-portal-view.tsx`, 279 lines). It is **100% hardcoded** — `WEEK_PLANNING`, `RECENT_ATTENDANCES_EMPLOYEE`, `LEAVE_REQUESTS`, `PAYSLIPS`, `PERSONAL_DOCUMENTS` are static arrays, zero `fetch`/`useEffect`, zero API calls. This is the exact same "real page, fake data" pattern this session has found and fixed repeatedly elsewhere in this app. **This plan is a rebuild-in-place of an existing page, not a greenfield build** — same discipline as the attendance-qr-enhancement plan's correction to its own source doc.

Also worth noting: this component currently lives under `src/features/crm/ui/` — the wrong feature directory (self-service isn't CRM). Move it to a proper `src/features/hr/ui/` (or `src/features/employee-self-service/ui/` if HR already means something admin-facing and distinct) location as part of this rebuild, not left where a prior pass happened to drop it.

## 2. What's already real and directly reusable — the backend is closer to done than the source doc assumes

Real HR/Payroll schema already exists, confirmed column-by-column:
- `employeeProfiles` (`cnssNumber`, `amoNumber`, `bankRib`, `contractType`, `dependantsCount`, unique per `(tenantId, userId)`).
- `leaveCategories` / `employeeLeaveBalances` / `leaveRequests` (full request lifecycle: `status` pending/approved/rejected, `reviewedById`, `reviewedAt`, `reason`).
- `payrollPeriods` / `payrollRunLines` / `payslips` (immutable, `payslips` unique per `runLineId` — matches the source doc's "Payslips are immutable published snapshots" requirement exactly, already true at the schema level).
- `workforcePunchEvents` (this session's attendance-qr-enhancement work) — `employeeId`, `punchType` (`in`/`out`), `scannedAt`, `deviceId`.

**More importantly**: the existing admin-facing routes already implement the exact self-scoping logic this feature needs, just gated the other way around. `src/app/api/hr/payslips/route.ts:18,38-43` and `src/app/api/hr/leave/requests/route.ts:25` both already branch on `const isHrAdmin = ['school_admin', 'accountant'].includes(ctx.role)` and filter non-admins to `eq(payslips.userId, ctx.userId)`. **This means self-service routes should call the exact same underlying query/service logic these admin routes already use, scoped to `context.userId`, not duplicate it.** Where that logic isn't already extracted into a shared function, extract it now (matching this session's established "one real function, both callers use it" discipline) rather than writing a second, parallel implementation that can drift from the admin one.

No generic "employee" role exists (`AppRole` enum has no `employee` value) — confirmed correct per the source doc's own framing: "Employee is a profile/assignment linked to a user, not necessarily a new exclusive role." Self-service access is gated by "does this user have an `employeeProfiles` row," not by role — a teacher, accountant, or receptionist can all be employees simultaneously with their existing role-based permissions.

## 3. Scope decision

The source spec lists 9 journeys (Home, Profile, Time & Attendance, Leave, Payroll, Advances/Awards, Documents, Requests/Help, Security/Preferences). Building all 9 to full depth in one pass would be attachments-book-scale work. Match the source doc's own stated delivery order (§"Delivery", 5 phases) and build v1 as: **Home + Profile + Leave + Time/Punch + Payslips** (source doc's phases 1-4), since those map directly onto schema that's already fully real. **Defer Advances/Awards, Documents (beyond payslip PDFs), Requests/Help ticketing, and Security/Preferences (2FA/notification prefs) as documented follow-up** — Advances/Awards and a generic HR-case ticketing system have no backing schema at all yet and would each be a real sub-feature of their own; building them as an afterthought inside this pass would produce the same shallow-stub quality this plan exists to replace.

## 4. Identity resolution — one real helper, reused everywhere

New `src/features/hr/services/employee-context.ts`:
```ts
export async function resolveEmployeeContext(tenantId: string, userId: string) {
  const [profile] = await db.select().from(employeeProfiles)
    .where(and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.userId, userId))).limit(1);
  if (!profile) throw new ApiError(403, 'NOT_AN_EMPLOYEE', 'Aucun profil employé associé à ce compte.');
  return profile;
}
```
Every `/api/employee/me/*` route calls this first (after `requireRequestContext(req)` with no role restriction — any authenticated role may have an employee profile — and `requireTenant`), matching the source doc's stated identity model. A user with no `employeeProfiles` row gets a clean 403, not a page full of empty states pretending they're an employee.

## 5. API surface (`/api/employee/me/*`, matching the source doc's route family)

- `GET /api/employee/me/home` — aggregate: today's schedule (reuse whatever real class/timetable-slot query already backs the teacher-facing schedule view, if the employee is a teacher), current punch state (latest `workforcePunchEvents` row for this user, `in` with no matching later `out` = currently clocked in), leave balance summary, latest payslip, upcoming document expirations (skip if Documents is deferred per §3).
- `GET /api/employee/me/profile`, `PATCH /api/employee/me/profile` — permitted fields only (name/contact/emergency contact); `bankRib`/tax-relevant fields require a distinct confirmation step (re-enter password or similar) per the source doc's "bank/tax changes require reauthentication and approval" — don't allow a bare PATCH to silently change bank details.
- `GET /api/employee/me/leave`, `POST /api/employee/me/leave` (create a `leaveRequests` row, `status: 'pending'`), `POST /api/employee/me/leave/[id]/cancel` (only while still `pending`) — reuse the exact eligibility/balance-checking logic the admin leave-approval route already has, if any exists; if the admin route only lists/approves without validating balance server-side, add that check now since a self-service request path is exactly where it starts to matter.
- `GET /api/employee/me/time` — own `workforcePunchEvents` history + derived work-session summary (reuse whatever session-calculation logic exists from the attendance-qr-enhancement work, if any was built — check before writing a second implementation).
- `GET /api/employee/me/payroll` — own `payslips` list + the underlying `payrollRunLines` figures needed for "payment state, annual summaries" (net salary, employer/employee contributions) — never expose `calculationSnapshot`'s full internal breakdown unless the source doc's "explanations" requirement specifically wants line-item detail; if so, render it read-only from the immutable snapshot, never recompute.
- `GET /api/employee/me/payroll/[payslipId]/download` — serves the real PDF via `payslips.pdfStorageKey` (check whether payslip PDF generation is real yet — if `pdfStorageKey` is never populated by anything, that's a real gap to flag, not silently work around).

Every route: `requireRequestContext(req)` (no role restriction) → `requireTenant` → `resolveEmployeeContext` → tenant- and self-scoped query only, following the shared reference doc's route convention exactly.

## 6. UI

Rebuild `EmployeePortalView` (relocated per §1) as a real, `fetch()`-driven page matching the shared UI system doc's conventions — KPI banner (leave balance, latest payslip amount, clock-in state), tabbed or sectioned layout for Home/Profile/Leave/Time/Payroll (a single page with in-page sections is fine for v1's scope; don't split into 5 separate routes unless the content genuinely doesn't fit one page). Every list is real `fetch()` data; every empty state is a real "no data yet" message, not a static array masquerading as one.

## 7. Acceptance checklist (live-verify, no self-reporting)

- [ ] A logged-in user with no `employeeProfiles` row gets a clean 403 on every `/api/employee/me/*` route, and the UI shows a real "not an employee" state, not a broken page.
- [ ] Two different real employees (different `userId`s) each see only their own leave requests, payslips, and punch history — verified live with two real sessions, not by code review.
- [ ] A self-service leave request created via the API appears in the existing admin leave-approval view (confirms the shared-logic reuse in §5 actually connects both sides, not two disconnected data paths).
- [ ] A payslip PATCH attempt (there shouldn't be one — payslips are immutable) and a bare profile PATCH attempting to change `bankRib` without the reauth step are both rejected.
- [ ] Cross-tenant sweep: an employee from tenant A cannot resolve or act on tenant B's employee-profile-linked data via any of these routes, even by guessing a real `userId`/`payslipId` from the other tenant.
- [ ] `tsc --noEmit` and `check-tenant-isolation.ts` both clean (same 3-file baseline).
