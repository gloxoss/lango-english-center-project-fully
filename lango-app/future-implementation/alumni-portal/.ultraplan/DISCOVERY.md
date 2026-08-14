# UltraPlan Discovery — Alumni Portal

## Project Idea
See `.ultraplan/STATE.md` "Idea" section — full alumni lifecycle, records, events/community, opt-in directory, profile, and requests, built on the existing spec at `future-implementation/alumni-portal/ALUMNI-PORTAL-PLAN.md`.

## Codebase Context
Existing, actively-developed codebase: SchoolOS/Lango, Next.js App Router + Drizzle ORM + PostgreSQL + Better Auth, multi-tenant. New, security-sensitive domain relative to prior work this session (consent, minors safeguarding, document verification, data subject rights) — full discovery warranted, not condensed, given real legal/safeguarding stakes.

## Discovery Q&A

<!-- Categories: 9 total -->

### Category 1: Core Requirements (batch 1/many)

**Q: Build all 4 delivery phases now, or stop at a specific phase?**
A: All 4 phases — directory/mentoring built now with real safeguarding rules baked directly into the design (age cutoff, consent gating, minors excluded), not treated as a separate future approval gate.

**Q: Should alumni get a real, separate self-service portal login?**
A: Yes — real self-service login (new role, real Better Auth credentials), matching what `/api/alumni/me/...` and "account/security settings" in the source doc imply.

**Q: How should "alumni" be modeled relative to the existing student/user system?**
A: Same user row — role flips from `student` to a new `alumni` value at transition. Preserves real identity/history, matches how `role` already works for other portal-style users (parent/teacher/etc.) in this app, no duplicate person record.

### Category 1: Core Requirements (batch 2/many)

**Q: What triggers the student→alumni transition?**
A: Manual admin action per student with a real confirmation step — a real human decision, matches "never silently repurpose" from the source doc. No automatic/bulk transition tied to another status change.

**Q: What happens to the student's login access at transition?**
A: Student login is fully disabled at transition; a new alumni invitation/setup flow issues fresh alumni credentials (mirrors the already-real invite-link/temp-password pattern built for admission approval this session). Matches "graduation closes learner operational access" literally.

**Q: Minors safeguarding age cutoff for directory/mentoring eligibility?**
A: 18 — alumni under 18 at transition are excluded from directory/mentoring until they turn 18, even if already graduated.

### Category 1: Core Requirements — Records (batch 3/many)

**Q: What should "secure verification" of alumni records actually let a third party do?**
A: A real public (no-login) verification page — paste/scan a code, confirms a document is genuine ("issued by [school] to [name] on [date]") without exposing the file itself. Real trust signal for employers.

**Q: How are record correction requests handled?**
A: Real staff-reviewed request queue — alumni submits a request with a note, staff makes the actual change. Alumni never self-edit official records directly.

**Q: How is document reissue handled?**
A: Same request-queue pattern — alumni requests, staff approves, the real document is (re)issued. No fully self-service instant reissue.

### Category 2: Users & Context / Category 3: Integration Points (batch 1/1)

**Q: Who administers the alumni module?**
A: `school_admin` only, reusing existing roles and capability checks — no new staff role.

**Q: Should alumni events reuse the separate, unbuilt `event-management` addon or get their own model?**
A: Alumni gets its own small, self-contained events table now — not blocked on a different, not-yet-started plan.

**Q: What should mentoring/volunteering actually do?**
A: Real opt-in listing only — alumni signal willingness, staff/other alumni see who opted in and reach out manually. No automated matching/request-accept workflow. Gated by the same 18+ safeguarding rule.

### Category 4/5: Edge Cases & Security (batch 1/1)

**Q: What does a real "deletion" request actually delete, given legal record retention?**
A: Only community/optional data (directory listing, preferences, mentoring opt-in) — official records are explicitly kept, and the alumnus is told why. Matches the source doc's own retention rule literally.

**Q: How granular is directory consent?**
A: Per-field toggles (name, cohort, current employer, contact info, etc., each independently) — not one all-or-nothing switch. Matches "opt-in fields only."

**Q: What happens if a former alumnus is re-admitted as a new student?**
A: Role flips back to `student`; alumni-only access (directory, portal login) is suspended until they graduate again. Alumni record/history is not deleted, just access-suspended while re-enrolled.

### Category 7: Preferences & Tradeoffs (batch 1/1)

**Q: How should alumni get notified of announcements/events, given this app has no real email infrastructure?**
A: Reuse the existing real log-only SMS pattern (`smsMessages`) — consistent with how every other notification-shaped feature in this app already works honestly, not a new email system invented for this one feature.

**Q: What happens to the old verification code when a document is reissued?**
A: Old code is revoked/marked superseded — only the new one verifies. Real security property, prevents a corrected/outdated document from still "verifying" as genuine.

### Categories 6, 8, 9 — inherited, no new decision needed

- **Existing Patterns (6):** Route convention (`requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped query → `recordAudit()` → `apiErrorResponse()`) applies unchanged. Login/credential issuance mirrors the already-real admission-approval pattern (temp password via direct `account` insert with `hashPassword`, or invite-link via a setup-token table + `smsMessages`). Public verification page follows the same "no-login, minimal-data" shape as any other public-facing endpoint in this app (none currently exist, but the shape mirrors the public lead-capture endpoint mentioned in `AGENT-HANDOFF.md`).
- **Monetization (8):** N/A — donations/fundraising explicitly deferred per the source doc, not part of this build.
- **Visual & UX Vision (9):** No visual redesign. Same design system already governing this app (slate/blue palette, KPI banners, data-dense tables, inspector sidebars) for the admin-side screens. The new alumni-facing self-service portal is a new *audience* but should still visually match the existing portal-style surfaces in this app (e.g. how `parent`-role users would see their own scoped view), not invent a new visual language.

## Discovery Summary
- Total questions asked: 20 (across 7 focused batches, all "(Recommended)" options chosen — 0 "Other" custom answers)
- Categories fully covered: 1 (Core Requirements — 11 questions), 2/3 (Users & Context / Integration), 4/5 (Edge Cases / Security), 7 (Preferences)
- Categories covered via direct inheritance from established app conventions: 6, 8, 9
- Key themes: real safeguarding baked into design (18+ cutoff, per-field consent, minors excluded), real separation between legally-retained records and revocable community data, real security properties (verification-code revocation on reissue), reuse-before-invent held throughout (no new email infra, no dependency on the unbuilt event-management addon, same login-credential pattern as admission approval).

