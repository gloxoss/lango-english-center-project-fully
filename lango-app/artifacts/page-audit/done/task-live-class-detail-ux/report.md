# Task Remediation Report — task:live-class-detail-ux

**Agent:** `antigravity-grc-1`  
**Date:** 2026-09-25  
**Task:** `task:live-class-detail-ux` (Reopened after verification review)  
**Status:** COMPLETE — Verified against all 8 fix criteria & verification gates

---

## 1. Summary of Rework & Fixes

### Fix 1: Fixed Broken Library Link (404)
- **Problem:** The empty library state link pointed to `/${locale}/dashboard/content` which 404ed.
- **Fix:** Updated target to `/${locale}/dashboard/content/library`. Verified navigation returning HTTP 200 without 404.

### Fix 2: Distinguished Library Error vs Empty State
- **Problem:** `getAvailableAssets().catch(() => [])` hid failures (such as disabled add-on or 403) behind an "empty library" message.
- **Fix:** Tracked three distinct states: `loading`, `error`, `loaded`.
  - When the `attachments-book` add-on is disabled/inactive (`status === 403` or `code === 'ADDON_NOT_ACTIVATED'`), both the dropdown and empty library callout box are hidden completely, leaving only the manual resource ID input field.
  - When a generic error occurs, a short alert note (`assetsLoadError`) is displayed alongside the manual ID input.
  - When loaded and assets are published, the dropdown is displayed.

### Fix 3: Corrected Misleading Studio Copy & UX Hierarchy
- **Problem:** Studio copy claimed it connected students "sans compte tiers" and was "recommandé", creating false expectations since it lacked signaling/peer connections.
- **Fix:**
  - **Primary Action:** The provider link ("Rejoindre la session" / `joinSessionBtn`) is now the prominent primary action button. When clicked, it connects directly to the real meeting (Jitsi Meet) in a new tab.
  - **Secondary Action:** The studio button is secondary ("Tester ma caméra et mon micro" / `testCameraMicBtn`).
  - **Removed Fake Elements:** Removed the local chat tab and participant list completely from the studio component.
  - **Neutral Explanation:** Removed misleading claims. Rewrote the Jitsi Meet host explanation neutrally: on the public server, the first teacher/host signs in and clicks "I am the host / Je suis l'hôte" to unlock the room for the class.

### Fix 4: Stream Lifecycle & Camera Release after Screen Share
- **Problem:** Reverting from screen sharing toggled enabled on dead tracks, leaving the webcam on after closing the studio.
- **Fix:**
  - Tracked both `cameraStreamRef` and `screenStreamRef` in component refs.
  - Cleaned up screen streams before re-acquiring the camera.
  - Handled the screen-share native `ended` event to gracefully restore the camera.
  - Implemented `handleClose` and `useEffect` unmount cleanup stopping all tracks on all media streams (`track.stop()`), ensuring browser camera/mic activity indicators turn off immediately.

### Fix 5: Complete i18n Parity (FR / EN / AR) & Hardcoded String Ratchet
- **Problem:** Previous iterations introduced hardcoded French strings and raised the hardcoded count to 32 (above the 20 baseline).
- **Fix:**
  - Claimed `lango-app/locales/{fr,en,ar}.json` under `task:live-class-detail-ux`.
  - Added full translation keys for all UI elements in French, English, and genuine Arabic (RTL).
  - Preserved/restored `joinSessionBtn`, `actionOpen`, `devLinkWarning`.
  - Removed emojis from `<option>` tags and labels.
  - Ran `npm run check:i18n:hardcoded`: `features/live-classrooms` dropped to **9** (well below the baseline threshold of 20).
  - Ran `npm run check:i18n:keys`: 0 missing keys in `features/live-classrooms`.

### Fix 6: Removed Raw UUIDs from View
- **Problem:** Material rows rendered raw asset UUIDs (`ID: <uuid>`).
- **Fix:** Removed raw UUID display; rows display document title and translated status badge only (`Statut : {status}`).

### Fix 7: `lateMinutes` Seconds-to-Minutes Bug & Database Audit
- **Problem:** `attendance-service.ts:375` stored `s.lateJoinSeconds` directly into `lateMinutes`, writing seconds into a minutes column (e.g. 7 min late -> 420 min).
- **Fix:** Changed calculation to `Math.ceil(Math.max(0, s.lateJoinSeconds) / 60)`.
- **Unit Test Added:** Added test `"a student joining 7 min after start is posted with lateMinutes = 7"` to `attendance-service.test.ts`. All 14 tests pass on `schoolos_audit`.
- **Database Row Count Audit:**
  - Queried existing rows matching `SELECT COUNT(id) FROM attendance WHERE note LIKE 'Classe virtuelle:%' AND late_minutes > 60`:
    - `schoolos`: **0 affected rows**
    - `schoolos_audit`: **0 affected rows**

### Fix 8: Corrections to Prior User Communications
1. **Studio Connection:** The in-page studio does **not** connect students to the teacher. It is strictly a local camera & microphone test tool. The external provider link (Jitsi Meet) is the actual classroom.
2. **Camera Hardware Release:** Closing the in-page studio previously failed to release camera tracks when switching between screen-sharing and webcam. This is now fully resolved with track disposal across all stream references.
3. **Register Posting & Parent Notifications:** Posting attendance to the register does **not** trigger parent SMS/email notifications. It officially writes attendance into the core attendance table (`attendance`), recalculates daily roll summaries, and triggers follow-up/alert flags (`Suivi & alertes`).

---

## 2. Verification Proof

### Verification Gates
1. **TypeScript (`check:types`):**
   - Files modified by this task: **0 errors**.
   - (Global scan only reports 1 pre-existing unrelated error in `online-exams/.../route.ts:49` owned by another track).
2. **Tenant Isolation (`check:isolation`):**
   - **PASS** across 844 files. All queries properly tenant-scoped.
3. **UI Reality (`check:ui`):**
   - `features/live-classrooms` components have 0 dead controls, 0 mock screens, and 0 orphaned components.
4. **i18n Keys (`check:i18n:keys`):**
   - `features/live-classrooms` has **0 missing keys**.
5. **Hardcoded French (`check:i18n:hardcoded`):**
   - `features/live-classrooms`: **9 strings** ($\le 20$ baseline).
6. **Vitest Unit & Integration Suite (`attendance-service.test.ts`):**
   - Command: `cross-env DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit npx vitest run src/features/live-classrooms/services/attendance-service.test.ts`
   - Result: **14 passed (14)** in 5.39s.

### Verification Screenshots
All captured on dedicated claimed dev port `3465` with `y.elamrani@atlas.ma` (`school_admin`):
- `artifacts/page-audit/done/task-live-class-detail-ux/screenshots/school_admin-fr-desktop.png` (Desktop FR 1280x800)
- `artifacts/page-audit/done/task-live-class-detail-ux/screenshots/school_admin-fr-phone.png` (Phone FR 390x844)
- `artifacts/page-audit/done/task-live-class-detail-ux/screenshots/school_admin-ar-desktop.png` (Desktop AR 1280x800 RTL)
