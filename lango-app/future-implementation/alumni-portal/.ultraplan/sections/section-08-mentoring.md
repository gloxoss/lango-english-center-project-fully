# Section 08: Mentoring & Volunteering Listing

## Overview
Implements the PRD's "Mentoring listing" Must Have — a real opt-in list (`alumniMentorListings` from section-01), no automated matching, gated by section-07's shared safeguarding helper.

## Risk: green - simple real CRUD + listing, safeguarding logic already built and tested in section-07
Reuses, doesn't duplicate, the age-eligibility check.

## Dependencies
- **Depends on:** section-01, section-03, section-07 (reuses its safeguarding helper)
- **Blocks:** none
- **Parallel batch:** 3 (can start once section-07's helper task, 07-01, is done — doesn't need to wait for all of 07)

## TDD Test Stubs
- Test: An alumnus can create/update/deactivate their own real mentor listing.
- Test: An under-18 alumnus cannot be listed even if they submit a listing (rejected or silently excluded from browse, matching the same fail-closed discipline as directory).
- Test: Browsing the mentor list only ever shows real, active, eligible listings.
- Test: Deactivating a listing removes it from browse immediately.

## Tasks

<task type="auto" id="08-01">
  <name>Build the alumnus's own mentor-listing endpoint</name>
  <files>src/app/api/alumni/me/mentoring/route.ts</files>
  <action>
    New file. GET: `requireRequestContext(request, ['alumni'])`, returns the real, self-scoped `alumniMentorListings` row if present. PUT: Zod `.strict()` schema `{isActive: boolean, offering: string, contactPreference?: string}`, upserts the self-scoped row — but before allowing `isActive: true`, call section-07's `isEligibleForDirectoryAndMentoring()` helper on the alumnus's real `dateOfBirth`; if ineligible, reject with a clear real error rather than silently storing an inactive-but-technically-set listing.
  </action>
  <verify>As the real eligible test alumnus, create and update a real listing. As the real under-18 test alumnus, attempt to activate a listing — confirm it's rejected with a clear reason, not silently accepted.</verify>
  <done>Alumni can manage their own real mentor listing, with the safeguarding rule enforced at write time, not just at read time.</done>
</task>

<task type="auto" id="08-02">
  <name>Build the mentor-listing browse endpoint</name>
  <files>src/app/api/alumni/mentoring/route.ts</files>
  <action>
    New file. `requireRequestContext(request, ['alumni'])`. Query real `alumniMentorListings` where `isActive=true`, joined to `user` for name/`dateOfBirth`, filtered again through the safeguarding helper as a defense-in-depth check (even though 08-01 should already prevent an ineligible active listing from existing, don't rely solely on write-time enforcement for a safeguarding property — check again at read time).
  </action>
  <verify>Confirm the real eligible test alumnus's listing appears; confirm no ineligible listing can appear even if one were somehow forced into the table directly via psql (manually insert one bypassing the API, confirm the browse endpoint still filters it out).</verify>
  <done>The real mentor browse list is correct and defended at both write and read time against the safeguarding rule.</done>
</task>

<task type="auto" id="08-03">
  <name>Wire the mentoring UI</name>
  <files>src/app/[locale]/(alumni-portal)/alumni/mentoring/page.tsx</files>
  <action>
    Real page inside the portal shell with two parts: "Mon offre" (the alumnus's own listing form, wired to 08-01) and "Parcourir" (the real browse list, wired to 08-02, showing each mentor's real offering/contact preference, with a real, honest empty state ("Aucun mentor disponible pour le moment") when no eligible listings exist yet).
  </action>
  <verify>In the browser as the real test alumnus: create a listing, see it appear when browsing as a different real alumni test account.</verify>
  <done>The mentoring page is real and working end to end.</done>
</task>
