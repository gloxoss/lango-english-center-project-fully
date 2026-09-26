TASK: GRADES-CANONICAL-01. Make teacher-entered grades reach families, report cards and promotions: one grade store plus a real publishing step.

Repo root: C:\Users\OMEN\OneDrive\Documents\projects\lango-english-center-project-fully (app in lango-app/). Other agents edit this tree at the same time.

READ FIRST
1. AGENTS.md (repo root), .agent-hub/PROTOCOL.md, .agent-hub/CONTEXT.md
2. .ultraplan/grades-canonical/PLAN.md: the spec (problem with file:line evidence, decisions GD1–GD4, invariants, sections GRC-01..05).
3. lango-app/artifacts/product-enhancements/STU-PORTAL-02/evidence/data-steps.md, section 3 (the original bug report).

JOIN
node .agent-hub/hub.mjs join --agent <yourtool>-grc-1 --tool <yourtool> --note "GRADES-CANONICAL-01"
One identity. One hub item per section: task:grc-01 … task:grc-05. Claim every file before editing; exit 3 = held by someone, stop and ask with say.
Dev server: claim task:port-<n>; login only works on http://localhost:3111 (ask the owner if it is held).

ORDER: GRC-01 → 02 → 03 → 04 → 05. After each section run its tests + npm run check:types + npm run check:isolation, then
node .agent-hub/hub.mjs done task:grc-NN --summary "..." --files a,b --verify "<exact command> -> <real result line>"

HARD RULES
- Canonical store = assessment_outcomes (GD1). Never write assessment_results. Never drop it.
- Families see only moderation_state='published'. Staff screens follow GD2.
- Issued report cards (issued_documents snapshots) are never recomputed.
- Tenant filter everywhere; teachers limited to assigned sections (libs/api/teacher-scope.ts).
- Tests on schoolos_audit only, with fixtures created through OutcomeService.recordOutcome:
  DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit
- No migrations are expected. If you believe one is needed, stop and ask.
- Legacy concept with no clear outcome equivalent (e.g. assessment sessions): stop and ask with say "HUMAN: ...". Never invent a mapping.
- New text via next-intl keys in fr/en/ar (CRLF files: match \r?\n, check for nested or duplicate namespaces).
- No git commit, push, merge, stash, reset, checkout, restore, switch or clean. No deploys. Never verify your own work; one identity only.

WORKING STYLE (karpathy-guidelines + ponytail)
- Smallest change: one helper, reused by every reader. Keep response shapes, so screens don't change.
- Done means the task's <verify> passes and the GRC-05 end-to-end proof works on screen.

REPORT (short, facts only): per section files + test command -> result; the GRC-05 step table; the remaining grep for assessmentResults; open questions for the owner.
