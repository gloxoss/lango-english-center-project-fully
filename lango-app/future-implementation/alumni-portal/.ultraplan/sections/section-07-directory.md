# Section 07: Opt-In Directory & Safeguarding

## Overview
Implements the PRD's "Opt-in directory" Must Have and "Minors safeguarding" — per-field consent toggles (`alumniDirectoryConsent` from section-01), search respecting exactly what's opted in, and a real, shared 18+ eligibility check that section-08 (mentoring) also depends on.

## Risk: yellow - the safeguarding check is a real legal/child-safety property, must be correct everywhere it's used, not just in one place
Two consumers (directory search, mentoring listing) both need the identical eligibility rule — building it once as a shared, tested helper rather than duplicating the age-math in two places is the mitigation.

## Dependencies
- **Depends on:** section-01, section-03
- **Blocks:** section-08 (reuses this section's safeguarding helper)
- **Parallel batch:** 3

## TDD Test Stubs
- Test: An alumnus who has opted into `showName` and `showCohort` but not `showContactInfo` appears in directory search results with exactly those two fields populated, others omitted/null.
- Test: An alumnus with zero opted-in fields never appears in directory search results at all (not shown as an empty row).
- Test: An alumnus who is under 18 (computed from real `dateOfBirth`) never appears in directory search results, even if every field is opted in.
- Test: The alumnus's own consent settings page correctly reflects and updates each toggle independently.
- Test: Turning off a previously-on toggle immediately removes that field from future search results (no caching lag).

## Tasks

<task type="auto" id="07-01">
  <name>Build the shared safeguarding eligibility helper</name>
  <files>src/libs/services/alumni-safeguarding.ts</files>
  <action>
    New file. Export `isEligibleForDirectoryAndMentoring(dateOfBirth: string | null): boolean` — computes real age from `dateOfBirth` (reuse whatever date-math utility this codebase already has for age calculations, e.g. check if one exists near `attendance`/`admissions` age-related logic before writing a new one) and returns `false` if under 18 OR if `dateOfBirth` is null/unknown (fail closed — an alumnus with no recorded birthdate is never assumed safe to list, matching real child-safety discipline: unknown age is treated as a minor, not as an adult).
  </action>
  <verify>Unit-style verification via a few real curl/API calls with test users of known ages: exactly-17, exactly-18-today, 19, and null dateOfBirth — confirm the boolean is correct for each, especially the null case failing closed.</verify>
  <done>A real, single, shared safeguarding helper exists and is correct on all four real edge cases including the fail-closed null case.</done>
</task>

<task type="auto" id="07-02">
  <name>Build the alumnus's own consent settings endpoint</name>
  <files>src/app/api/alumni/me/preferences/route.ts</files>
  <action>
    New file. GET: `requireRequestContext(request, ['alumni'])`, returns the real, self-scoped `alumniDirectoryConsent` row (or real defaults — all false — if none exists yet, never fabricated true values). PUT: Zod `.strict()` schema for the 4 boolean toggles + `currentEmployer` text, upserts the self-scoped row. Also call task 07-01's helper and include a real `isEligible` field in the GET response so the UI can honestly tell an under-18 alumnus why their toggles won't take visible effect yet, rather than silently no-op-ing.
  </action>
  <verify>As the real test alumnus, toggle each field independently via curl, confirm persistence and that the response's `isEligible` reflects their real computed age.</verify>
  <done>Alumni can view and set their own real, per-field, honestly-labeled consent preferences.</done>
</task>

<task type="auto" id="07-03">
  <name>Build the directory search endpoint</name>
  <files>src/app/api/alumni/directory/route.ts</files>
  <action>
    New file. `requireRequestContext(request, ['alumni'])` (directory is alumni-to-alumni, not staff or public). Query real `alumniDirectoryConsent` rows joined to `user` (for `dateOfBirth`, name, cohort), filtered to rows where at least one `show*` field is true. For each candidate row, call task 07-01's helper — exclude ineligible (under-18/unknown-age) alumni from the result set entirely, not just from individual fields. For eligible, opted-in rows, project ONLY the fields the alumnus opted into (never return `email`/`phone`/`currentEmployer` unless `showContactInfo`/`showCurrentEmployer` is true for that specific row). Support a real `?search=` name filter and `?cohort=` filter, both applied only within the already-eligible-and-opted-in result set.
  </action>
  <verify>Create 3 real test alumni: one fully opted-in and eligible, one opted-in but under 18, one eligible but zero fields opted in. Confirm the directory response contains exactly one entry (the first), with only its opted-in fields populated.</verify>
  <done>The real directory search correctly respects per-field consent and the safeguarding age cutoff, verified against real mixed test data.</done>
</task>

<task type="auto" id="07-04">
  <name>Wire the directory browse and consent-settings UI</name>
  <files>src/app/[locale]/(alumni-portal)/alumni/directory/page.tsx, src/app/[locale]/(alumni-portal)/alumni/profile/page.tsx</files>
  <action>
    `directory/page.tsx`: real search/browse UI inside the portal shell, wired to task 07-03, rendering only whatever fields each result actually includes (never assume a field exists). `profile/page.tsx`: extends the profile page (or adds a Préférences tab to it) with real per-field toggles wired to task 07-02, showing a clear real message if the alumnus is currently ineligible due to age.
  </action>
  <verify>In the browser as the real test alumnus: toggle consent on, confirm they now appear when browsing as a different real alumni test account; toggle off, confirm they disappear.</verify>
  <done>Both the directory browse page and the consent settings page are real and working end to end.</done>
</task>
