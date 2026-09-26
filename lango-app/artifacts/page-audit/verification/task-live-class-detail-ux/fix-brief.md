# Fix brief — task:live-class-detail-ux (verify FAIL)

For: antigravity-grc-1
Read first: `verification.md` in this folder.
Reopen: `node .agent-hub/hub.mjs claim task:live-class-detail-ux --reopen --agent antigravity-grc-1 --files <every file below you will edit>`

Product owner's decision for this round: **do not build multi-party video.** The provider link (Jitsi) is the real classroom. The in-page studio stays only as a camera/mic test.

---

## Fixes (all required)

### 1. Broken link → 404
`session-detail-client.tsx`, empty-state box: `/${locale}/dashboard/content` → `/${locale}/dashboard/content/library`.
**Done when:** clicking the link as school_admin on `localhost:3111` opens the library page (no 404).

### 2. Errors shown as "empty library"
`getAvailableAssets().catch(() => [])` hides failures (add-on off, 403, 500) behind "Bibliothèque de cours vide".
- Track three states: `loading`, `error`, `loaded`.
- `error`: a short message ("Impossible de charger les documents"), keep the manual ID field.
- Add-on disabled: hide the dropdown and the empty box entirely.
**Done when:** with the `attachments-book` add-on off, the page shows no "empty library" box and no console error loop.

### 3. Misleading studio copy (critical)
`live-classroom-studio.tsx` is a local preview only (no RTCPeerConnection, no signalling; chat and roster are local). Students cannot join it.
- Main action = **the provider link**: "Rejoindre la classe" opens the join URL (the button that calls `handleJoin`). Make it the primary button.
- Studio button becomes secondary: "Tester ma caméra et mon micro". Studio header says it is a local test only.
- Remove from the studio: the chat tab and the participants list (they show fake/local data). Keep camera, mic, screen-share preview.
- Delete every sentence claiming the studio works "sans compte tiers", is "recommandé", or replaces the external link.
- Keep the Jitsi moderator explanation, rewritten neutrally: on the public server, the first host signs in and clicks "I am the host".
**Done when:** no text on the page implies students can see the teacher in the in-page studio.

### 4. Camera left on after screen share
`live-classroom-studio.tsx`:
- Keep every acquired stream in a ref (camera, screen, re-acquired camera).
- When switching to screen share, stop the camera stream's video track or keep it and stop it later — but on close, **stop all tracks of all streams**.
- Reverting from screen share: stop the screen stream before acquiring the camera.
- The screen-share `ended` handler must restore the camera, not call `toggleCam()` (which toggles `enabled` on the dead screen stream).
**Done when:** open studio → share screen → stop share → share again → close studio: the browser camera indicator turns off and `navigator.mediaDevices` has no live tracks (log `stream.getTracks().map(t => t.readyState)` in a dev check → all `ended`).

### 5. i18n regression
- Move every new user-facing string in `session-detail-client.tsx` and `live-classroom-studio.tsx` to `locales/fr.json`, `en.json`, `ar.json` (same namespace the file already uses). Arabic must be real Arabic, not French.
- Restore the three keys you replaced: `joinSessionBtn`, `actionOpen`, `devLinkWarning` (or replace them with new keys in all three locales).
- No emoji in labels or `<option>` text.
- Claim the locale files before editing (they are shared; check `status` first).
**Done when:** `npm run check:i18n:hardcoded` shows `features/live-classrooms` **≤ 20** (baseline) and `npm run check:i18n:keys` shows 0 missing. EN and AR pages show no French.

### 6. Raw UUIDs on screen
Material rows print `ID: <uuid>`. Remove it; show title + status (translated) only.
**Done when:** no UUID visible on the page.

### 7. Late minutes stored as seconds (pre-existing, same feature)
`src/features/live-classrooms/services/attendance-service.ts:375`:
`lateMinutes: status === 'late' ? Math.max(0, s.lateJoinSeconds) : null` writes **seconds** into a minutes column (7 min late → 420).
- Fix: `Math.ceil(Math.max(0, s.lateJoinSeconds) / 60)`.
- Add a test: a student joining 7 min after start is posted with `lateMinutes = 7`.
- Report (do not rewrite) how many existing `attendance` rows with a `Classe virtuelle:` note have `late_minutes > 60`, on `schoolos` and `schoolos_audit`. Put the count in your report.
- Claim this file before editing.
**Done when:** the new test passes and the count is in the report.

### 8. Correct what you told the user
In your final report, correct three earlier statements:
- the in-page studio does **not** connect students;
- closing it did **not** always free the camera (fixed now by #4);
- posting to the register does **not** notify parents; it writes attendance, recalculates the summary and raises follow-up flags (Suivi & alertes).

---

## Proof required before `done`

- `npm run check:types` (your files: 0 errors), `check:isolation`, `check:ui`, `check:i18n:keys`, `check:i18n:hardcoded`.
- Tests: the new #7 test plus any existing live-classrooms tests, `DATABASE_URL` → `schoolos_audit`.
- Screenshots of the session detail page as school_admin: desktop FR, phone 390, desktop AR. Save them under `lango-app/artifacts/page-audit/done/task-live-class-detail-ux/screenshots/` with a `report.md`.
- Use your own dev port (claim `task:port-<n>`); do not kill another agent's server.
- Do not commit unless the product owner asks. Stage only your claimed files.

`done task:live-class-detail-ux --summary "..." --files ... --verify "<each command> -> <result>"`
