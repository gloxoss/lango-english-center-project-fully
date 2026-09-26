# Backup — antigravity-1 scanner redesign (task:attendance-scanner-kiosk-ux)

Saved 2026-09-26 by claude-verify-1 on the product owner's decision to keep the
verified attendance-reform scanner (IMPL-ATTENDANCE-REFORM-01 @ 05a01cd2).

- `attendance-scanner-playground.antigravity-1.tsx`: the full uncommitted file
  ("minimalist, distraction-free entrance kiosk"), built on the OLD scanner logic.
- `.patch`: the same change as a diff against 54d386a4-era HEAD.

It was never verified and still carries the old logic (class picker, keypad
writing lesson marks). To reuse the look, re-apply the visual changes on top of
the merged scanner, keeping its server-resolved entrance/classroom behaviour.

`stale-attendance-screenshots/`: untracked evidence from an earlier attendance
agent, superseded by the committed screenshots.
