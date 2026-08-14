# Section 04: Attachment-Type Routes & Targeting Resolution

## Overview
Admin-configurable attachment-type taxonomy (CRUD) and the pure targeting-resolution function that decides whether a given user can see a given digital asset — the security-critical core this whole addon's audience-scoping correctness rests on.

## Risk: [green] - direct extension of the exact, already-proven `isHomeworkVisibleToStudent` pattern

## Dependencies
- Depends on: section-01
- Blocks: section-05
- Parallel batch: 2

## TDD Test Stubs
- Test: `isAssetVisibleToUser` — broadcast (no target rows) visible to everyone
- Test: `isAssetVisibleToUser` — 'school' target kind visible to everyone (distinct code path from "no targets", both true but for different reasons — assert both independently)
- Test: `isAssetVisibleToUser` — 'role' target visible only to matching role
- Test: `isAssetVisibleToUser` — 'class_section'/'class_subject'/'user' targets match the same way `isHomeworkVisibleToStudent` already validates
- Test: `isAssetVisibleToUser` — staff-only asset (attachmentType.studentVisible = false) is never visible to a student regardless of targets
- Test: archiving an attachment type referenced by an asset succeeds; there is no "delete" path for a referenced type (only archive)

## Tasks

<task type="auto" id="04-01">
  <name>Create the attachments feature service directory and the targeting-resolution pure function</name>
  <files>src/features/attachments/services/targeting-service.ts</files>
  <action>
    ```ts
    export type AssetTargetRow = {
      targetKind: 'school' | 'role' | 'class_offering' | 'class_section' | 'class_subject' | 'user';
      targetRoleValue: string | null;
      targetRefId: string | null;
    };

    export function isAssetVisibleToUser(
      targets: AssetTargetRow[],
      studentVisible: boolean,
      viewer: { userId: string; role: string; sectionId: string | null; offeringIds: string[]; classSubjectIds: string[] },
    ): boolean {
      if (viewer.role === 'student' && !studentVisible) return false;
      if (targets.length === 0) return true; // broadcast
      return targets.some((t) => {
        if (t.targetKind === 'school') return true;
        if (t.targetKind === 'role') return t.targetRoleValue === viewer.role;
        if (t.targetKind === 'user') return t.targetRefId === viewer.userId;
        if (t.targetKind === 'class_section') return viewer.sectionId !== null && t.targetRefId === viewer.sectionId;
        if (t.targetKind === 'class_offering') return t.targetRefId !== null && viewer.offeringIds.includes(t.targetRefId);
        if (t.targetKind === 'class_subject') return t.targetRefId !== null && viewer.classSubjectIds.includes(t.targetRefId);
        return false;
      });
    }
    ```
    This mirrors `isHomeworkVisibleToStudent`'s exact shape (broadcast-on-empty, `.some()` over target rows) with two additions: the `studentVisible` staff-only gate (checked first, short-circuits everything else — an answer key must never leak to a student even if a target row would otherwise match), and the `role`/`school`/`class_subject`/`user` target kinds the homework version didn't need. This function must be called directly by every route that filters or authorizes asset visibility (section-05's list and download routes) — no separate "test version" of this logic is ever written, matching this session's established regression-proof discipline.
  </action>
  <verify>Pure function, no I/O — directly unit-testable in section-08.</verify>
  <done>targeting-service.ts exports isAssetVisibleToUser.</done>
</task>

<task type="auto" id="04-02">
  <name>Attachment-type list/create route</name>
  <files>src/app/api/content/attachment-types/route.ts</files>
  <action>
    GET: `requireRequestContext(req)` (all authenticated roles can list active types, needed for the create-resource form) → `requireTenant` → return `attachmentTypes` where `tenantId = tenantId AND isActive = true`, ordered by `displayOrder`. POST: `requireRequestContext(req, ['school_admin'])` → `requireTenant` → `requireCapability(context, 'content.types.manage')` → Zod `.strict()` schema (name, code, icon, color, allowedMimeFamilies array, maxSizeBytes, studentVisible, downloadable, displayOrder) → insert → `recordAudit(context, 'create', 'attachment_type', created.id, { name })` (fire-and-forget, not awaited) → `apiErrorResponse()` catch-all. Follow the exact route shape already used in `src/app/api/academics/exam-halls/route.ts` (same GET-list/POST-create pattern) as the direct template.
  </action>
  <verify>Matches the established route convention exactly (requireRequestContext → requireTenant → requireCapability → Zod strict → tenant-scoped query → recordAudit → apiErrorResponse).</verify>
  <done>GET/POST work, tenant-scoped, POST requires content.types.manage.</done>
</task>

<task type="auto" id="04-03">
  <name>Attachment-type update/archive route</name>
  <files>src/app/api/content/attachment-types/[id]/route.ts</files>
  <action>
    PUT: same auth chain as POST above, updates editable fields (name/icon/color/policy fields), blocked if `isSystem = true` (system types are locked from rename, per spec — return `ApiError(403, 'SYSTEM_TYPE_LOCKED', ...)`). DELETE (semantically "archive", never a real hard delete from this route): sets `isActive = false` — always allowed even if referenced by assets, matching the spec's "referenced types are archived instead of deleted" rule (there is no hard-delete path for a type in this addon; permanent purge, if ever needed, is an out-of-scope operational action per PRD.md Section 7).
  </action>
  <verify>PUT on a system type returns 403; DELETE (archive) on a type with real referencing assets succeeds and the type row still exists with `isActive = false`.</verify>
  <done>Update/archive route exists, system-type lock enforced, archive never blocked by references.</done>
</task>

<task type="auto" id="04-04">
  <name>Extract a shared student-audience-context resolver (self-review fix: avoid duplicating homework-service.ts's classSections/classSubjects joins)</name>
  <files>src/libs/academics/audience-context.ts, src/features/assessment/services/homework-service.ts</files>
  <action>
    `HomeworkService.getHomeworkForStudent` already resolves a student's `sectionId`/`offeringIds` inline (join `user` → `classSections` → `classSubjects`). Extract that exact logic into a new shared helper: `export async function resolveStudentAudienceContext(studentId: string): Promise<{ sectionId: string | null; offeringIds: string[]; classSubjectIds: string[] }>` (add `classSubjectIds` — the ids themselves, not just `offeringId`s, since this addon's `class_subject` target kind needs them and the homework flow's `class_offering` target kind needs `offeringIds` — both are available from the same `classSubjects` query, just select both columns). Update `homework-service.ts` to call this helper instead of its inline version (behavior-identical, pure refactor — do not change `getHomeworkForStudent`'s existing output shape). Section-05's list/download routes and section-06's homework-reuse filtering both import and call this same helper for their student-viewer context, so there is exactly one place this join logic lives.
  </action>
  <verify>`homework-service.ts`'s existing behavior is unchanged (same tests from the assessment-and-examination remediation's test suite still pass); section-05/06 import the shared helper rather than re-deriving section/offering ids inline.</verify>
  <done>resolveStudentAudienceContext exists in one shared location, consumed by homework-service.ts (refactored) and this addon's routes (new).</done>
</task>
