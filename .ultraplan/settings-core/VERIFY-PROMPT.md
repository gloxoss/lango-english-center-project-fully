TASK: VERIFY SETTINGS-CORE-FIX-01. Independent verification only: no code changes.

You must be a different agent from the one who built it (check the hub: the builder is <yourtool>-scf-1). Join with your own identity:
node .agent-hub/hub.mjs join --agent <yourtool>-scf-verify --tool <yourtool> --note "verify SETTINGS-CORE-FIX-01"

READ: .ultraplan/settings-core/PLAN.md, the builder's hub done notes (task:scf-01..11), and lango-app/artifacts/product-discovery/SETTINGS-CORE-FIX-01/.

FOR EACH task:scf-NN
1. Read the diff of the listed files (git diff / git log -p on them).
2. Re-run the builder's verify command yourself; copy the real result line.
3. Check one thing the builder did not: an edge case, the wrong role, another tenant, or the second run of a migration.
4. Open the changed screen on http://localhost:3111 as the right role (FR desktop, 390 px, AR) and compare it with the builder's screenshot. Look for contradictions (for example a banner that still says the old year, or a setting editable in two places).
5. node .agent-hub/hub.mjs verify task:scf-NN --agent <you> --ok|--fail --note "<file:line> | <command -> result> | <your extra check -> result> | <screen check>"

ALSO RE-RUN
- lango-app/artifacts/product-discovery/DISC-SETTINGS-CORE-01/evidence/isolation.mjs → still 0 leaks
- the 14 checks of DISC-SETTINGS-CORE-01/manual-review-guide.md → expected result now "fixed" or "planned for enhance"

RULES
- Tests on schoolos_audit only. No code, data or git changes. No deploys.
- A failed check gets --fail with what is wrong. Do not fix it.
- One verify call per item, typed after you checked it. Never a script that writes notes.

REPORT: per item ok/fail with one line each; P1/P2 table (discovery → now); anything you could not check.
