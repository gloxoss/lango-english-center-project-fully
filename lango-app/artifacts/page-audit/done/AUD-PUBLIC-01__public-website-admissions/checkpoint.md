# AUD-PUBLIC-01 — CHECKPOINT (resume point)

- task: AUD-PUBLIC-01 — Public Website + Admissions/Inquiry Public Flows
- agent: codex-2 (Executor C)
- SCOPE DERIVED (brief was a title only): the **unauthenticated surface** —
  public school site + marketing site + public inquiry/admissions submission +
  public document verification + public token links. The STAFF admissions
  console (`/dashboard/students/admissions*`) is treated as OUT of scope unless
  the human says otherwise.
- target branch: origin/student-directory-hardening
- base: f42c2bc41cb2386afed52244c5355c31c8a91f96 (fetched, unchanged)
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-PUBLIC-01`
- branch: `audit/agent-c/AUD-PUBLIC-01-public-admissions`
- hub claim held: `task:AUD-PUBLIC-01` — files:
  `src/app/api/public`, `src/features/website`, `src/features/marketing`, this folder
- dev port: 3457 — CLAIM `task:port-3457` before starting a server
- node_modules: real `npm install --ignore-scripts` DONE

## ROUTE INVENTORY (discovered, not assumed) — 13 public pages
(school-site)/[tenantSlug]  home, about, contact, events, faq, gallery,
                            news, news/[slug], services   -> 9
(marketing)                                                   -> 1
verify/card/[token], verify/certificate/[token]               -> 2
verify-document                                               -> 1

## PUBLIC API (10 routes)
alumni-documents/verify, cards/verify, certificates/verify,
events/[tenantSlug], inquiries/[tenantSlug],
invitations/[token], invitations/[token]/accept,
signup, website/[tenantSlug]/images/[filename], website/[tenantSlug]/logo

## Findings + fixes (ALREADY DONE in worktree)
F-01 FIXED  Rate-limit key used the RAW `x-forwarded-for` header on 4 routes
            (inquiries, alumni-documents/verify, cards/verify, certificates/verify).
            A client sending a fresh header value per request got its own bucket,
            so 5/hr and 10/hr limits never tripped. Now `?.split(',')[0]?.trim()`,
            matching `public/signup`'s existing convention.
F-02 FIXED  `public/inquiries/[tenantSlug]` free-text fields unbounded
            (`notes`, `phone`, `website_hp`) on a no-login write endpoint.
            Now .max(2000)/.max(32)/.max(64).
F-03 FIXED  `public/invitations/[token]` GET had NO rate limit on an
            unauthenticated secret-token lookup (brute-forceable). Now 10/hr/IP.

VERIFIED SAFE (do not "fix"): `website/[tenantSlug]/images/[filename]` rejects any
filename failing `^[a-f0-9-]+\.(jpg|jpeg|png)$`, so no path traversal; all three
verify routes use an identical `{valid:false}` shape so there is no token/code
enumeration difference and never echo renderDataSnapshot/evidenceSnapshot.

## Files touched (worktree, uncommitted)
- src/app/api/public/inquiries/[tenantSlug]/route.ts
- src/app/api/public/alumni-documents/verify/route.ts
- src/app/api/public/cards/verify/route.ts
- src/app/api/public/certificates/verify/route.ts
- src/app/api/public/invitations/[token]/route.ts
- src/features/website/__tests__/public-endpoint-hardening.test.ts (NEW, 4 tests)

## NEXT EXACT ACTION
1. Run `npx vitest run src/features/website/__tests__/` -> expect 4/4.
2. Gates: `npm run check:types`, `check:isolation`, `check:i18n:keys`, `check:ui`.
3. Claim `task:port-3457`, start dev, screenshot all 13 public pages with
   `NO_LOGIN=1` (they are unauthenticated):
   AUDIT_BASE=http://localhost:3457 NO_LOGIN=1 node scripts/visual-sweep.mjs school_admin routes.txt out/
   Tenant slug for (school-site) comes from `tenants.slug` in schoolos_audit.
   Capture FR + AR RTL (public site is tri-lingual) and 390px mobile.
4. report.md from shared/REPORT_TEMPLATE.md -> commit -> push ->
   `hub done task:AUD-PUBLIC-01` -> release -> stop.

## GOTCHA (cost me time twice)
The Edit tool targets the SHARED tree path. This campaign must edit the WORKTREE
under `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-PUBLIC-01/lango-app/`.
If you edit the shared tree by mistake: copy the file into the worktree, then
restore the shared copy with `git show HEAD:./<path> > /tmp/x && cp /tmp/x <path>`
(write to /tmp FIRST — `git show > path` truncates the file before git runs).
