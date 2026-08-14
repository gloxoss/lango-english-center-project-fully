# Section 04: Records & Document Verification

## Overview
Implements the PRD's "Real records access" and "Document verification" Must Haves. Staff issue real documents to alumni (reusing the existing tenant-namespaced file-storage helper); each issuance gets a real, unique, advisory-lock-safe verification code (section-01's `reserveVerificationCode`); a public, no-login page lets anyone confirm a code is genuine without exposing the file.

## Risk: yellow - the public verification endpoint is a real, unauthenticated attack surface
Reusing the proven rate-limiting/honeypot pattern from the existing public lead-capture endpoint mitigates brute-force code-guessing, but this is still real, unauthenticated, security-sensitive surface — worth the yellow rating and a deliberate abuse-scenario test, not just a happy-path check.

## Dependencies
- **Depends on:** section-01, section-03 (alumni-facing "my records" page lives in the portal shell)
- **Blocks:** section-05 (reissue needs this section's document/verification-code mechanics)
- **Parallel batch:** 3

## TDD Test Stubs
- Test: Staff issuing a document to a real alumnus creates a real `alumniDocuments` row with a real, unique verification code and a real stored file.
- Test: The public verification page correctly confirms a real, active code as genuine, without ever returning the file itself or any extra personal data beyond name/document type/issue date.
- Test: The public verification page correctly reports a fake/nonexistent code as not found — same response shape either way, no information leak about which codes are "close" to real ones.
- Test: Rate-limiting kicks in on rapid repeated verification attempts from the same IP (reusing the real existing limiter).
- Test: An alumnus can download their own real, active document from their portal.
- Test: A superseded (reissued) document's OLD verification code no longer verifies as genuine — confirmed via section-05's reissue flow once that section lands, but this section's verification logic must correctly honor `status='superseded'` from day one.

## Tasks

Execution-time addition: task 04-01 as originally scoped had no staff-facing UI to actually call the issuance endpoint (only 04-04 built alumni-facing/public pages). Fixed by extending `student-detail-view.tsx`'s Documents tab with a real issuance form + list, gated to `role === 'alumni'` and `can('admissions.manage')`, reusing `loadAlumniDocs()`/`handleIssueDocument()`. Not a new numbered task - folded into the same file already touched by section-02's UI work.

<task type="auto" id="04-01">
  <name>Build the staff document-issuance endpoint</name>
  <files>src/app/api/students/alumni/[id]/documents/route.ts</files>
  <action>
    New file. POST, role `school_admin`, cap `admissions.manage`, `multipart/form-data` accepting a file + `documentType` (free-text or a small fixed set — reuse the pattern from `studentDocuments`' `documentType` enum values as a starting set: transcript/certificate/attestation). Validate the target user belongs to the tenant and has `role='alumni'`. Save the file via `src/libs/api/uploads.ts`'s `saveUploadedFile`, reusing its existing magic-byte type validation AND the same real max-file-size cap already enforced for `studentDocuments` uploads (check that route for the exact byte limit and match it — don't leave this document type uncapped just because it's new) under a real tenant-namespaced path (e.g. `{tenantId}/alumni-documents/{alumnusId}/{documentId}.{ext}`). Inside a `db.transaction`, call section-01's `reserveVerificationCode(tx, tenantId)` (it must be called with the transaction's `tx`, never the bare `db` client, or its advisory lock is a no-op) then insert the new `alumniDocuments` row (`status: 'active'`) using the same `tx`, so the code reservation and the row insert either both succeed or both fail together. GET: lists all real documents (active and superseded) for a given alumnus, staff-only.
  </action>
  <verify>Upload a real test PDF as staff for a real test alumnus. Confirm via psql a real row with a real unique verification code and a real file on disk at the expected path. Attempt an upload exceeding the size cap or an unsupported file type — confirm both are rejected the same way `studentDocuments` uploads already reject them.</verify>
  <done>Staff can issue a real document to an alumnus with a real, unique verification code and real file storage.</done>
</task>

<task type="auto" id="04-02">
  <name>Build the alumni-facing GET /api/alumni/me/records + download endpoint</name>
  <files>src/app/api/alumni/me/records/route.ts, src/app/api/alumni/me/records/[id]/download/route.ts</files>
  <action>
    `GET /api/alumni/me/records`: `requireRequestContext(request, ['alumni'])`, lists the real, self-scoped, `status='active'` documents for `context.userId` (superseded ones excluded from this view — they're not usable). `GET /api/alumni/me/records/[id]/download`: validates the requested document ID belongs to `context.userId` and is `status='active'`, then streams the real file via `src/libs/api/uploads.ts`'s `readUploadedFile`.
  </action>
  <verify>As the real test alumnus, list and download their own real active document. Confirm requesting another alumnus's document ID (even a real one) is rejected — self-scoping enforced.</verify>
  <done>Alumni can see and download their own real, active documents only.</done>
</task>

<task type="auto" id="04-03">
  <name>Build the public, no-login document verification endpoint</name>
  <files>src/app/api/public/alumni-documents/verify/route.ts</files>
  <action>
    New file, mirroring `src/app/api/public/inquiries/[tenantSlug]/route.ts`'s exact shape: no `requireRequestContext`. `checkRateLimit(`public-doc-verify:${clientIp}`, 10, 60*60*1000)` (10/hour/IP — tighter than the inquiry endpoint's 5/hour since this is a lookup not a submission, but still real friction against brute-forcing). Zod `.strict()` schema accepting `{code: string}` with a honeypot field matching the existing pattern. Look up `alumniDocuments` by `verificationCode`, joined to `user` for the alumnus's real name. If found and `status='active'`: return `{valid: true, alumnusName, documentType, issuedAt, schoolName}` — never the file, never any other personal data. If not found or `status='superseded'`: return the exact same-shaped `{valid: false}` response (no distinction between "wrong code" and "old/superseded code" — avoids leaking which codes were ever real).
  </action>
  <verify>curl the endpoint with a real active code — confirm `{valid: true, ...}` with only the allowed fields. curl with a random fake code and with a real-but-superseded code (once section-05 exists) — both must return the identical `{valid: false}` shape. Confirm the 11th request within an hour from the same IP is rate-limited.</verify>
  <done>A real, rate-limited, no-login public endpoint verifies documents without ever exposing the file or leaking code validity patterns.</done>
</task>

<task type="auto" id="04-04">
  <name>Build the public verification page and alumni "Mes dossiers" page</name>
  <files>src/app/[locale]/verify-document/page.tsx, src/app/[locale]/(alumni-portal)/alumni/records/page.tsx</files>
  <action>
    `verify-document/page.tsx`: a minimal, no-login page (outside both the staff and alumni shells) with a single code-input field and a real yes/no result calling task 04-03. `records/page.tsx` (inside the alumni portal shell): lists the alumnus's real active documents (task 04-02) with a real download button and their real verification code displayed (so they can share it with an employer themselves) and a "Demander une correction/réémission" action linking into section-05's request flow. A real, honest empty state ("Aucun document pour le moment") when the alumnus has none yet.
  </action>
  <verify>In the browser, no login: paste a real code on the public page, see a real "genuine" confirmation. As the real test alumnus: see and download a real document from their own portal.</verify>
  <done>Both the public verification page and the alumni's own records page are real and working.</done>
</task>
