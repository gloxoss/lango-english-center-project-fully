# Section 05: Correction, Reissue, Data Access & Deletion Requests

## Overview
Implements the PRD's "Correction & reissue requests" and "Data requests" Must Haves via one real request-queue table (`alumniRequests`, from section-01) with a `type` discriminator, staff-reviewed, alumni never self-editing official records. Reissue approval is the one type with real side effects beyond a status flag: it must supersede the old document and issue a new one via section-04's mechanics.

## Risk: yellow - reissue approval touches two tables in one transaction and must get the supersession order right
Marking the old document superseded before (or without) successfully creating the new one would leave an alumnus with no valid document at all — this needs a real transaction, not two separate calls.

## Dependencies
- **Depends on:** section-01, section-03, section-04
- **Blocks:** none
- **Parallel batch:** 4

## TDD Test Stubs
- Test: An alumnus can submit a real correction/reissue/data_access/deletion request with a note; it appears in a real staff review queue.
- Test: Staff approving a `reissue` request creates a real new `alumniDocuments` row and marks the old one `status='superseded', supersededAt=now()` in one transaction — never a state with two active documents of the same type, never a state with zero.
- Test: Staff approving a `deletion` request clears only `alumniDirectoryConsent`/`alumniMentorListings` rows for that alumnus — their `alumniDocuments` and core `user` academic fields are provably untouched.
- Test: Staff rejecting a request leaves the underlying data completely unchanged, with a real `decisionNote` recorded.
- Test: An alumnus can see the real status of their own past requests, never another alumnus's.

## Tasks

<task type="auto" id="05-01">
  <name>Build alumni-facing request creation + listing</name>
  <files>src/app/api/alumni/me/requests/route.ts</files>
  <action>
    New file. POST: `requireRequestContext(request, ['alumni'])`, Zod `.strict()` schema `{type: 'correction'|'reissue'|'data_access'|'deletion', note: string, relatedDocumentId?: string}` — if `relatedDocumentId` provided, validate it belongs to `context.userId`. Insert a real `alumniRequests` row, `status: 'pending'`. GET: lists the alumnus's own real requests, self-scoped, ordered newest first.
  </action>
  <verify>As the real test alumnus, submit one request of each type via curl, confirm all 4 appear correctly in a subsequent GET, self-scoped.</verify>
  <done>Alumni can submit and view their own real requests of all 4 types.</done>
</task>

<task type="auto" id="05-02">
  <name>Build the staff request review queue + decision endpoint</name>
  <files>src/app/api/students/alumni/requests/route.ts, src/app/api/students/alumni/requests/[id]/decide/route.ts</files>
  <action>
    `GET /api/students/alumni/requests` (staff, cap `admissions.manage`): lists all real pending (and optionally decided) requests tenant-wide, joined to the alumnus's real name, with a `?status=` filter and real pagination (`parsePagination`, matching every other staff list route). `POST .../[id]/decide`: Zod `.strict()` schema `{decision: 'approved'|'rejected', decisionNote?: string}`. Inside a `db.transaction`, branch on the request's real `type`:
    - `correction`: staff decision alone (the actual field edit happens as a normal, separate real edit to the alumnus's profile elsewhere — this endpoint just records the review decision; do not invent an auto-apply mechanism for arbitrary free-text corrections).
    - `reissue`: on approval, mark the `relatedDocumentId` row `status: 'superseded', supersededAt: now()`, then require staff to separately call task 04-01's issuance endpoint for the actual new file (reissue approval authorizes it, doesn't auto-generate a file staff hasn't uploaded) — set the request's status to `approved` regardless, since the real re-issuance is a follow-up staff action already covered by 04-01.
    - `data_access`: on approval, no data mutation — this just authorizes staff to manually compile and send the alumnus their data (real human process, not auto-exported by this endpoint).
    - `deletion`: on approval, delete the alumnus's `alumniDirectoryConsent` row and `alumniMentorListings` row (if present) — never touch `alumniDocuments`, `user` core fields, or any academic-record table.
    Set `decidedBy`, `decidedAt`, `decisionNote` on every decision regardless of type. `recordAudit()` on every decision.
  </action>
  <verify>Approve a real `deletion` request for a test alumnus with real directory-consent and mentor-listing rows present; confirm via psql both are gone and every other row for that alumnus (documents, core user fields) is untouched. Approve a real `reissue` request; confirm the old document flips to superseded and its verification code stops verifying (task 04-03).</verify>
  <done>Staff can review and decide every request type with correct, type-specific, transactionally-safe real effects.</done>
</task>

<task type="auto" id="05-03">
  <name>Wire the staff request queue and alumni request UI</name>
  <files>src/features/students/ui/alumni-requests-view.tsx, src/app/[locale]/(alumni-portal)/alumni/requests/page.tsx</files>
  <action>
    Staff-side: a real queue view (reuse the layout pattern already established in `admission-requests-client.tsx` — list + detail panel + approve/reject) added under `/dashboard/students/alumni/requests`, wired to task 05-02. Alumni-side: a real "Mes demandes" page inside the portal shell — a form to submit a new request (type select + note, with a document picker when type is `reissue`/`correction`) and a real list of their own past requests with status, wired to task 05-01.
  </action>
  <verify>In the browser: submit a real reissue request as the test alumnus, see it appear in the staff queue, approve it as staff, confirm the alumnus's request list reflects the approved status.</verify>
  <done>Both the staff review queue and the alumni request-submission page are real and working end to end.</done>
</task>
