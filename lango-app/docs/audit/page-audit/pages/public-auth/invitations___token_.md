# `/invitations/[token]`

**Status: PASS** · Module: `public-auth` · Source: [`src/app/[locale]/(auth)/invitations/[token]/page.tsx`](<../../../../../src/app/[locale]/(auth)/invitations/[token]/page.tsx>)

Guard: no guard in page.tsx (public page, or protected by its layout or client)

**Verdict:** No page-specific finding. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | anonymous | `/invitations/invalid-token-123` | expected: 404 /api/public/invitations/invalid-token-123 (expected not-found) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · anonymous · fr · `/invitations/invalid-token-123`

![anonymous fr](../../shots/C__anonymous-fr-__invitations__invalid-token-123.jpg)

## Plan

- No action. Keep this page in the regression sweep.
