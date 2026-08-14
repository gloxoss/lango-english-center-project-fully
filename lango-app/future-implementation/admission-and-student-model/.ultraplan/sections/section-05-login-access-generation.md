# Section 05: Real Login Access on Approval

## Overview
Implements the PRD's "Real login access on approval" requirement — the last piece closing the gap where an approved, enrolled student has no way to actually sign in. A school-wide setting (per Discovery) decides whether approval generates an invite-link (delivered through the existing log-only simulated-SMS system) or a one-time temp password shown to the approving admin.

## Risk: red - genuinely new territory for this codebase, security-sensitive
Nothing like programmatic account creation exists anywhere in this app yet (confirmed by RESEARCH.md — no prior pattern found). The exact Better Auth server API call must be verified against the installed version before implementation, not assumed from general Better Auth knowledge. This section creates real login credentials, which is inherently security-sensitive — get this wrong and either accounts don't work, or worse, are created insecurely.

## Dependencies
- **Depends on:** section-04 (guardian-search-link) — same approval transaction, and the invite-link delivery target is the linked guardian's phone from that section's work
- **Blocks:** none (last section)
- **Parallel batch:** 4

## TDD Test Stubs
- Test: With the school setting on "invite-link", approving an applicant creates a real, single-use token tied to the new student, and a real smsMessages row is created addressed to the linked guardian's phone containing a real link.
- Test: With the school setting on "temp password", approving an applicant creates a real Better Auth account for the new student with a random password, and that exact password is returned once in the approval API response.
- Test: A temp password is never stored in plain text anywhere after the approval response — only its hash exists in the account table.
- Test: An invite-link token can be redeemed exactly once; a second redemption attempt is rejected.
- Test: An invite-link token expires after a reasonable window (e.g. 7 days) and a redemption attempt after expiry is rejected with a clear message.
- Test: Approving an applicant with no linked guardian and no guardian phone on file, under the invite-link setting, still succeeds — the approval doesn't fail, but the response clearly indicates delivery couldn't happen (no fabricated phone number, no silent failure).
- Test: Changing the school-wide setting in Settings actually changes which mechanism the next approval uses.

## Tasks

<task type="auto" id="05-01">
  <name>Verify the real Better Auth server API for account creation</name>
  <files>none</files>
  <action>
    Before writing any code in this section, read the installed better-auth package version (check package.json) and its actual server-side API for programmatically creating a user + credential account (commonly `auth.api.signUpEmail` or equivalent in that version — do not assume the exact method name or parameter shape without checking the installed package's types/docs). Confirm whether it can create an account for an existing `user` table row (this app's `user` table is the school-domain identity, separately linked to Better Auth's own account/session tables) or whether it always creates both — if it always creates both, confirm how to reconcile that with the `user` row already created earlier in the same approval transaction (likely: use the Better Auth API to create the `account` credential row only, pointed at the existing user id, rather than letting it create a duplicate user).
  </action>
  <verify>Document the confirmed API shape (method name, parameters, return value) as a comment at the top of the implementation task below before proceeding.</verify>
  <done>The exact, version-correct Better Auth server API for creating a credential account tied to an existing user id is confirmed, not assumed.</done>
</task>

<task type="auto" id="05-02">
  <name>Add login-access-method setting and invite-token table</name>
  <files>src/models/Schema.ts, migrations/{NEXT}_add_login_access_setting.sql, migrations/meta/_journal.json</files>
  <action>
    Add `loginAccessMethod: varchar('login_access_method', { length: 20 }).default('invite_link').notNull()` to `schoolSettings` (values: 'invite_link' | 'temp_password'). Add a new small table `accountSetupTokens` (id uuid pk, tenantId uuid FK, userId text FK to user.id, token varchar(64) unique not null, expiresAt timestamp not null, usedAt timestamp nullable, createdAt timestamp default now) — deliberately scoped to first-login setup only, not a general password-reset system. The `token` column's own uniqueness constraint already indexes lookups by token; also add an index on `userId` for the (less common but real) case of looking up a user's outstanding setup tokens. Re-check the true highest migration idx at execution time. Write the migration and journal entry for both changes.
  </action>
  <verify>Apply via psql, confirm schoolSettings.login_access_method exists with its default, confirm account_setup_tokens table exists with all columns and both foreign keys.</verify>
  <done>The school-wide login-mechanism setting and the invite-token table both exist in the real database.</done>
</task>

<task type="auto" id="05-03">
  <name>Add login-access setting to the Settings page</name>
  <files>src/features/settings/ui/settings-view.tsx, src/app/api/settings/route.ts</files>
  <action>
    In the existing real Settings GET/POST (already reads/writes schoolSettings), add loginAccessMethod to the accepted/returned fields. In settings-view.tsx, add a labeled radio or select control ("Accès à la connexion pour les nouveaux élèves": "Lien d'invitation (SMS)" vs "Mot de passe temporaire") wherever the form's existing fields are grouped, following the same save pattern already used for the rest of that form. Use native radio inputs with real `<label>` associations (not custom-styled divs) so the choice is keyboard- and screen-reader-accessible, matching this app's existing form-control convention.
  </action>
  <verify>Change the setting, save, reload the page, confirm the new value persists and reflects in a direct GET /api/settings response.</verify>
  <done>A school admin can choose the login-access mechanism from the real Settings page, and it persists.</done>
</task>

<task type="auto" id="05-04">
  <name>Generate login access inside the approval transaction</name>
  <files>src/app/api/students/admissions/route.ts</files>
  <action>
    After the guardian-linking step from Section 04, read the tenant's `schoolSettings.loginAccessMethod`. If `temp_password`: generate a cryptographically random password (reuse an existing random-token utility in this codebase if one exists, otherwise Node's `crypto.randomBytes`), create the credential account using Task 05-01's confirmed API pointed at the new student's user id, and include the plain password once in this endpoint's JSON response under a clearly-named field like `tempPassword` (never log it, never store it anywhere else — specifically, confirm the `recordAudit(context, 'update', 'admission_request', ...)` call already made for this approval does not receive the password in its metadata argument; audit log entries are read by other admins and are not an appropriate place for a live credential). If `invite_link`: generate a random token, insert an `accountSetupTokens` row (7-day expiry), determine the delivery phone from the just-linked guardian (Section 04) if one exists, and if a phone is available insert a real `smsMessages` row containing a link like `/{locale}/setup-account?token={token}` — if no guardian phone is available, skip the SMS insert and include a field in the response like `loginAccessDeliveryStatus: 'no_guardian_phone'` so the admin sees it clearly instead of a silent no-op.
  </action>
  <verify>Approve a real applicant under each setting (toggle Settings between runs) and confirm the described DB rows/response fields for each path via real queries, not log lines.</verify>
  <done>Approving an admission generates real login access using whichever mechanism the school has configured, with an honest, visible outcome either way.</done>
</task>

<task type="auto" id="05-05">
  <name>Build the account-setup redemption endpoint</name>
  <files>src/app/api/auth/setup-account/route.ts</files>
  <action>
    Create POST /api/auth/setup-account accepting `{ token, password }` (no auth required — this IS the login-establishment step). Look up the token in accountSetupTokens, reject if not found, already used (`usedAt` set), or expired. If valid, create the credential account for the token's userId using Task 05-01's confirmed API with the submitted password, mark the token `usedAt = now()`, return success.
  </action>
  <verify>Redeem a real token with a real password, confirm the account now exists and the token is marked used. Attempt to redeem the same token again, confirm it's rejected. Attempt an expired token, confirm it's rejected.</verify>
  <done>A guardian/student can turn a real invite-link token into real login credentials exactly once.</done>
</task>

<task type="auto" id="05-06">
  <name>Add a regenerate-access action for already-enrolled students</name>
  <files>src/app/api/students/[id]/regenerate-access/route.ts, src/features/students/ui/student-profile-view.tsx</files>
  <action>
    Closes a real support gap surfaced during review: a temp password or invite-link SMS that never reaches the guardian currently has no recovery path once approval is over. Create POST /api/students/[id]/regenerate-access, `requireRequestContext(['school_admin'])`, that repeats Task 05-04's exact logic (read `schoolSettings.loginAccessMethod`, generate a new temp password or a new `accountSetupTokens` row + smsMessages entry) against an already-enrolled student instead of inside the approval transaction — this is a standalone action, not wrapped in the admission-approval transaction. Add a small "Régénérer l'accès" button to the student profile view (school_admin only, reuse the existing `usePermissions`/role-gating pattern from earlier work in this app) that calls this endpoint and shows the same response (temp password shown once, or "SMS envoyé" confirmation).
  </action>
  <verify>Call the endpoint for a real enrolled student under each access-method setting, confirm the same real outcomes as Task 05-04's tests (new credential works, or new token/SMS row created), confirm any previous unused invite token for that student is invalidated so only the newest one works.</verify>
  <done>A school_admin can regenerate a student's login access after the fact if the original delivery never reached the guardian.</done>
</task>

<task type="checkpoint" id="05-07">
  <name>Verify the full login-access flow end to end with the user</name>
  <files>none</files>
  <action>
    Walk through both mechanisms against the real running app: (1) set the school setting to temp_password, approve a real test applicant, confirm the returned password actually logs the new student in; (2) set the school setting to invite_link, approve a real test applicant with a linked guardian who has a phone on file, confirm a real smsMessages row was created with a working link, and confirm redeeming that link's token via the setup-account endpoint actually results in a working login. Present both results to the user for confirmation before considering this section done — this is the most security-sensitive part of the whole plan and should not be marked complete on the AI's own assessment alone.
  </action>
  <verify>User confirms both login-access mechanisms produce a real, working login for a real test account.</verify>
  <done>Both login-access mechanisms verified working end-to-end and approved by the user.</done>
</task>
