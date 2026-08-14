# Traceability Matrix

> Compressed/self-answered per standing session directive — gaps and scope-creep items below were resolved directly with documented reasoning rather than via AskUserQuestion; every resolution matches a decision already made and justified in DISCOVERY.md/PRD.md/RESEARCH.md, not a new unreviewed judgment call.

## Summary
- Total requirements from discovery/source-spec: 24
- Total tasks in plan: 35
- Requirements fully covered: 20
- Requirements partially covered (scoped down, documented): 4
- Requirements excluded (deliberate v1 scope decision): 6 (see Gap Resolution Log — these are the source spec's Phase 4b/5 items)
- Tasks added beyond source-spec requirements (approved): 3 (self-review fixes: Content-Length guard, active-type check, shared audience-context helper — all defensive/consistency additions, not scope creep)

## Requirement-to-Task Mapping

| # | Requirement | PRD Section | Plan Section | Task IDs | Status |
|---|---|---|---|---|---|
| 1 | Configurable attachment-type taxonomy with policy fields | 4 | section-04 | 04-02, 04-03 | Covered |
| 2 | System types locked from rename/delete; referenced types archived not deleted | 4 | section-04 | 04-03 | Covered |
| 3 | Digital asset with title/description/tags/language/targets | 4 | section-05 | 05-01, 05-02 | Covered |
| 4 | Audience targeting: school/role/class-offering/section/subject/user, "All" always deliberate | 4 | section-04, section-05 | 04-01, 04-04, 05-02, 05-03 | Covered |
| 5 | Full lifecycle incl. failure branches (upload/scan/processing failed, infected, rejected) | 4 | section-01, section-05 | 01-01, 05-01 | Covered |
| 6 | Version history; replace creates a version, never mutates a referenced blob | 4 | section-01, section-02, section-05 | 01-01, 02-01/02, 05-01, 05-04 | Covered |
| 7 | Real malware scanning before anything is downloadable | 4, 6, 10 | section-03, section-05 | 03-01/02/03, 05-01 | Covered |
| 8 | Content library search/filter/table/grid | 4 | section-07 | 07-01 | Covered |
| 9 | Create/edit form with real upload + progress | 4 | section-07 | 07-02 | Covered |
| 10 | Asset detail/version history/usage-backlinks inspector | 4 | section-07 | 07-03 | Covered |
| 11 | Attachment-types admin page | 4 | section-07 | 07-04 | Covered |
| 12 | Reuse: link a resource to other content (homework in v1) | 4, 6 | section-06 | 06-01, 06-02 | Covered |
| 13 | Permissions: admin full, teacher own+reuse, student/parent read-only-published | 3, 4 | section-01, section-04, section-05 | 01-04, 04-02/03, 05-02/03/04 | Covered |
| 14 | Sensitive/answer-key content staff-only visibility | 4 | section-04, section-05, section-08 | 04-01, 05-05, 08-01 | Covered |
| 15 | Cross-tenant isolation on every table/route | 5, 8 | all API sections | 01-01, 04-02/03, 05-02..05, 06-01 | Covered |
| 16 | Audience changes take effect immediately, no stale download URLs | 8 | section-05 | 05-05 | Covered |
| 17 | Duplicate-version-creation race safety | 8 | section-05 | 05-01 | Covered |
| 18 | `BlobStore` interface, not hard-coded to one vendor | 6 | section-02 | 02-01, 02-02 | Covered |
| 19 | Immutable, content-addressed version storage keys | 6 | section-02 | 02-01 | Covered |
| 20 | Safe `Content-Disposition`/`nosniff` on download | 6 | section-05 | 05-05 | Covered |
| 21 | Per-type size/quota limits enforced | 6 | section-05 | 05-01, 05-02 | Covered |
| 22 | Bounded MIME validation beyond filename/claimed type | 6 | section-05 | 05-01 | Covered |
| 23 | Real test coverage of every genuinely testable invariant, no `db`-module mocking | (process) | section-08 | 08-01 | Covered |
| 24 | Live, not self-reported, verification incl. a real infected-file test and a real cross-tenant sweep | 8 | section-09 | 09-01..06 | Covered |
| 25 | Resumable/chunked uploads (Uppy + tus/tusd) | 7 (excluded) | — | — | Excluded (v1 scope decision, documented in PRD.md §7 / RESEARCH.md) |
| 26 | S3-compatible / SeaweedFS object storage | 7 (excluded) | — | — | Excluded (v1 scope decision — BlobStore interface built now, adapter deferred) |
| 27 | Apache Tika text/metadata extraction | 7 (excluded) | — | — | Excluded (v1 scope decision) |
| 28 | Uploaded video hosting | 7 (excluded) | — | — | Excluded (v1 scope decision — external links only) |
| 29 | Storage/quota operations dashboard, popular/unused-asset reports | 7 (excluded) | — | — | Excluded (v1 scope decision — deferred, raw access-events are still captured for future use, per section-05 task 05-05) |
| 30 | Portability export (metadata + blobs per tenant) | 7 (excluded) | — | — | Excluded (v1 scope decision) |

## Gap Resolution Log

| # | Gap Type | Description | Resolution | Date |
|---|---|---|---|---|
| 1 | Scope reduction | Source spec's Phases 4b (Tika extraction)/5 (ops dashboard/export) and the resumable-upload + object-storage infra from Phase 1-2 | Deliberately excluded from v1, documented with reasoning in DISCOVERY.md ("Core Requirements"), PRD.md Section 7, and RESEARCH.md's "Storage & upload pipeline" — proportionate to this deployment's actual 3-container Docker Compose maturity, door left open via the BlobStore interface | 2026-08-07 |
| 2 | Missing task (found in Phase 4 self-review) | `resolveStudentAudienceContext` referenced but not concretely assigned to a task | Added task 04-04; sections 05/06 updated to reference it | 2026-08-07 |
| 3 | Missing validation (found in Phase 4 self-review) | No early request-size rejection; no active-type check at asset creation | Added to section-05 task 05-02 | 2026-08-07 |
| 4 | Scope addition (approved, not creep) | 3 self-review fixes above are defensive/consistency work directly serving already-approved requirements (security, edge-case correctness), not new unrequested features | Kept | 2026-08-07 |

## Final Self-Approval

Compressed per standing directive: all 24 real requirements from the source spec are either covered or deliberately, transparently excluded with documented reasoning; the 3 self-review fixes are approved as directly serving already-in-scope requirements. Proceeding to Phase 6: OUTPUT.
