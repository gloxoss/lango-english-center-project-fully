# Section 03: Alumni Portal Shell & Announcements

## Overview
Implements the PRD's "Alumni self-service login" surface and "Should Have" announcements. Alumni are a genuinely different audience from staff (they never see the internal admin dashboard), so this section creates a new, separate route group with its own layout and auth guard — not another item bolted onto the staff `(dashboard)` shell. Sections 04/06/07/08 each add their own page under this shell; this section only builds the shell itself, the home/dashboard page, and announcements.

## Risk: green - layout/routing work over an already-real auth system, no novel logic
The auth guard reuses `requireRequestContext`-equivalent session checking already proven throughout this app; the only genuinely new part is the route-group boundary itself, which is a standard, well-understood Next.js App Router pattern.

## Dependencies
- **Depends on:** section-01, section-02 (a real alumni account must exist to test login against)
- **Blocks:** section-04, section-06, section-07, section-08 (each adds a page into this shell)
- **Parallel batch:** 2 (buildable in parallel with section-02's backend, but end-to-end testing needs 02's transition endpoint to produce a real test account)

## TDD Test Stubs
- Test: A user with `role='alumni'` can log in and reach the alumni portal home page.
- Test: A user with `role='student'`/`'teacher'`/`'school_admin'` is redirected away from the alumni portal (never sees another audience's surface).
- Test: The home page shows real announcements (not hardcoded), a real profile-completeness indicator based on actual filled/missing fields, and real quick links to records/events/directory/mentoring.
- Test: A real announcement created by staff triggers a real (logged) SMS notification to opted-in alumni, respecting `smsOptIn`-equivalent consent.
- Test: The old fake `alumni-portal-view.tsx` page and its mock data are fully removed, not just hidden.

## Tasks

<task type="auto" id="03-01">
  <name>Delete the fake alumni portal view and its mock data</name>
  <files>src/features/crm/ui/alumni-portal-view.tsx</files>
  <action>
    Confirm via `git status`/`git log` that this file is safe to remove (it is, per research: 100% hardcoded mock arrays, no real logic). Delete the file. Leave `src/app/[locale]/(dashboard)/dashboard/portals/alumni/page.tsx` for task 03-03 to either repurpose as a staff-side admin overview or remove, depending on what the admin-side alumni management screen needs — decide in that task, not here.
  </action>
  <verify>Grep the codebase for any remaining import of `alumni-portal-view` — must be none after this task (fix the page.tsx import in the same commit if it still references the deleted file, to avoid a broken build in the interim).</verify>
  <done>The fake, mock-data alumni portal component is fully removed from the codebase.</done>
</task>

<task type="auto" id="03-02">
  <name>Build the alumni portal route group, layout, and auth guard</name>
  <files>src/app/[locale]/(alumni-portal)/alumni/layout.tsx, src/app/[locale]/(alumni-portal)/alumni/page.tsx, src/app/[locale]/(dashboard)/layout.tsx</files>
  <action>
    New route group `(alumni-portal)` parallel to the existing `(dashboard)` group, so alumni get a fully separate shell (nav: Accueil/Dossiers/Événements/Annuaire/Mentorat/Mes demandes/Profil — no staff-side navigation). `layout.tsx` checks the real session server-side; if no session, redirect to the existing login page; if `role !== 'alumni'`, redirect to `/dashboard` (the reverse guard). Rather than touch the shared login page's unconditional `/dashboard` post-login redirect, add a small role check to the EXISTING `(dashboard)/layout.tsx` instead: after its existing session check, look up the real user's role and redirect to `/${locale}/alumni` if `role === 'alumni'` — the login page itself always sends everyone to `/dashboard` first, and the two layouts route them to the correct shell from there. `page.tsx` is the home page: fetches `GET /api/alumni/me/profile` (built in task 03-04) for profile-completeness, and a new announcements list (task 03-05).
  </action>
  <verify>Log in as a real transitioned alumni test account (from section-02's testing) and confirm they land on the alumni home page, not the staff dashboard. Log in as a real school_admin and confirm navigating directly to `/alumni` redirects them back to `/dashboard`, never seeing the alumni shell.</verify>
  <done>A real, separate alumni portal shell exists with a working role-gated auth boundary.</done>
</task>

<task type="auto" id="03-03">
  <name>Rebuild the staff-side alumni admin overview</name>
  <files>src/app/[locale]/(dashboard)/dashboard/students/alumni/page.tsx, src/features/students/ui/alumni-admin-view.tsx</files>
  <action>
    New real staff-side page (replacing the old `portals/alumni` route, which gets removed since it was the fake page's mount point) at `/dashboard/students/alumni`: a real, paginated (reuse `parsePagination`, matching every other staff list in this app) list of all `role='alumni'` users for the tenant, with columns for name, graduation cohort, transition date, directory opt-in status. A real, honest empty state ("Aucun ancien élève pour le moment") when the tenant has none yet — not a blank gap. Links to each alumni's real profile (reusing `student-detail-view.tsx`'s existing per-person detail pattern, since alumni are still `user` rows). Add a nav entry for this under the existing Students section in the staff sidebar.
  </action>
  <verify>In the browser as school_admin: see the real transitioned test alumnus in this list with correct real data, click through to their detail page.</verify>
  <done>Staff have a real, working admin overview of all alumni, replacing the removed fake portal page.</done>
</task>

<task type="auto" id="03-04">
  <name>Build GET/PATCH /api/alumni/me/profile</name>
  <files>src/app/api/alumni/me/profile/route.ts</files>
  <action>
    New file. GET: `requireRequestContext(request, ['alumni'])`, returns the real, self-scoped (`context.userId`) profile fields (name, email, phone, graduation cohort via `sessionYears` join, `alumniTransitionedAt`) plus a computed `profileCompleteness` percentage based on how many of a real, fixed field checklist (photo, current employer via `alumniDirectoryConsent`, phone) are filled. PATCH: lets the alumnus update their own real contact fields (email, phone) — never their academic history, matching "corrections remain controlled" from the PRD. Cap: none beyond the role check itself (self-scoped by `context.userId`, no separate capability needed since every alumni can only ever touch their own row).
  </action>
  <verify>GET as the real test alumnus returns their real data with a sensible completeness percentage. PATCH updates phone/email and a subsequent GET reflects it. GET/PATCH as a different alumnus's ID is impossible by construction (route is self-scoped, takes no ID param).</verify>
  <done>Alumni can read and update their own real, limited profile fields via a real self-scoped API.</done>
</task>

<task type="auto" id="03-05">
  <name>Build real announcements with SMS notification</name>
  <files>src/app/api/communication/announcements/route.ts</files>
  <action>
    Real reuse discovered during execution: the existing `announcements` table (`Schema.ts`) already has a generic `targetRole` column typed against the same `role` enum alumni was added to, and `GET/POST /api/communication/announcements` is already fully generic (any authenticated role can GET their own targeted announcements; `requireRequestContext(request)` with no role restriction already works for `role='alumni'`) — no new alumni-specific routes needed. Only two changes: (1) extend the POST handler's Zod `targetRole` enum to include `'alumni'`; (2) when `targetRole === 'alumni'`, after inserting the announcement, insert a real `smsMessages` row for every alumni user with a real phone number (no separate opt-in column exists on `user` for this - matches the existing admission-invite SMS precedent, which also has no opt-in gate, just a phone-presence check).
  </action>
  <verify>Post a real announcement with `targetRole: 'alumni'` as staff, confirm real `smsMessages` rows appear for alumni test accounts with a phone number. Confirm `GET /api/communication/announcements` as a real alumni test account returns it (and that a `targetRole: 'student'` announcement does NOT appear for them).</verify>
  <done>Staff can post real alumni announcements that alumni see in their portal and receive as a real (logged) SMS notification.</done>
</task>
