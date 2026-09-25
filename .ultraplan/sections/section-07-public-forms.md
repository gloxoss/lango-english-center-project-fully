# Section 07: Public forms bot protection

## Overview
`POST /api/public/inquiries/[tenantSlug]` has a honeypot field and `checkRateLimit` (5/hour/IP), which is in-memory per process. `POST /api/public/signup` — check what it has. No captcha anywhere.

## Risk: [yellow] Lazy default: do nothing until spam is seen. Build only if D7 says so or spam appears.

## Dependencies
- Depends on: D7 · Blocks: none · Batch 1 · Hub item: `task:up-07-public-forms`

## Tasks

<task type="auto" id="07-01">
  <name>Measure before building</name>
  <files>none</files>
  <action>
    Report: (a) what protection /api/public/signup has; (b) whether checkRateLimit (src/libs/api/rate-limit) is in-memory; (c) how many inquiries exist per tenant per day in the dev and (if accessible, read-only) production data. Post via hub say. If there is no spam and D7 is not "build now", mark the section done with that evidence.
  </action>
  <verify>Numbers posted.</verify>
  <done>Decision made on evidence.</done>
</task>

<task type="auto" id="07-02">
  <name>Turnstile on the two public forms (only if 07-01 or D7 says build)</name>
  <files>lango-app/src/libs/api/turnstile.ts (new, ~15 lines), the two public route files, their two form components</files>
  <action>
    Server: verifyTurnstile(token, ip) = POST to https://challenges.cloudflare.com/turnstile/v0/siteverify with fetch (no SDK). If TURNSTILE_SECRET_KEY is unset, return true (dev). Call it first in both POST handlers; 400 CAPTCHA_FAILED on false.
    Client: load https://challenges.cloudflare.com/turnstile/v0/api.js with a plain script tag and read the token from the hidden input it injects. No npm package.
    Keep the honeypot and rate limit.
  </action>
  <verify>With the Cloudflare always-pass test keys the forms submit; with always-fail keys they return 400; unset key still works. tsc 0.</verify>
  <done>Bots need to beat a captcha.</done>
</task>
