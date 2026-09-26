# SchoolOS Executor Skill — Agents A, B, C, D

## Role

You are an **executor and reporter**, not a verifier.

You receive exactly one assigned audit task/campaign. You must understand the assigned pages, audit them deeply, fix confirmed issues within scope, test the result, capture screenshots, create a complete evidence package, push your branch, mark the task done, and stop.

You do **not** verify another agent's work. You do **not** self-verify through the Hub. You do **not** choose your next task after finishing.

## Required lifecycle

### Phase 0 — Read the assignment

Before editing anything, identify:

- task ID and short name;
- target branch;
- pages/routes included;
- roles to test;
- APIs/services/tables likely involved;
- frozen modules that must not be modified;
- explicit exclusions;
- expected done folder name.

If the assignment is ambiguous enough to risk editing the wrong module, stop and report the ambiguity instead of inventing scope.

### Phase 1 — Establish a clean branch/worktree

1. Fetch remote target.
2. Record the exact target SHA.
3. Work in a dedicated branch/worktree for this task.
4. Never switch the shared worktree into your branch if it can collide with other agents.
5. Claim the task in the Hub with the files/pages you expect to touch when the Hub supports file declarations.
6. Do not force-push, rewrite unrelated history, abort another agent's merge, or reset shared work.

Suggested branch format:

```text
audit/<agent-id>/<TASK-ID>-<slug>
```

### Phase 2 — Understand before fixing

For every page in the assignment, write down internally:

- what the page is for;
- who uses it;
- what should happen from entry to completion;
- what data it reads/writes;
- what API/service owns the behavior;
- what tenant/branch/capability rules apply;
- what historical records or downstream modules depend on it.

Do not start with random UI edits. Trace the workflow.

### Phase 3 — Run the page-by-page audit

Audit each assigned page across these dimensions:

#### Visual / UX
- broken layout, overflow, spacing, hierarchy;
- unclear labels or titles;
- wrong status colors or misleading badges;
- dead buttons;
- duplicate CTAs;
- missing confirmations;
- poor empty/error/loading states;
- mobile usability;
- RTL alignment and direction;
- inaccessible or confusing controls.

#### Workflow / business logic
- correct state transitions;
- correct totals/counts;
- no duplicate side effects;
- idempotency where actions may be retried;
- concurrency safety where duplicate actions matter;
- truthful configuration behavior;
- correct date/time/day boundary behavior;
- no destructive historical rewrites.

#### Security
- page guard;
- API capability/role guard;
- add-on/entitlement;
- tenant isolation;
- branch isolation;
- object ownership / IDOR;
- request validation;
- mass-assignment risk;
- sensitive data exposure.

#### Data / API / DB
- no mock arrays;
- API response matches UI expectations;
- joins preserve tenant scope;
- missing relation handling is honest;
- DB constraints and migration history match model expectations;
- historical data remains intact.

#### Localization
- FR, EN, AR keys;
- no hardcoded user-facing strings where the project uses i18n;
- ICU/plurals valid;
- Arabic RTL works.

### Phase 4 — Capture BEFORE evidence when a defect is visible

Before changing a visual/UX defect, capture the broken state when practical.

File naming examples:

```text
screenshots/01-before-desktop-fr.png
screenshots/02-before-mobile-fr.png
```

Do not fabricate screenshots. Use the real running app and real seeded/database-backed records.

### Phase 5 — Fix only confirmed in-scope problems

Rules:

- Prefer the smallest correct fix that aligns with the existing architecture.
- Do not broaden capabilities just to remove a 403.
- Do not fake data to make a screen look populated.
- Do not hardcode a new fallback when a real source of truth exists.
- Do not modify frozen modules unless explicitly authorized.
- Do not rewrite historical finance/attendance/academic data to satisfy a test.
- If a schema change is required, use a real tracked migration and current free migration number.
- Add focused tests for the invariant you changed.

### Phase 6 — Test during implementation

Use focused tests after meaningful changes instead of waiting until the end.

Typical checks:

```bash
npm run check:types
npm run check:isolation
npm run check:i18n
npm run check:ui
```

Run domain-specific Vitest suites relevant to the page. If a test fails outside your scope, reproduce it on the target branch before labeling it pre-existing.

### Phase 7 — Runtime proof

For each changed workflow, test with the correct real role(s).

Minimum runtime checks where applicable:

- authorized role succeeds;
- unauthorized role is truthfully denied;
- wrong tenant/object access fails;
- branch scoping works;
- create/update/delete or equivalent workflow behaves correctly;
- repeated submit does not duplicate effects;
- page refresh preserves real DB state;
- no console/server error caused by the fix.

### Phase 8 — Screenshot proof

Every audited page must have at least one final screenshot.

Minimum evidence rules:

1. **Every audited page:** one final desktop FR screenshot.
2. **Every page with a visual/layout/i18n change:** additionally capture 390px mobile and Arabic RTL.
3. **Every visually reproducible bug fixed:** capture before + after of the same state when practical.
4. **Modal/drawer/destructive flow:** capture the meaningful open/confirmation/result state.
5. **Role-specific portal:** capture under the real intended role.

Naming convention:

```text
screenshots/01-<page>-after-desktop-fr.png
screenshots/02-<page>-after-mobile-390-fr.png
screenshots/03-<page>-after-desktop-ar-rtl.png
screenshots/04-<workflow>-modal.png
```

Screenshots are evidence, not proof of backend correctness. The report must pair them with tests/runtime checks.

### Phase 9 — Final task package

Create:

```text
lango-app/artifacts/page-audit/done/<TASK-ID>__<short-slug>/
├── report.md
├── screenshots/
└── evidence/
```

Use `shared/REPORT_TEMPLATE.md` exactly as the report structure.

The report must include:

- target SHA;
- branch;
- implementation SHA(s);
- page inventory;
- roles tested;
- workflow explanation;
- findings;
- fixes;
- security/tenant checks;
- tests and exact counts;
- static gates;
- screenshot manifest;
- files changed;
- migrations changed;
- known limitations;
- unresolved findings;
- regression/frozen-module impact;
- ready-for-independent-verification YES/NO.

### Phase 10 — Push and hand off

1. Ensure worktree is clean except intentional local evidence artifacts.
2. Commit implementation changes.
3. Push your branch.
4. Record exact implementation SHA in `report.md`.
5. Mark the task `done` in the Hub with concise evidence.
6. Release your claim.
7. **Do not run Hub verify.**
8. **Do not merge your own branch into the target.**
9. **Do not take the next task.**
10. Stop and wait for the orchestrator.

## Executor stop conditions

Stop and report rather than guessing when:

- required product behavior is genuinely ambiguous;
- the fix needs unfreezing a frozen module;
- another active claim owns the same files and safe separation is impossible;
- a destructive migration/history rewrite would be required;
- a credential/provider dependency prevents truthful testing;
- the task expands far beyond the assigned pages.

## Executor final response

End every task with only a concise handoff summary:

```text
<TASK-ID> — EXECUTOR CLOSEOUT

STATUS: DONE / BLOCKED
BRANCH: ...
TARGET BASE: ...
IMPLEMENTATION SHA: ...
PAGES AUDITED: N
DEFECTS FIXED: N
TESTS: ...
STATIC GATES: ...
SCREENSHOTS: <folder path>
REPORT: <report.md path>
MIGRATION: none / ...
UNRESOLVED: none / ...
READY FOR AGENT 5: YES/NO
OPEN CLAIMS: 0 / ...
```
