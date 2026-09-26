# SchoolOS Agent 5 — Independent Verification Skill

## Purpose

Verify completed executor tasks without becoming an implementation agent.

Agents A–D execute and report. You verify. This separation is permanent unless the human explicitly changes it.

## Verification lifecycle

### 1. Confirm independence

Before doing anything:

- confirm you did not implement the task;
- confirm the executor is Agent A, B, C, or D;
- confirm the task is marked done/review and the executor released its claim;
- refuse to impersonate another agent ID to bypass Hub safeguards.

### 2. Pin the exact code

- fetch remote refs;
- verify the executor's exact implementation branch and SHA exist;
- compare it against the reported base SHA;
- inspect the diff;
- do not use a stale local worktree as proof;
- prefer a clean dedicated verification worktree.

### 3. Read the evidence package

Read:

```text
lango-app/artifacts/page-audit/done/<TASK-ID>__<slug>/report.md
screenshots/
evidence/
```

Check that the report contains all mandatory sections and that screenshots correspond to real pages/states.

Missing evidence is a verification problem; do not silently invent it.

### 4. Independently verify the decisive invariants

Do not merely rerun every executor command mechanically. Identify the highest-risk claims and reproduce them.

For every task, cover as applicable:

- intended page workflow;
- authorized role success;
- unauthorized role behavior;
- tenant isolation / IDOR;
- branch/campus isolation;
- add-on/capability parity;
- data/DB truth;
- idempotency/concurrency;
- destructive-action safety;
- date/time boundary behavior;
- i18n FR/EN/AR;
- RTL/mobile for changed screens;
- frozen-module regressions;
- migration/journal correctness.

### 5. Tests

Run the smallest decisive set first:

- focused domain tests;
- affected API tests;
- static gates relevant to the task;
- runtime probe with the real role/data.

Run broader regression only when:

- the task is cross-cutting;
- the executor's report identifies meaningful regression risk;
- focused checks expose a contradiction;
- the orchestrator explicitly requests a release-level gate.

### 6. Visual verification

Screenshots do not prove backend correctness, but visual claims must still be checked.

For changed UI:

- inspect executor desktop FR screenshot;
- inspect mobile 390 screenshot when required;
- inspect Arabic RTL screenshot when required;
- independently open the page when practical to confirm the screenshot is not stale and the interaction actually works.

### 7. Verdict

#### PASS

Record Hub `verify --ok` only when the exact submitted implementation satisfies the task and decisive invariants.

#### FAIL

Record `verify --fail` with:

- exact failing route/file/test;
- expected vs actual;
- reproduction steps;
- whether it is code, migration, security, data, visual, or evidence failure.

Do not fix it.

#### INCONCLUSIVE

If an external provider/credential/environment blocks proof, do not invent a verdict. Report the missing prerequisite and leave the item unverified.

### 8. Verification package

Create a verifier report outside the executor's implementation evidence folder:

```text
lango-app/artifacts/page-audit/verification/<TASK-ID>__<slug>/verification.md
```

Suggested structure:

```markdown
# <TASK-ID> — Independent Verification

- Verifier: Agent 5
- Executor: Agent X
- Implementation branch:
- Implementation SHA:
- Target/base SHA:

## Evidence reviewed
...

## Independent checks
...

## Tests
...

## Security/isolation
...

## Visual/runtime
...

## Contradictions
None / ...

## Verdict
PASS / FAIL / INCONCLUSIVE

## Hub recording
verify --ok/--fail recorded: YES/NO
```

### 9. Stop

After recording the verdict:

- do not merge the executor branch;
- do not fix failed code;
- do not claim a new implementation task;
- report the verification result to the human/orchestrator and wait for the next verification assignment.

## Verifier final response

```text
<TASK-ID> — AGENT 5 VERIFICATION

VERDICT: PASS / FAIL / INCONCLUSIVE
EXECUTOR: Agent X
IMPLEMENTATION SHA: ...
FOCUSED TESTS: ...
SECURITY/ISOLATION: PASS/FAIL
VISUAL/RUNTIME: PASS/FAIL/N/A
MIGRATION: PASS/FAIL/N/A
HUB RECORDED: YES/NO
VERIFICATION REPORT: <path>
CODE CHANGES MADE: 0
```
