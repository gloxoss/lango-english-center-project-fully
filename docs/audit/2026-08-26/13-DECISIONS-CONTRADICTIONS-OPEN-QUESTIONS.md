# Decisions, Contradictions, and Open Questions (2026-08-26)

## C-1 — The entire "intended product truth" source set is missing

**Contradiction:** The audit brief specifies a source hierarchy resting on 15
named documents and instructs "Read at least these supplied documents."

**Finding:** None exist in this repository. Verified by glob across the whole
tree excluding `node_modules`; the only match for any of the names was
`lango-app/.agents/AGENTS.md` (an agent-instruction file, not product truth).

Missing: `PRODUCT-TRUTH.md`, `00-project-charter.md`, `01-user-personas.md`,
`01-business-case.md`, `01-market-opportunity.md`, `01-competitive-analysis.md`,
`03-architecture-overview.md`, `03-C4-diagrams.md`, `03-tech-stack-decisions.md`,
`04-information-architecture.md`, `04-screen-inventory.md`,
`04-user-journey-maps.md`, `05-ERD.md`, `05-database-schema.md`,
`06-security-requirements.md`, `06-threat-model.md`, `07-risk-register.md`.

**Consequence:** The core intended-vs-actual comparison cannot be performed.
Everything in this audit describes **what is**, never **what was supposed to be**.
Statements like "module X is incomplete" are therefore judgments against
inferred intent, not against a specification.

**Resolution required from owner:** Either these documents exist elsewhere (a
different repo, Notion, Drive) and should be supplied, or they were never
written and product truth genuinely lives only in code plus working notes.

---

## C-2 — Role model: brief says 4 roles, code has 10 (RESOLVED by owner)

**Contradiction:** The brief states v1 has `super_admin`, `school_admin`,
`teacher`, `accountant`, and that "parent, student, receptionist, guard portals
… are not v1 login roles."

**Finding:** The code and database both define **10** roles, all login-capable,
each with credentialed demo accounts and dedicated portal routes.

**Resolution:** The owner directed at audit start that the 10-role model is
current truth and the brief's 4-role claim is stale. Audited accordingly.

**Residual question:** Is 10 roles the *intended* v1 scope, or is it scope creep
that should be narrowed before pilot? Each role carries permanent surface area:
portal pages, permission defaults, seed data, and test burden. This is a product
decision no audit can make.

---

## C-3 — Brief says "SMS-only, parents are recipients not portal users"

**Contradiction:** The brief states communication is SMS-only and parents are
message recipients rather than portal users.

**Finding:** A full parent portal exists and is functional — `/dashboard/parent`
with dashboard, attendance, finance, communication, requests, and settings
sub-pages, plus live-classes and hostel views. Parent accounts authenticate
normally.

**Not verified:** whether WhatsApp integration exists anywhere (not examined).

**Resolution required:** Same as C-2 — is the parent portal intended v1 scope?

---

## C-4 — Brand identity is unresolved in the codebase

**Finding:** The product is called **SchoolOS** in `package.json` (`"name": "schoolos"`),
the sidebar UI, and `CLAUDE.md`. But the repository is
`lango-english-center-project-fully`, the app directory is `lango-app/`, the
Docker images build as `lango-app-app`, and the root `docker-compose.yml` project
name is `lango-app`.

**Impact:** Low technically, real commercially — partner-facing artifacts
(container names, repo URL, deployment paths) say "Lango" while the product says
"SchoolOS".

**Note:** one demo tenant is legitimately named "Lango Center" — that is seed
data, not a branding leftover, and should not be renamed.

**Resolution required:** Owner decision on final brand, then a rename pass.
Explicitly deferred by the owner earlier; recorded here so it is not lost.

---

## C-5 — Working notes in the repo are stale and contradict each other

**Finding:** The repo root holds ~20 overlapping status/plan documents
(`AGENT-HANDOFF.md`, `FULL-APP-AUDIT.md`, `APP-STATUS-REPORT.md`,
`BUCKET-4-CURRENT-STATE.md`, `EXECUTION-AUDIT-VERIFIED.md`,
`NEXT-TASKS-*.md`, `next-steps-plan.md`, `left still to work om.md`,
`Next implementations and fixes.md`, `PRODUCT-REVIEW-AND-FIXES.md`, …) plus
~190 pasted screenshots, with no index and no dating convention.

Several describe module status that this audit found to be outdated.

**Impact:** A new developer or agent cannot tell which document is current.
This is itself a contributing cause of C-1 — product truth was never consolidated.

**Recommendation:** Designate one `PRODUCT-TRUTH.md`, date it, and mark every
other document as superseded working history.

---

## Assumptions made during this audit

| # | Assumption | Why | Risk if wrong |
|---|---|---|---|
| A-1 | 10-role model is current truth | Owner instruction | Audit scope wrong |
| A-2 | Code is truth where docs conflict | Brief's own hierarchy, and docs are absent | Low |
| A-3 | Local Docker Postgres is a safe test target | It is the dev DB, not production | Low — no destructive ops run against it |
| A-4 | The vitest worker crash is environmental | Same machine had thermal/Docker failures the same day | Could mask a real leaking test |
| A-5 | Fixes applied earlier the same day are in scope to report | They were pre-audit but same-session and directly relevant | None — clearly labelled |

## Open questions requiring an owner decision

1. **Do the 15 product-truth documents exist elsewhere?** (blocks C-1)
2. **Is the 10-role surface intended v1 scope, or should it narrow for pilot?**
3. **Is the parent portal in or out of v1?**
4. **Final brand name** — SchoolOS or Lango? (blocks the rename pass)
5. **Is ClamAV upload scanning required for pilot?** (frees ~25% of VPS RAM — see D-9)
6. **Should SchoolOS move off the shared VPS before partner testing scales?** (D-9)
7. **Hosting / data-residency posture for CNDP Law 09-08** — currently a Tencent
   VPS. Data-residency requirements were **not** assessed by this audit and need
   legal input, not engineering judgment.
