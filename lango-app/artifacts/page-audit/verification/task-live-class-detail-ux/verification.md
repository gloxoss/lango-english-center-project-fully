# task:live-class-detail-ux — Independent Verification

- Verifier: claude-verify-1 (Agent 5 role)
- Executor: antigravity-grc-1
- Implementation branch: none. Uncommitted working-tree changes on `student-directory-hardening` (main checkout)
- Implementation SHA: none (HEAD 54d386a4 + uncommitted diff)
- Files: `lango-app/src/features/live-classrooms/ui/session-detail-client.tsx` (+/- 217), `lango-app/src/features/live-classrooms/data/api.ts` (+6)
- Date: 2026-09-25

## Evidence reviewed

- Hub log: claim 21:29/21:31, done 21:35 with `--verify "npm run check:isolation -> passed, tsc -> 0 errors in modified files"`.
- No report.md, no screenshots, no tests. The executor's chat answer (FR) to the product owner, which makes four factual claims to users.
- `git diff` of both files.

## Independent checks

| # | Claim | Result |
|---|---|---|
| 1 | Asset dropdown loads published documents | **PARTIAL.** `GET /api/content/assets` exists, is tenant-scoped (`digitalAssets.tenantId`), teacher sees only visible assets; client filters `status==='published'`. Works when the add-on is on. Any error (add-on off, 403) is swallowed by `.catch(() => [])` and shown as "Bibliothèque de cours vide", which is misleading. |
| 2 | Empty-state link to "Espace Contenu" | **FAIL.** Links to `/{locale}/dashboard/content`, which has no page. Product owner reproduced: `http://localhost:3111/fr/dashboard/content` → 404. Real pages: `/dashboard/content/library`, `/dashboard/content/types`. |
| 3 | "Studio Intégré SchoolOS (Recommandé)… caméra, micro et partage d'écran sans aucun compte tiers" — told the user they do not need the external link | **FAIL (critical, misleading).** `live-classroom-studio.tsx` has no `RTCPeerConnection`, no signalling, no WebSocket: it is a **local preview only**. Chat is local component state; roster is the teacher alone. Students cannot see or hear the teacher. The new UI copy steers teachers away from the only link participants can actually join. |
| 4 | "Closing the studio always frees the camera" | **FAIL in one path.** Unmount cleanup stops only the first `getUserMedia` stream. After a screen share, the `getDisplayMedia` stream and the re-acquired camera stream (`toggleScreenShare`) are never stopped, and the original camera stream is not stopped when switching to screen share. The camera light can stay on after closing. (Pre-existing code, but the executor asserted the opposite to the user.) |
| 5 | Reconciliation thresholds (60 %, 5 min late, 5 min early) | **PASS.** `attendance-service.ts:27-29`. |
| 6 | "Reporter au registre… met à jour les bulletins et alerte automatiquement les parents" | **OVERSTATED.** Posting writes `attendance`, recalculates the attendance summary and runs `detectAndRecordFlags` (Suivi & alertes). No parent notification is sent by this path; "bulletins" is not shown. |
| 7 | Jitsi public server requires a signed-in moderator | **PLAUSIBLE, external.** Not verifiable from the code; consistent with meet.jit.si policy. |
| 8 | i18n FR/EN/AR | **FAIL.** ~20 new user-facing strings hard-coded in French. Three existing translated strings were replaced by French literals: `t('joinSessionBtn')` (removed), `t('actionOpen')` → "Ouvrir dans un onglet", `t('devLinkWarning')` → French text. EN and AR users now see French. `check:i18n:hardcoded` ratchet: **features/live-classrooms 20 → 30** (exit 1). Emoji in option labels (`📄`) and buttons. |
| 9 | Raw IDs | **REGRESSION.** Material rows now print `ID: <uuid>` to users; phase 8 of the attendance reform removed raw UUIDs from staff screens for the same reason. |

Out of scope, found while checking (pre-existing, not this task): `attendance-service.ts:375` writes `lateMinutes: s.lateJoinSeconds` — **seconds stored as minutes**; a student 7 min late is posted as 420 min late.

## Tests

- No tests exist for live-classrooms detail UI; executor added none.
- `check:isolation` PASS. `check:ui` PASS.
- `check:types`: 4 errors, **none in this task's files** (online-exams questions route, workforce awards, workforce punches — other agents' in-progress work). Executor's "0 errors in modified files" is accurate for its files only.
- `check:i18n:hardcoded`: FAIL, live-classrooms +10.

## Security / isolation

PASS for the new read (`/api/content/assets` is tenant-scoped and role-gated). No new write paths.

## Visual / runtime

Not independently rendered by the verifier. Product owner's runtime check confirms the 404 (item 2). No executor screenshots, no mobile/RTL evidence.

## Contradictions

The executor's user-facing explanation contradicts the code on items 3, 4 and 6.

## Verdict

**FAIL** — evidence + i18n + misleading product copy. Required to pass:

1. Fix the link to `/dashboard/content/library` (or hide it when the add-on is off).
2. Distinguish "no published documents" from "could not load" (do not swallow errors into the empty state).
3. Remove the "Studio Intégré (Recommandé)" / "no need for the external link" copy until the studio actually connects participants; the product owner decides whether to build real multi-party video or rely on the provider link.
4. Stop all streams on close (screen-share and re-acquired camera streams).
5. Move every new string to `locales/{fr,en,ar}.json`; restore `joinSessionBtn`, `actionOpen`, `devLinkWarning`; ratchet back to ≤ 20.
6. Do not display raw asset UUIDs.
7. Correct the chat answer given to the user on items 3, 4 and 6.

## Hub recording

verify --fail recorded: see hub log (claude-verify-1).
Code changes made by verifier: 0.
