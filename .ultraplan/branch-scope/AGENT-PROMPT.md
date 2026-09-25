TASK: BRANCH-SCOPE-01. Make every staff page respect the branch (campus) selector, safely.

Repo root: C:\Users\OMEN\OneDrive\Documents\projects\lango-english-center-project-fully (app in lango-app/). Other agents edit this tree at the same time.

READ FIRST
1. AGENTS.md (repo root), .agent-hub/PROTOCOL.md, .agent-hub/CONTEXT.md
2. .ultraplan/branch-scope/PLAN.md: the spec. It covers why it's broken, target behaviour, decisions DB1–DB6, invariants, route modes and sections B0–B6. Follow it task by task.
3. .ultraplan/branch-scope/inventory/routes-2026-09-25.json: all 836 API routes with their current branch handling.

YOUR PART (the owner tells you which)
- Foundation agent: B1, then B2, then B3. One agent only; the waves depend on it.
- Wave agent: one wave from B4 (W1..W6), only after B1–B3 are verified in the hub.
- UI agent: B5, after W1–W6.
- Verifier: B6. Must be a different agent from the ones who built B1–B5.
Do not start before B0 is confirmed (claude-finance posts "BRANCH-SCOPE B0 ready" in the hub).

JOIN AND CLAIM
node .agent-hub/hub.mjs join --agent <yourtool>-bs-<n> --tool <yourtool> --note "BRANCH-SCOPE-01 <your part>"
One identity for the whole run. Hub items: task:bs-b1, task:bs-b2, task:bs-b3, task:bs-w1..w6, task:bs-b5, task:bs-b6.
Claim with every file you will edit: node .agent-hub/hub.mjs claim task:bs-w2 --agent <you> --files a,b,c
Add files before touching them: node .agent-hub/hub.mjs files task:bs-w2 --add <path> --agent <you>
Exit code 3 = someone holds it: stop and ask with say.

AFTER EACH SECTION
Run its tests + npm run check:types + npm run check:isolation (+ npm run check:branch-scope once B3 exists), then
node .agent-hub/hub.mjs done task:bs-<x> --summary "..." --files a,b --verify "<exact command> -> <real result line>"

HARD RULES
- The branch comes only from the server context (ctx.branchId / ctx.branchLocked). Never trust a branch sent by the browser to widen access.
- Tenant filter stays in every query; the branch filter is added next to it, via branchWhere / assertBranchScope / assertWritableBranch only. No other helper.
- Parents, students, alumni and super-admin are never branch-filtered.
- The legal books (chart of accounts, journals, accounting periods, bank reconciliation, payroll runs) stay whole-school (DB3).
- Every wave's tests: locked user / chosen branch / all sites / parity sum / locked user cannot write into another branch. On schoolos_audit only:
  DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit
- Migrations: only B2-01. Next free number at the time, registered in migrations/meta/_journal.json. Never bypass a database trigger. If one blocks you, stop and report.
- A route that doesn't fit its registry mode: fix the registry with a one-line reason and say it in the hub. Never skip it silently.
- Locale files are CRLF: match \r?\n, then check for nested or duplicate namespaces.
- No git commit, push, merge, stash, reset, checkout, restore, switch or clean. No VPS builds or deploys.
- Never verify your own work, and never use a second identity.

WORKING STYLE (karpathy-guidelines + ponytail)
- Unclear or contradicting the plan: stop, name it, ask with say "HUMAN: ...".
- Smallest diff: one filter line per query where possible. No new abstractions beyond the three helpers. No refactors of nearby code.
- Done means the tests and the ratchet pass, not that the code looks right.

REPORT WHEN FINISHED (short, facts only)
- routes changed (count) and the baseline size before -> after
- test command -> result
- routes whose registry mode you changed, and why
- anything you could not do and why
Claim nothing the hub events and command output do not show.
