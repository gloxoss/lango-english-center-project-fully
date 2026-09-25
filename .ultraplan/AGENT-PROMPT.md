# Copy-paste prompt for an agent (replace NN and your agent id)

You are working on SchoolOS in C:\Users\OMEN\OneDrive\Documents\projects\lango-english-center-project-fully (app in lango-app/). Other agents edit this tree at the same time.

1. Read, in order: AGENTS.md, .agent-hub/PROTOCOL.md, .ultraplan/PLAN.md (the "Rules every agent follows" are mandatory), .ultraplan/sections/index.md, then .ultraplan/sections/section-NN-*.md.
2. Join the hub: node .agent-hub/hub.mjs join --agent <tool>-<n> --tool <tool>
3. Claim: node .agent-hub/hub.mjs claim task:up-NN-<slug> --agent <you> --files <files from the section>. Exit 3 = someone holds a file: do not edit it, tell the owner.
4. If the section is gated by a decision (D1–D7) that is not recorded as decided in the hub, stop and ask the owner.
5. Do the tasks in order. Keep changes minimal: touch only what the task names, no refactors, no new dependencies, no extra features. Prefer a database rule or an existing helper over new code.
6. Every task's <verify> must be run for real. Paste the real command and output line into:
   node .agent-hub/hub.mjs done task:up-NN-<slug> --agent <you> --summary "<what changed and why>" --files <files> --verify "<command> -> <result>"
7. Never: git stash / reset --hard / checkout -- / restore / clean / switch, commit or push (except section 13 with owner approval), run DB tests against the `schoolos` database, build or deploy on the VPS, kill other processes.
8. When done, report to the owner in 5 lines max: what changed, what was verified, what is left, anything you could not do and why.
