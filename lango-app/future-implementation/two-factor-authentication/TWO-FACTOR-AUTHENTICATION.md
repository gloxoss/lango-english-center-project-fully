# Two-Factor Authentication — Evaluation & Plan

**Status: not started, deliberately deferred (decided 2026-08-01).** Worth
noting this one is cheap to pick up whenever it's wanted — Better Auth
already ships the hard part (see below) — it just isn't next in line right
now. Read `AGENT-HANDOFF.md` first for overall project state.

## What the reference screenshots show

Two RamomSchool pages, shared 2026-08-01 (not saved to this repo — inline
in the conversation that produced this doc):

1. **"My 2FA Setup"** — QR code to scan with an authenticator app, a
   manual-entry secret key below it (`PNMSUJAYSPAZFAHL`-style, for apps
   that can't scan), an alternate **email-based** 2FA option, and an
   "Enable Two Factor Authentication" action. Numbered instructions:
   download an authenticator app, scan the QR, enter the verification
   code.
2. **"2FA Security → Settings"** — an admin/policy screen: global
   Enable/Disable toggle, "Remember Browser" Yes/No, cookie expiry
   duration ("1 Year"), and editable instruction text shown to users
   during setup (email instructions, app instructions).

Notably, the first screenshot carries a banner: *"It is Two Factor
Authentication Addon Features."* — RamomSchool paywalls 2FA as a purchased
addon. **Recommendation: don't copy that.** Account security shouldn't be
behind a paywall for an app handling real student PII under Moroccan CNDP
law — see "Addon or core?" below.

## The actual technical finding that changes this evaluation

This app already runs **Better Auth 1.6.18**, and Better Auth ships an
**official `two-factor` plugin** (confirmed present in
`node_modules/better-auth/dist/plugins/two-factor/`) that covers
essentially everything both screenshots show:

- **Schema** (its own migration, 2 additions): `user.twoFactorEnabled`
  (boolean) + a new `twoFactor` table (`secret`, `backupCodes`, `userId`,
  `verified`).
- **Server endpoints, provided automatically** by registering the plugin —
  no custom API routes needed: `/two-factor/enable`, `/two-factor/disable`,
  `/two-factor/get-totp-uri` (generates the QR data), `/two-factor/verify-totp`,
  `/two-factor/send-otp` + `/two-factor/verify-otp` (the email-code path,
  matching the screenshot's second option exactly), `/two-factor/generate-backup-codes`
  + `/two-factor/verify-backup-code`.
- **Trust-device / "remember browser"** is built into the plugin
  (`trustDeviceMaxAge` option) — maps directly to the screenshot's
  "2fa Show Remember Browser" + "2fa Cookie Expiry" settings.
- **Client-side**: `twoFactorClient()` auto-redirects a user to a
  configured challenge page when a sign-in needs a second factor
  (`twoFactorRedirect` in the response) — this is the actual login-time
  flow, not just the setup page.

**What's genuinely missing and would need building:** a QR-code
*rendering* library (the plugin gives you the TOTP URI string, not an
image — checked `package.json`, no `qrcode`/`react-qr-code` installed
currently; this is a small, standard, well-established dependency, not a
custom build) and the actual UI pages themselves (setup page, login
challenge page, admin policy settings if wanted).

## Why we'd want it

- This app already has one open, documented security gap (account lockout
  half-built — see `ARCHITECTURE.md`). 2FA is the natural companion
  hardening step for the same login path, worth planning together rather
  than as two disconnected passes.
- `super_admin` accounts are cross-tenant — a compromised super-admin
  credential is the single worst-case account takeover this app has.
  `school_admin` accounts hold financial data (invoices/payments) and full
  student PII.
- CNDP (Moroccan data-protection law) compliance is already a stated
  non-negotiable in this project's product truth doc — real access-control
  hardening like 2FA directly supports that, not just a nice-to-have.

## Scenarios (how the logic would actually work)

1. **Self-service setup (any authenticated user):** User opens
   Settings → Security. Clicks "Enable 2FA (App)". Client calls
   `/two-factor/get-totp-uri` → receives `totpURI` + a fresh set of
   backup codes. UI renders the URI as a QR image (new `qrcode` dependency)
   plus the raw secret as manual-entry fallback, exactly like the
   reference screenshot. User scans with Google Authenticator/Authy,
   types the 6-digit code back in → `/two-factor/verify-totp` confirms
   enrollment, `user.twoFactorEnabled` flips true. Backup codes are shown
   **once** with an explicit "save these now" warning, matching how the
   reference product surfaces its secret key.
2. **Login with 2FA active:** Normal email/password sign-in succeeds at
   the credential level, but the response carries `twoFactorRedirect:
   true` instead of a session. Client (via `onTwoFactorRedirect` /
   `twoFactorPage` option) routes to a "Verify your identity" challenge
   page. User enters the current 6-digit code →
   `/two-factor/verify-totp` → real session granted. Optional "Remember
   this device for 30 days" checkbox sets the plugin's trust-device
   cookie so that browser skips the challenge next time.
3. **Lost-device recovery:** On the challenge page, a "Use a backup code
   instead" link lets the user enter one of their saved one-time codes →
   `/two-factor/verify-backup-code` → session granted, that specific code
   is consumed and can't be reused.
4. **Email-OTP fallback (matches the screenshot's second panel):** Instead
   of an authenticator app, a user can request a one-time code emailed to
   them (`/two-factor/send-otp` then `/two-factor/verify-otp`) — useful
   for staff who won't install an authenticator app. Needs this app's
   existing email-sending capability wired to the plugin's `sendOTP` hook
   (check what email infra already exists before assuming SMTP is
   configured — this app's SMS is log-only by convention; email may or
   may not be real yet, verify before promising this path works).
5. **Disable:** Requires re-entering the current password before calling
   `/two-factor/disable` — prevents a session-hijacked attacker from
   silently turning protection off.
6. **Admin policy (the custom part — not provided by the plugin itself):**
   Decide whether 2FA is opt-in per user (simplest, matches the reference
   product's default) or **mandatory for specific roles**. Given the
   stakes described above, recommend requiring it for `super_admin`
   unconditionally, and offering `school_admin` a per-tenant
   "require 2FA for admins" toggle in `schoolSettings` — enforced by
   checking `user.twoFactorEnabled` at login for those roles and forcing
   setup before granting a session if not yet enabled, rather than just
   nagging.

## Addon or core?

**Recommendation: core, not an addon**, contrary to the reference
product's model. Reasoning: it's now confirmed cheap (official plugin,
not custom crypto), it closes a real documented security gap, and
paywalling basic account security is a poor look for a compliance-focused
product. If a monetization angle is still wanted later, gate the *admin
policy* (org-wide mandatory 2FA enforcement) behind a plan tier instead of
gating basic self-service 2FA — enforcement policy is a legitimate
"premium/enterprise" feature in a way that "can I protect my own account"
should not be.

## Page-by-page business logic (implementation-ready detail)

### 1. "My 2FA Setup" (self-service, `/dashboard/settings/security` or similar, any authenticated user)

- **Not-yet-enabled state**: explanation text + "Enable 2FA (App)" button
  and, separately, an "Enable 2FA (Email)" option — two independent
  methods per the reference screenshot's two-panel layout, a user could
  reasonably want either.
- **Enabling flow (App/TOTP)**: click "Enable" → call
  `/two-factor/get-totp-uri` → render the returned URI as a QR image
  (new `qrcode` dependency) plus the raw secret as selectable text below
  it (for manual entry when scanning isn't possible) → numbered
  instructions (download an authenticator app, scan, enter the code) →
  a single 6-digit input → submit calls `/two-factor/verify-totp` →
  on success, **immediately show the backup codes in a modal that must be
  explicitly dismissed** ("I've saved these codes" checkbox before the
  modal will close) — these are shown exactly once, this is the last
  chance to capture them.
- **Already-enabled state**: shows "2FA is active (App)" with a
  "Disable" button (requires re-entering password — see Scenario 5 above)
  and a "Regenerate backup codes" action (invalidates old codes, shows
  new ones once, same capture-confirmation pattern).
- **Data**: reads/writes `user.twoFactorEnabled` and the `twoFactor`
  table via the plugin's own endpoints — no custom schema needed for this
  page itself.

### 2. Login 2FA Challenge (new page in the auth flow, not part of the reference screenshots but required — reached automatically, never linked to directly)

- Shown only when a sign-in response carries `twoFactorRedirect: true`.
  Never reachable by URL for an account without 2FA enabled — guard
  against that explicitly (redirect home if hit directly with no pending
  2FA session state).
- Single 6-digit code input (TOTP), a "Use a backup code instead" link
  that swaps the input for a backup-code field, an optional "Request
  email code instead" link if the email-OTP method is also built.
- **"Remember this device for 30 days" checkbox** — sets the plugin's
  trust-device cookie on success; unchecked means every login from this
  browser challenges again.
- On success: real session granted, redirect to wherever the user was
  originally headed (preserve the original destination through the
  challenge, don't just dump everyone on the dashboard root).
- On repeated failure: this is where the *already-flagged* account
  lockout gap and 2FA intersect — a 2FA challenge with no rate limit is
  itself a brute-forceable 6-digit code (1 in a million per guess, but a
  bot doesn't get tired). Apply the same rate-limiting discipline already
  established elsewhere in this app (`src/libs/api/rate-limit.ts`, used
  by the public inquiry endpoint) to this challenge endpoint specifically,
  independent of whatever the general account-lockout fix ends up being.

### 3. Admin 2FA Policy page (only build if the mandatory-enforcement decision from "Scenarios" #6 is actually wanted)

- School-admin-facing toggle in existing settings: "Require 2FA for
  administrators" (per-tenant, new `schoolSettings` column).
  Super-admin's own requirement is unconditional and needs no toggle —
  hardcode it.
- **Enforcement business logic**: on login, after password succeeds, if
  the account's role requires 2FA (super_admin always; school_admin if
  the tenant's policy is on) and `user.twoFactorEnabled` is still false,
  redirect to a **mandatory setup flow** (a locked-down version of page 1
  above — can't be skipped or dismissed) instead of granting a session.
  This is different from the optional self-service flow: the user is
  authenticated but not yet fully in, similar in shape to the 2FA
  challenge itself, just for first-time forced enrollment rather than
  ongoing verification.

## Rough scope if this is picked up next

1. Register `twoFactor()` server plugin + `twoFactorClient()` in
   `src/libs/auth.ts` / the client auth instance.
2. Add `qrcode` (or equivalent minimal QR-rendering lib) as a dependency.
3. Generate + apply the plugin's migration (2 additions, same discipline
   as every other migration this session — both Docker images, live
   verify).
4. Build: setup page, login challenge page, backup-codes display/confirm
   step. Reuse existing form/modal patterns, don't invent new ones.
5. Decide and implement the admin-policy piece (mandatory for
   `super_admin`, optional-per-tenant for `school_admin`) only after
   confirming that's actually wanted — don't build enforcement policy
   speculatively.
6. Verify email-OTP path only if this app's email sending is confirmed
   real first (check before promising it in the UI).
