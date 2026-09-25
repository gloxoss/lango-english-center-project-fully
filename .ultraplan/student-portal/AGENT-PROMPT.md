TASK: STU-PORTAL-02. Give students their grades, report cards, exams and homework in the student portal.

Repo root: C:\Users\OMEN\OneDrive\Documents\projects\lango-english-center-project-fully (app in lango-app/). Other agents edit this tree at the same time.

READ FIRST
1. AGENTS.md (repo root), then .agent-hub/PROTOCOL.md and .agent-hub/CONTEXT.md
2. .ultraplan/student-portal/PLAN.md: the whole plan, product rules DS1–DS4, invariants, sections S1–S8. It is the spec. Follow it task by task.

JOIN AND CLAIM
node .agent-hub/hub.mjs join --agent <yourtool>-stu-1 --tool <yourtool> --note "STU-PORTAL-02 student portal"
Use one identity for the whole run. Claim before editing: one item per section, e.g.
node .agent-hub/hub.mjs claim task:stu-portal-s1 --agent <you> --files <every file the section lists>
Exit code 3 means someone holds a file: stop and ask with `say`. Your own dev server: claim task:port-<n> first. Login only works on port 3111 (the trusted origin); if another agent holds 3111, ask the owner.

ORDER
S1 → S2 → S3 → S4 → S5 (APIs, each with its S8 tests) → S6 (UI) → S7 (demo data + runtime sweep).
After each section: run its tests + npm run check:types + npm run check:isolation, then
node .agent-hub/hub.mjs done task:stu-portal-sN --summary "..." --files a,b --verify "<exact command> -> <real result line>"

HARD RULES
- The student id comes only from the session (requireStudentContext in src/features/student/api/guard.ts). Never from URL, query or body.
- Every query filters by tenantId. Unpublished grades, draft exams and revoked bulletins never reach the student.
- DB tests only on schoolos_audit:
  DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit
- Demo data (S7) goes into the dev DB only through the app's own screens/APIs, never raw SQL. Log each step.
- No migrations, no schema changes. If a task seems to need one, stop and ask.
- S2-02: reuse the existing report-card PDF renderer. If none can render from the stored snapshot, stop and report. Do not write a new renderer.
- New text only through next-intl keys in fr/en/ar. Locale files are CRLF: match \r?\n and check for nested or duplicate namespaces after editing.
- Do not fix unrelated things you notice. Report them at the end.
- No git commit, push, merge, stash, reset, checkout, restore, switch or clean. No VPS builds or deploys.
- Never verify your own work, and never use a second identity.

WORKING STYLE (karpathy-guidelines + ponytail)
- Unclear or contradicting the plan: stop, name it, ask with `say "HUMAN: ..."`.
- Smallest change that satisfies the task. Reuse the existing queries and services named in the plan. No new abstractions, no speculative options.
- Each task is done when its <verify> passes, not when the code looks right.

REPORT WHEN FINISHED (short, facts only)
- per section: files, test command -> result
- S7: data created (ids), screenshots folder, the card vs tab vs PDF consistency table
- anything you could not do and why
- follow-ups (e.g. bulletins in the parent portal)
Claim nothing the hub events and command output do not show.
