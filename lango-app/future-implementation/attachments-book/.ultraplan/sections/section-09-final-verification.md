# Section 09: Final Verification

## Overview
Live proof, not self-report: rebuild and redeploy the full stack including the new ClamAV service, then exercise the entire addon end-to-end against the real running app and real database — same discipline this session already applied twice (advanced-reporting, assessment-and-examination), including a real cross-tenant sweep and, uniquely to this addon, a real malware-detection test using the standard EICAR test string.

## Risk: [yellow] - first Docker Compose topology change this app has had (new clamav service + a new app dependency), real risk of a healthcheck-timing mistake silently letting uploads bypass scanning

## Dependencies
- Depends on: all (01-08)
- Blocks: none
- Parallel batch: 6

## TDD Test Stubs
- (execution/verification section — every check below IS the test, run against the real system)

## Tasks

<task type="auto" id="09-01">
  <name>Build and deploy the full stack including clamav</name>
  <files>docker-compose.yml</files>
  <action>
    `docker compose build migrate` then `docker compose build app` (sequentially, not in parallel — this session's established Docker discipline: parallel builds of `app`/`migrate` can race with a real `ETXTBSY`). Capture real exit codes to a log file, never through a `tail` pipe (masks exit codes). `docker compose up -d clamav`, wait for `docker compose ps` to show it `healthy` (may take several minutes on first pull/database load — this is expected, not a bug). Then `docker compose up -d migrate app` and confirm `migrate` exits 0 and `app` starts only after `clamav` is healthy (verify via `docker compose ps` showing `app`'s actual start timestamp is after `clamav` became healthy, confirming the `depends_on: condition: service_healthy` gate actually worked, not just that it's present in the YAML).
  </action>
  <verify>All three build/deploy steps show real, captured exit code 0. `app` did not start before `clamav` was healthy.</verify>
  <done>Full stack, including clamav, is live.</done>
</task>

<task type="auto" id="09-02">
  <name>Malware-detection live test (EICAR)</name>
  <files>(no files — live HTTP test)</files>
  <action>
    Write the standard EICAR antivirus test string (`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`) to a real `.txt` file, upload it via a real authenticated POST to `/api/content/assets` as a real teacher/admin session. Confirm the response reports an infected/rejected status (not success), then confirm via `psql` that the resulting `digitalAssetVersions` row has `scanStatus != 'clean'` and the asset's `status` is `'infected'` or `'scan_failed'`, and confirm the download route (section-05) returns 404 for this asset even to its own owner/admin. Also upload one genuinely clean small file (e.g. a real PNG) and confirm it reaches `'ready'`/publishes normally, proving the scanner isn't just failing everything open or closed indiscriminately.
  </action>
  <verify>Infected upload never becomes downloadable; clean upload works normally. Both outcomes confirmed via real HTTP responses AND a real `psql` row check, not just the API's self-reported success.</verify>
  <done>Real malware detection proven live against a real running clamd, not mocked.</done>
</task>

<task type="auto" id="09-03">
  <name>Targeting & audience live sweep</name>
  <files>(no files — live HTTP test)</files>
  <action>
    Using real students/teachers already seeded in the Atlas tenant (same accounts used for this session's assessment-and-examination verification): publish one resource targeted at a specific class-section only, confirm a student in that section can download it and a student in a different section gets 404. Publish a `studentVisible: false` (answer-key-style) resource targeted at that same section, confirm the section's student still cannot see or download it while a teacher can. Change an already-published resource's targets to exclude a previously-included student, immediately re-request the download as that student, confirm 404 on the very next request (no caching/signed-URL staleness).
  </action>
  <verify>Every one of the three real scenarios behaves exactly as designed, confirmed via real HTTP status codes and response bodies.</verify>
  <done>Audience-scoping correctness proven live, matching the PRD's stated success criteria verbatim.</done>
</task>

<task type="auto" id="09-04">
  <name>Cross-tenant sweep</name>
  <files>(no files — live HTTP test, plus route fixes if anything is found)</files>
  <action>
    Same technique that found and fixed a real cross-tenant bug in this session's assessment-and-examination remediation: create real resources/types/targets/usage-links in the Atlas tenant, then attempt every write and read route in this addon (create, replace-version, publish, archive, target, usage-link, download, type CRUD) from a Lango-tenant admin session using Atlas's real IDs. Any route that succeeds where it should 404/422 is a real bug — fix it immediately with the same tenant-ownership-check pattern used everywhere else in this codebase, rebuild, redeploy, and re-run the exact same sweep to confirm the fix, before considering this task done (do not just note the bug and move on).
  </action>
  <verify>Every cross-tenant attempt is rejected; any bug found is fixed and RE-VERIFIED live, not just fixed in code.</verify>
  <done>Zero cross-tenant write/read paths remain, proven by a real live sweep, matching the exact rigor of this session's prior two remediations.</done>
</task>

<task type="auto" id="09-05">
  <name>Version/reuse lifecycle live test</name>
  <files>(no files — live HTTP test)</files>
  <action>
    Create a resource, publish it, link it to a real homework (section-06), then replace its file (new version). Confirm via `psql`: the old version row still exists unchanged, the usage-link still points at the same `assetId` (not a version-specific id, so it automatically follows to the new current version — confirm the homework's `linkedResources` now serves the NEW version's content on download). Archive the resource and confirm the homework's `linkedResources` for it either disappears or is clearly marked unavailable (do not serve an archived asset's file through the download route — the download route's `status === 'published'` check already covers this; confirm the live behavior matches).
  </action>
  <verify>Real version history, real reuse pointer stability, real archive-blocks-download behavior, all confirmed via live HTTP + psql, not just code review.</verify>
  <done>Full versioning/reuse lifecycle proven live.</done>
</task>

<task type="auto" id="09-06">
  <name>Final tsc, tenant-isolation script, and test suite</name>
  <files>(no files — verification commands)</files>
  <action>
    Run `./node_modules/.bin/tsc --noEmit` locally on the host (not inside the runtime image, which lacks devDependencies — established finding from this session), capture the real exit code. Run `npx vitest run` for `attachments.test.ts` (section-08) and confirm all pass. Run `scripts/check-tenant-isolation.ts` and confirm it flags no NEW files beyond the same 3 pre-existing, out-of-scope files already documented in this session's prior two remediation PLAN.md files (`academics/promotions`, `settings/migration/tasks/[id]`, `settings/migration/template`) — any new file flagged here is a real bug in this addon's routes and must be fixed before this task is done.
  </action>
  <verify>tsc exit 0, all attachments tests pass, tenant-isolation script shows no new flagged files from this addon.</verify>
  <done>All three final checks pass clean; findings written into PLAN.md's Review Notes, matching the exact documentation pattern used for both prior remediations this session.</done>
</task>
