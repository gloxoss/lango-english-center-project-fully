# Checkpoint — IMPL-ATTENDANCE-REFORM-01

Agent: claude-agentb (Agent B, implementation owner)
Updated: 2026-09-25

## Where the work lives

| | |
|---|---|
| **Active branch** | `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01-integrated` |
| **HEAD** | `1fa2280a` |
| **Worktree** | `.worktrees/IMPL-ATT-INTEGRATED` |
| **Base (release)** | `origin/release/REL-INTEGRATE-01` = `8215bb6e` |
| Original pre-integration branch | `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01` @ `383dc542` (Agent A reviewed `7ef7355e`) |
| Dev port | `3470` |
| Test database | `schoolos_audit` (mutations) |

## Commit history on the integrated branch

| SHA | Phase | Summary |
|---|---|---|
| `0ded9df3` | 0.1–0.4 | Expired credentials, QR report scope, `workforce.punch`, seed summaries recomputed |
| `de63af39` | 0.5 corr. | Date classified before the clock; calendar fixture; rebuild tool |
| `15edc4fd` | 1 backend | Session-occurrence identity; migration 0158; phase 0.5 limitation closed |
| `690ab331` | docs | Phase 1 artifact |
| `94fd5412` | docs | Checkpoint |
| `1be00e73` | 1 UI | Appel du jour screen + `GET /api/attendance/day` |
| `fd02baae` | 1 fix | Lesson action button wired; room label fix |
| `1fa2280a` | **2** | Teacher current lesson + 2 roll-call bugs |

## Phase status

| Phase | Status |
|---|---|
| 0 — Safety + data truth | **COMPLETE** |
| 0.5 — Exact-session identity | **COMPLETE** |
| 1 — Admin Appel du jour | **COMPLETE** (RTL time-range cosmetic open) |
| 2 — Teacher current lesson | **COMPLETE** |
| 3 — Business truth / metrics | NOT STARTED |
| 4 — Justifications + Suivi & alertes | NOT STARTED |
| 5 — Cards + credentials | NOT STARTED |
| 6 — Session exceptions | NOT STARTED |
| 7 — Kiosk + device security | NOT STARTED |
| 8 — Registers / history / QR reporting | NOT STARTED |
| 9 — HR time clock + navigation | NOT STARTED |

## Running the app

```
cd .worktrees/IMPL-ATT-INTEGRATED/lango-app
NEXT_DIST_DIR=.next-agentb \
BETTER_AUTH_URL=http://localhost:3470 \
NEXT_PUBLIC_APP_URL=http://localhost:3470 \
./node_modules/.bin/next dev -p 3470
```

- Open **http://localhost:3470/fr/dashboard/attendance**
- `y.elamrani@atlas.ma` / `Admin123!` — school_admin, tenant Groupe Scolaire Atlas
- `prof.09@atlas.ma` / `Admin123!` — teacher, same tenant

Two traps, both already hit once:

1. **Use the local binary, not `npx`.** `npx next` tries to fetch a different
   version (16.3.6) instead of the installed 16.3.2.
2. **`BETTER_AUTH_URL` must match the port.** `.env` pins it to 3111; without the
   override every browser login fails with "Invalid origin". curl does not send
   an `Origin` header, so a curl login test passes while the browser still fails.

`next dev` rewrites `tsconfig.json` to add `.next-agentb/types`. Revert it before
committing; `.next-agentb/` is now in `.gitignore`.

## Environment facts

- The app's dev database is **`schoolos` on `localhost:5433`** — a native
  Postgres, not the `lango_postgres` container (which publishes no host port).
- `.env` points at `schoolos`, so **every test run must override `DATABASE_URL`
  to `schoolos_audit`**.
- Migration `0158` has been applied to `schoolos` so the UI can run. It is
  additive: two nullable columns, an index, two FKs `ON DELETE SET NULL`.
- `npx drizzle-kit migrate` exits 1 silently against `schoolos_audit` — that DB
  has 163 applied migrations against a 160-entry journal. Pre-existing, unrelated
  to 0158. New migrations must be applied and verified statement-by-statement.

## Test baseline

| Suite | Result |
|---|---|
| attendance / QR / teacher / workforce / audit-summary | 272 / 272 (28 files) |
| Integrated regression (teacher + safety + HR) | 375 / 375 (52 files, at `de63af39`) |
| `check:types` | exit 0 |
| `check:i18n:keys` | 0 missing |
| `check:isolation` | passed |
| Browser verification | Appel du jour desktop FR / phone 390 / AR RTL; full roll-call save returns 200 |

## Open gaps

| Gap | Risk | Action |
|---|---|---|
| RTL time range renders `12:55–12:00` (bidi reorder) | 🟡 | Wrap the time span in `dir="ltr"` in `appel-du-jour-view.tsx` |
| `attendance.subject_id` FKs to the legacy `courses` table | 🟡 | The write path rejects a modern `subjects.id`; the client now never sends one. The schema mismatch itself is unaddressed |
| `drizzle-kit migrate` exits 1 on `schoolos_audit` | 🟡 | Reconcile the journal before relying on `db:migrate` |
| `attendance-teacher-scope.test.ts:173` has no tenant filter | 🟡 | Add `eq(attendance.tenantId, tenantId)` — reported, not edited (not my file) |
| Arabic strings are machine-written, not native-reviewed | 🟢 | Review before shipping to Moroccan users |
| `manual-test-guide.md` not written | 🟡 | Required closeout artifact; after Phase 9 |
| Screenshots not copied into `artifacts/` | 🟢 | Copy to `after/` at closeout |

## Next concrete step

**Phase 3 — attendance business truth.** Physical-presence rate becomes
`(present + late) / recorded`; excused stops counting as physically present and
is reported separately. Touches the canonical aggregate, student summaries, the
audit view and dashboards. Do it before Phase 4, because the alert rules read the
same totals.
