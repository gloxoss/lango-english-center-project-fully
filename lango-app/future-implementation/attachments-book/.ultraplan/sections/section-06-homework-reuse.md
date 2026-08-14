# Section 06: Homework Reuse (Usage Links)

## Overview
Lets a teacher attach a published, real digital asset to a homework assignment as a reference/resource — the first real consumer of `digitalAssetUsageLinks`, proving the "reuse" half of this addon's value proposition without touching or replacing the existing, separate homework-submission-attachment mechanism.

## Risk: [green] - small, additive, touches one existing route plus one new small route

## Dependencies
- Depends on: section-05 (and section-04's task 04-04, `resolveStudentAudienceContext`)
- Blocks: section-07
- Parallel batch: 4 (parallel with section-08)

## TDD Test Stubs
- Test: linking an asset a teacher doesn't have manage-rights to (another teacher's private draft) is rejected
- Test: linking an unpublished asset is rejected (only published assets can be reused)
- Test: unlinking removes the usage-link row without touching the asset or homework

## Tasks

<task type="auto" id="06-01">
  <name>Usage-link create/list/delete route</name>
  <files>src/app/api/content/assets/[id]/usage-links/route.ts</files>
  <action>
    POST: `requireRequestContext(req, ['school_admin', 'teacher'])` → `requireTenant` → `requireCapability(context, 'content.manage')` → Zod `.strict()` body `{ usageType: z.enum(['homework']), usageRefId: z.string() }` (only `'homework'` is wired in v1; `'announcement'`/`'live_class'` stay in the enum for forward-compat but have no linking UI yet — those modules aren't in scope for this addon). Verify the asset belongs to the tenant AND `status === 'published'` (an unpublished asset can't be linked, matching the spec's reuse model). Verify the referenced homework (`assessmentDefinitions` where `type = 'homework'`) belongs to the same tenant, using the exact tenant-ownership-check pattern this session already hardened for exam-schedules. Insert the usage-link row. `recordAudit`. GET: list usage-links for an asset (for the detail/version-history page's "usage backlinks" panel). DELETE `?usageRefId=`: removes a specific link.
  </action>
  <verify>Cross-tenant sweep (section-09): a teacher/admin from tenant B cannot create a usage-link referencing tenant A's real homework id or asset id.</verify>
  <done>Usage-link CRUD exists, tenant-scoped, published-only linking enforced.</done>
</task>

<task type="auto" id="06-02">
  <name>Surface linked resources on the homework GET response</name>
  <files>src/app/api/academics/homework/route.ts, src/features/assessment/services/homework-service.ts</files>
  <action>
    In `HomeworkService.getHomeworkForStudent`, after resolving `visibleHomeworks`, batch-fetch `digitalAssetUsageLinks` where `usageType = 'homework' AND usageRefId IN (visible homework ids)`, join to `digitalAssets` for title/currentVersionId, and attach as a `linkedResources` array on each homework's response object. Apply the SAME `isAssetVisibleToUser` check here as the download route uses — a linked resource that isn't actually targeted to this student must not appear in this list even though it's linked to a homework they can see (the homework and the resource have independent audiences; linking doesn't imply visibility). This is a read-only addition to an existing, already-real function from this session's assessment-and-examination remediation — no existing homework behavior changes.
  </action>
  <verify>(Live, section-09) A homework with a linked resource that is NOT targeted to a given student shows the homework without that resource in `linkedResources` for that student, while a student who IS targeted sees it.</verify>
  <done>getHomeworkForStudent's response includes real, audience-filtered linkedResources; existing homework fields/behavior unchanged.</done>
</task>
