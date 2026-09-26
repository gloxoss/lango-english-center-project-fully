# SchoolOS — Shared Project Context for All Agents

## Mission

SchoolOS is a multi-tenant Moroccan school-management platform. The audit is not a superficial screenshot review and not a ticket-closing exercise. The purpose is to make every assigned page/workflow truthful, secure, usable, connected to real data, and consistent with the real school lifecycle.

The working philosophy is:

> **Understand the page and its business workflow first. Audit it visually, functionally, technically, and securely. Fix confirmed defects. Prove the result with tests and runtime evidence.**

## Non-negotiable invariants

### 1. Tenant isolation

SchoolOS uses shared-database row-level tenancy.

- Never trust a client-supplied `tenantId`.
- Resolve tenant context from the authenticated server session.
- Every tenant-scoped query/mutation must include the active tenant filter.
- Cross-tenant reads, writes, IDOR, lookups, joins, exports, and counters must be rejected or scoped correctly.
- Branch/campus scoping must be preserved wherever the feature is branch-aware.

### 2. Permission truth

For every page and action, reconcile all of these:

- sidebar/navigation visibility;
- server page guard;
- API role/capability guard;
- add-on/entitlement requirement;
- object/tenant ownership;
- branch/campus visibility;
- read vs write capability.

A hidden navigation item is not security. An API 403 is not a good user flow if the UI promised access. The page, navigation, capability model, and API must agree.

### 3. Moroccan domain truth

Do not invent foreign defaults when SchoolOS has Moroccan domain rules.

Examples:

- grades use the Moroccan `/20` model;
- filières/cycles/academic terminology must remain domain-correct;
- Massar identifiers and institutional matricules are distinct;
- Moroccan phones follow `+212`, `06`, `07` conventions;
- finance/payroll logic must respect the existing Moroccan accounting/payroll engine;
- dates and "today" logic must use the project's Moroccan/Casablanca business-day semantics where required.

Never silently replace domain rules with generic SaaS assumptions.

### 4. Data truth

- No invented records or fake arrays in production UI.
- No magic fallback values that pretend configuration/data exists.
- No fake success states.
- Empty, unavailable, unconfigured, forbidden, and failed states must be honest.
- Historical financial/academic/attendance records must not be destructively rewritten just to make tests green.
- Existing identifiers and audit history must be preserved unless the assigned migration explicitly requires otherwise.

### 5. UI reality

SchoolOS uses a calm, operational admin design system.

- Primary brand blue: `#2487B8`.
- Prefer clear cards/tables, restrained borders, no fake decorative data.
- Interactive controls must work; no dead buttons.
- Empty states must explain what is missing and provide a truthful next action when one exists.
- Loading, success, error, disabled, forbidden, empty, and destructive states must be handled.
- Mobile must be usable, not merely shrink to fit.

### 6. FR / EN / AR and RTL

SchoolOS is tri-lingual.

- User-facing strings belong in `fr`, `en`, and `ar` locale dictionaries.
- Arabic must render RTL correctly.
- Prefer logical CSS/Tailwind direction utilities (`ms`, `me`, `ps`, `pe`, `text-start`, `text-end`) over physical left/right assumptions.
- ICU/plural messages must be syntactically valid.

### 7. Audit trail and privacy

Sensitive actions must preserve the application's audit-trail and privacy model.

Check whether the workflow should record:

- actor/user;
- tenant;
- action;
- timestamp;
- relevant entity;
- safe metadata without leaking sensitive data.

Do not log secrets, credentials, RIB values, passwords, tokens, or unnecessary PII.

### 8. Safe migration behavior

- Migrations must be sequential and journaled.
- Do not reuse an occupied migration number.
- Do not delete historical rows merely to satisfy a new uniqueness rule when a non-destructive supersession/status strategy is possible.
- Fresh database path and replay/idempotency must be considered when the project convention requires it.
- Do not modify historical migration files casually.

### 9. VPS / deployment safety

Never run heavy production builds on the low-memory VPS host. Build/deployment is a separate controlled pipeline. Page-audit agents normally work locally/in dedicated worktrees and must not deploy unless explicitly assigned.

## Page-audit dimensions

For every assigned page/workflow, evaluate:

1. **Purpose** — What job is this page supposed to complete?
2. **Users** — Which roles should/should not access it?
3. **Entry points** — Sidebar, dashboard shortcut, deep link, redirect, notification, parent/teacher portal.
4. **Data source** — Real API/DB/service? Correct tenant/branch scope?
5. **Normal workflow** — Can the user complete the intended job end to end?
6. **Edge states** — Empty, loading, error, forbidden, unconfigured, stale data, deleted relation, duplicate action.
7. **Security** — Capability, IDOR, cross-tenant, branch leakage, mass assignment, unsafe params.
8. **Business logic** — Domain state transitions, totals, statuses, idempotency, concurrency, date/time semantics.
9. **UX** — Clear hierarchy, wording, CTA truth, confirmations, destructive actions, feedback.
10. **Visual quality** — Desktop, mobile, RTL, overflow, tables/cards/modals.
11. **Localization** — FR/EN/AR parity and ICU correctness.
12. **Auditability** — Correct audit log behavior where required.
13. **Tests** — Existing tests still pass; add focused tests for new defects/invariants.
14. **Regression risk** — What frozen/shared workflows could this change affect?

## Quality gates

Use the project's real scripts from the current branch. Expected core gates include:

```bash
npm run check:types
npm run check:isolation
npm run check:i18n
npm run check:ui
```

Run focused Vitest suites for the touched domain. Do not spam the full repository suite after every small edit; run the broader suite at the end of the assigned campaign when appropriate.

## Frozen-module rule

A frozen module may be read to understand dependencies, but do not modify it unless the assigned task explicitly authorizes an unfreeze. If a new contradiction is found in a frozen module:

1. reproduce it;
2. document exact evidence;
3. mark it as a release-blocker candidate;
4. do **not** fix it until the orchestrator authorizes unfreezing.

## Source of truth order

When states disagree, prefer:

1. current remote target/assigned branch and exact commit;
2. live Hub task state;
3. real DB/runtime behavior;
4. committed tests and migration journal;
5. screenshots/reports;
6. stale local worktree notes.

Never conclude a merged fix is absent from a stale local tree without checking the actual remote target ref first.
