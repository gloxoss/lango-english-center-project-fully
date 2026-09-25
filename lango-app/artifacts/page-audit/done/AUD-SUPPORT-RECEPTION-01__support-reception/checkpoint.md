# AUD-SUPPORT-RECEPTION-01 — CHECKPOINT (resume point)

- task: AUD-SUPPORT-RECEPTION-01 — Support Tickets + Reception / Front Desk
- agent: codex-2 (Executor C)
- target branch: origin/student-directory-hardening
- base: f42c2bc41cb2386afed52244c5355c31c8a91f96 (fetched, unchanged)
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-SUPPORT-RECEPTION-01`
- branch: `audit/agent-c/AUD-SUPPORT-RECEPTION-01-support-reception`
- hub claims held: `task:AUD-SUPPORT-RECEPTION-01`, `task:port-3460`
- claim files: `src/features/support`, `src/features/reception`, `src/app/api/support`,
  `src/app/api/tenant/support`, `src/app/api/super-admin/support`, `src/app/api/reception`,
  this folder
- collision check before claim: CLEAN (antigravity-1 holds HR/workforce only)
- dev server: port 3460, `NEXT_DIST_DIR=.next-agentc`, DATABASE_URL -> `schoolos_audit`
- node_modules: `npm install --ignore-scripts` DONE
- **EDIT IN THE WORKTREE.** The Edit tool defaults to the shared tree. Also: bash
  heredocs mangle backslash escapes, so patch scripts must use line-index
  replacement or `path.sep`, never `replace(/\\/g, ...)`.

## ROUTE INVENTORY (discovered, not assumed)

### Support (5 surfaces)
  /dashboard/support              tenant-side tickets        (816-line view)
  /dashboard/super-admin/support  platform ticket desk       (super_admin only)
  POST/GET /api/support/upload    attachment upload + serve  <-- headline defect
  /api/tenant/support             tenant ticket CRUD
  /api/super-admin/support        super-admin ticket desk
  table: platform_support_tickets (tenant_id, status, priority, category)

### Reception (6 pages, 27 API routes)
  /dashboard/receptionist              front-desk home
  /dashboard/receptionist/inquiries    + /api/reception/inquiries, [id]/follow-ups
  /dashboard/receptionist/handoffs     + /api/reception/handoffs, [id]/{acknowledge,cancel,resolve}
  /dashboard/receptionist/appointments + /api/reception/appointments, [id]/{cancel,check-in,complete,no-show,reschedule}
  /dashboard/receptionist/visitors     + /api/reception/visitors, [id]/{check-in,check-out,pass}
  /dashboard/receptionist/pickups      + /api/reception/pickups/{authorizations,release,students}
  plus: gates, lookup, me/home, staff, verifications
  services: appointments 344, handoffs 253, lookup 193, notifications 83, home 67, identity 68

## FINDING + FIX (DONE in worktree)
F-01 **HIGH / CRITICAL — FIXED** Unauthenticated download of confidential support
  attachments.
  `GET /api/support/upload?fileKey=...` had NO requireRequestContext, NO tenant
  check, and returned `Cache-Control: public, max-age=31536000, immutable`.
  The global `src/middleware.ts` matcher explicitly EXCLUDES `api`
  (`'/((?!api|_next/static|...)).*)'`), so nothing else protected it. Any anonymous
  visitor who knew or guessed a fileKey could download another school's support
  evidence (error screenshots, PDFs, videos), and every shared proxy was told to
  cache it for a year.
  fileKey was also only weakly random: `${Date.now()}_${uuid.slice(0,8)}_<name>.<ext>`
  (32 bits of entropy plus a guessable timestamp and filename).
  FIX (7 edits, all in src/app/api/support/upload/route.ts):
   1. GET now calls requireRequestContext + requireTenant (same role set as POST).
   2. Uploads stored under `<tenantId>/<YYYY-MM>/<file>` instead of `<YYYY-MM>/<file>`.
   3. GET rejects a tenant-scoped key that is not the caller's tenant
      (super_admin, the platform support desk, may read any).
   4. Legacy keys with no tenant segment stay authenticated-only rather than
      being orphaned.
   5. `Cache-Control: public, max-age=31536000, immutable` -> `private, max-age=300,
      must-revalidate` (both the range and full responses).
   6. Path guard tightened to `startsWith(SUPPORT_UPLOADS_ROOT + path.sep)`.
  TEST: src/features/support/__tests__/support-attachment-security.test.ts (6 tests)
   — GET authenticates + tenant-scopes, no `public` cache on attachments, uploads
   under the tenant folder, traversal guard intact, and a repo-wide invariant that
   no /api file-serving handler is unauthenticated.

## NEXT EXACT ACTION
1. Read /tmp/agentc-sr-gates.log (vitest + check:isolation/ui/i18n). check:types was
   clean after the path.sep repair.
2. Finish the screenshot sweep (running on 3460): receptionist x6, support as
   school_admin, super-admin/support (expect honest denial without TOTP).
3. Mobile 390 + AR RTL on changed/important routes (support ticket screen is
   816 lines and the most complex).
4. report.md from shared/REPORT_TEMPLATE.md with the full route matrix for BOTH
   modules and the two lifecycle proofs the brief asks for:
   support: create -> tenant history -> super-admin view -> status/assignment ->
            attachment -> resolution -> history preserved
   reception: inquiry -> handling -> appointment/handoff -> visitor/pickup ->
              responsible staff -> history
   Do NOT redesign the frozen Admissions lifecycle; reception inquiries that link
   into it are integration-only.
5. commit -> push -> `hub done task:AUD-SUPPORT-RECEPTION-01` -> release both
   claims -> stop.
