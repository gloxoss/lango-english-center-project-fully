# SchoolOS 5-Agent Audit Operating Model

This package replaces the temporary "agents verify each other" workflow with a stable operating model:

- **Agents A–D are executors/reporters only.** They audit assigned pages/modules, fix confirmed problems, test them, capture screenshots, package evidence, and stop.
- **Agent 5 is the only independent verifier.** It verifies completed executor tasks. It never implements fixes.
- **The human + ChatGPT orchestrator plans the next assignment.** Executors do not self-assign the next module after finishing.

## Core flow

`ASSIGN -> CLAIM -> UNDERSTAND -> PAGE AUDIT -> FIX -> TEST -> SCREENSHOT -> REPORT -> PUSH -> DONE -> STOP -> AGENT 5 VERIFY -> ORCHESTRATOR DECIDES MERGE/FREEZE/NEXT`

## Canonical evidence folder

Every executor must create exactly one task package:

```text
lango-app/artifacts/page-audit/done/<TASK-ID>__<short-slug>/
├── report.md
├── screenshots/
│   ├── 01-...
│   ├── 02-...
│   └── ...
└── evidence/                # optional but recommended
    ├── tests.txt
    ├── routes.txt
    └── notes.txt
```

The package is evidence for the human/orchestrator and verifier. Do **not** make the evidence folder the source of product truth; the branch/commit and real DB/runtime remain authoritative.

## Branch rule

Each executor works in its own dedicated branch/worktree based on the current remote target. Executors **do not merge their own work** into the target branch. They push their implementation branch and report the exact commit SHA. Merge/freeze happens only after independent verification and orchestration approval.

## Verification rule

Agents A–D never run Hub `verify` for their own task or another executor's task. Agent 5 never edits application code. This separation is permanent unless the human explicitly changes the operating model.

## Included files

- `shared/PROJECT_CONTEXT.md` — SchoolOS invariants and audit philosophy.
- `shared/EXECUTOR_SKILL.md` — mandatory workflow for Agents A–D.
- `shared/TASK_ASSIGNMENT_TEMPLATE.md` — template the orchestrator uses to assign work.
- `shared/REPORT_TEMPLATE.md` — mandatory `report.md` structure.
- `agent-a/CONTEXT.md` — Agent A scope and default lane.
- `agent-b/CONTEXT.md` — Agent B scope and default lane.
- `agent-c/CONTEXT.md` — Agent C scope and default lane.
- `agent-d/CONTEXT.md` — Agent D scope and default lane.
- `agent-5-verifier/SKILL.md` — independent verifier workflow.
- `agent-5-verifier/CONTEXT.md` — verifier role context.
