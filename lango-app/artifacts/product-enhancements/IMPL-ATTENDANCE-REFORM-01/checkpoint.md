# Checkpoint — IMPL-ATTENDANCE-REFORM-01

Agent: claude-agentb (Agent B, implementation owner)
Started: 2026-09-25

## Branch identity

| | |
|---|---|
| Source branch | `student-directory-hardening` (local) |
| Source SHA | `17945212` — "wip: checkpoint of audit fixes in progress (all agents' tracked changes)" |
| Implementation branch | `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01` |
| Worktree | `.worktrees/IMPL-ATTENDANCE-REFORM-01` |
| HEAD | `4653cd31` |
| Dev port claimed | `3470` (hub item `task:port-3470`) |
| Test database | `schoolos_audit` (never `schoolos`) |

## Why this source SHA

Chosen by the human owner from three candidates. `17945212` is the branch the
discovery actually traced ("Traced from code on 2026-09-25 (branch
student-directory-hardening, working tree)"), and it is the only committed,
reproducible snapshot.

Two things about this base are worth knowing, because they affect any reviewer:

- **The main working tree is dirty with other agents' work.** 232 uncommitted
  source files (640 including docs) sit in it, from three agents the hub still
  lists as active: `claude-finance`, `opencode-2`, `gemini-audit`. A worktree can
  only materialise committed state, which is one reason this branch does not
  carry them.
- **Local `student-directory-hardening` has diverged from its own origin.**
  Local `17945212` vs `origin/student-directory-hardening` `f42c2bc4`. It is also
  **52 commits ahead of `origin/main`**.
- **`release/REL-INTEGRATE-01` (`8215bb6e`) is NOT in this base.** It carries 10+
  integration merges this branch does not have, including `AUD-SAFETY-01`,
  `AUD-TEACHER-01` and `AUD-HR-01` — all three land in this reform's blast radius.
  That was a deliberate choice (the brief says not to merge unrelated unverified
  branches), but it means **Agent A should confirm the base is still the intended
  one before final review.**

## Environment notes

- `lango_postgres` was **exited** when this campaign started; it was started.
  Both `schoolos` and `schoolos_audit` are present.
- The worktree's `node_modules` is a **junction** to the main checkout (symlinks
  need elevation on this machine).
- `.env` was copied verbatim from the main checkout. Its `DATABASE_URL` points at
  `schoolos`, so every test run in this campaign **overrode** `DATABASE_URL` to
  `schoolos_audit`, per the hub rule that test data goes there only.

## Commits

| SHA | Phase | Summary |
|---|---|---|
| `cd894414` | 0 (1/2) | Expired credentials, QR report scope, workforce punch capability, fabricated summaries |
| `4653cd31` | 0 (2/2) | Missing-register truth: Casablanca date, published version, ended-only |

Both pushed to `origin/enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01`.
