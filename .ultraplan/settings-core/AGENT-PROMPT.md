TASK: SETTINGS-CORE-FIX-01. Fix every problem found by the settings discovery audit, following the plan exactly.

Repo root: C:\Users\OMEN\OneDrive\Documents\projects\lango-english-center-project-fully (app in lango-app/). Other agents may edit this tree at the same time.

READ FIRST
1. AGENTS.md (repo root), .agent-hub/PROTOCOL.md, .agent-hub/CONTEXT.md
2. .ultraplan/settings-core/PLAN.md: the spec. It holds the owner decisions OD1–OD4, invariants, and sections SCF-01..SCF-11 with tasks.
3. lango-app/artifacts/product-discovery/DISC-SETTINGS-CORE-01/report.md, plus the analysis file named in each section (the evidence for why each fix is needed).

JOIN
node .agent-hub/hub.mjs join --agent <yourtool>-scf-1 --tool <yourtool> --note "SETTINGS-CORE-FIX-01"
One identity for the whole run. One hub item per section: task:scf-01 … task:scf-11.
Claim every file before editing: node .agent-hub/hub.mjs claim task:scf-01 --agent <you> --files a,b
Exit 3 = someone holds it (the branch-scope agent may hold settings/branches files): stop and ask with say.
Dev server: claim task:port-<n>. Login only works on http://localhost:3111 (the trusted origin); if 3111 is held, ask the owner.

ORDER
SCF-01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11. After each section:
- run its tests + npm run check:types + npm run check:isolation (+ check:i18n:keys when locales changed)
- screenshots of changed screens (FR desktop, 390 px, AR) into lango-app/artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots/
- node .agent-hub/hub.mjs done task:scf-NN --summary "..." --files a,b --verify "<exact command> -> <real result line>"

HARD RULES
- Tenant filter in every query. Keep the existing capabilities. The discovery proved isolation: your tests must keep proving it (cross-tenant 404, wrong role 403).
- One canonical source per concept (PLAN invariant 2). Never add a new store for something that already has one.
- Migrations 0166, 0167, 0168 only, as written in the plan: journal entries, idempotent, fail loudly on bad data, never bypass a trigger, never delete data.
- DB tests only on schoolos_audit:
  DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit
- Dev data changes (Atlas year switch, Atlas multi-branch) only through the app's own APIs/screens, logged in the done note. Never touch the VPS.
- Retired features are hidden, not deleted (plan invariant 4).
- New text only through next-intl keys in fr/en/ar. Locale files are CRLF: match \r?\n, then check for nested or duplicate namespaces.
- Do not fix things outside the plan; list them at the end.
- No git commit, push, merge, stash, reset, checkout, restore, switch or clean. No deploys.
- Never verify your own work, and never use a second identity.

WORKING STYLE (karpathy-guidelines + ponytail)
- Unclear, or the code contradicts the plan: stop, name it, ask with say "HUMAN: ...".
- Smallest diff that satisfies the task. Reuse existing helpers (getEffectiveValue/setSettingValue, reserveMatricule, consumeDocumentNumber, recordAudit). No new abstractions beyond those named in the plan.
- Done means the task's <verify> passes, not that the code looks right.

REPORT WHEN FINISHED (short, facts only)
- per section: files, test command -> result, screenshots path
- the SCF-11 before/after table for every P1/P2 item of the discovery
- migrations applied (numbers) on schoolos_audit and dev
- the list of the ~24 remaining isDefault queries (for the enhance phase)
- anything you could not do and why; owner steps still needed
Claim nothing the hub events and command output do not show.
