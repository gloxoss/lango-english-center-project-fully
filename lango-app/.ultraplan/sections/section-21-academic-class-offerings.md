# Section 21: Academic Class Offerings — schema + core CRUD

## Overview
The foundational table for everything else in this plan: `academicClassOfferings` links a `classSection` to a specific `sessionYear`, carrying capacity (per Discovery: added here, not on `classSections`, since capacity is inherently a per-year concept) and an active/archived status. This is what makes "configure next year while this year stays live" possible. Includes the initial backfill: every existing `classSection` gets exactly one offering row, in that tenant's default session.

## Risk: [yellow] - new table + backfill migration touching every tenant's existing data, but purely additive (no existing column changes, no existing route changes)

## Dependencies
- Depends on: section-20 (ADR)
- Blocks: section-22, section-30
- Parallel batch: 1

## TDD Test Stubs
- Test: backfill creates exactly one offering per existing classSection, in that tenant's isDefault session
- Test: POST /api/academics/class-offerings rejects a duplicate (tenantId, sessionYearId, classId, sectionId) tuple
- Test: GET is tenant-scoped and cross-tenant classSectionId/sessionYearId references are rejected on POST
- Test: DELETE on an offering referenced by classSubjects/classTeachers/etc. (once section-22 lands) returns 409, not a hard delete - covered fully once section-22's FKs exist, this section's DELETE just needs to not break on an offering with zero references yet

## Tasks

<task type="auto" id="21-01">
  <name>Add academicClassOfferings table to Schema.ts</name>
  <files>src/models/Schema.ts</files>
  <action>
    Re-check `migrations/meta/_journal.json`'s true highest idx first (do not trust any number recorded elsewhere in this plan). Add a new `academicClassOfferings` pgTable: id (uuid pk), tenantId, sessionYearId (fk sessionYears, cascade), classId (fk classes, cascade), sectionId (fk sections, cascade), capacity (integer, nullable), status (reuse the existing `status` pgEnum: active/inactive/archived), displayOrder (integer, default 0), createdAt, updatedAt. Unique constraint on (tenantId, sessionYearId, classId, sectionId). If Schema.ts is dirty from the other session at execution time, use the isolated-git-blob technique (git show HEAD:path > temp, apply only this table addition to temp, hash-object, update-index --cacheinfo) rather than waiting - this exact technique was used successfully for the promotion ledger tables this session.
  </action>
  <verify>docker compose build migrate; drizzle-kit check passes</verify>
  <done>Table defined, matches the ADR's decision exactly, migration builds cleanly</done>
</task>

<task type="auto" id="21-02">
  <name>Write the migration + backfill</name>
  <files>migrations/00XX_add_academic_class_offerings.sql (new, next available number per _journal.json), migrations/meta/_journal.json</files>
  <action>
    CREATE TABLE academic_class_offerings matching the Schema.ts definition. Then an INSERT...SELECT backfill: for every row in class_sections, insert one academic_class_offerings row using that tenant's session_years row where is_default = true, capacity NULL, status 'active', display_order 0. If a tenant has no default session year, skip that tenant's class_sections (log via a comment - this is an existing data-integrity gap outside this plan's scope, not something to silently invent a session for).
  </action>
  <verify>docker compose build migrate; docker compose run --rm migrate; psql \d academic_class_offerings; verify row count matches count(class_sections) for tenants with a default session</verify>
  <done>Migration applies cleanly, backfill produces exactly one row per eligible classSection, journal entry added</done>
</task>

<task type="auto" id="21-03">
  <name>Build /api/academics/class-offerings route</name>
  <files>src/app/api/academics/class-offerings/route.ts (new)</files>
  <action>
    GET (tenant-scoped, optional ?sessionYearId= filter, joins classes/sections for display names), POST (requireCapability 'academics.manage', validates classId/sectionId/sessionYearId belong to tenant, rejects duplicate tuple), PUT (update capacity/status/displayOrder only - classId/sectionId/sessionYearId are immutable once created, matching the doc's "archive over destructive deletion" preference), DELETE (soft - sets status 'archived' rather than removing the row, since section-22's FKs will reference offerings and a hard delete would orphan them).
  </action>
  <verify>manual curl round-trip against a real tenant; duplicate-tuple rejection test passes; cross-tenant classId/sectionId/sessionYearId rejected</verify>
  <done>Full CRUD works, tenant-isolated, admin-only writes, duplicates rejected, delete is archive-not-remove</done>
</task>
