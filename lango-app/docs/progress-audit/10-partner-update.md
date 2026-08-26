# Partner Update

**Note:** no evidence of an existing partner relationship (integration partner, distribution partner, or channel partner) was found in this repository. This is a readiness assessment for a first partner conversation.

## What's ready for collaboration today

- **The core school-operations workflows** — admissions, academics, attendance, and the Accountant Portal are the four modules with the strongest verification evidence behind them. A partner evaluating the product's fit for a specific school or market segment could reasonably explore these today, once the build is fixed and the database is running.
- **A real, Morocco-specific payroll and finance foundation** — relevant to any partner in the Moroccan or francophone-Africa education-technology space specifically, since this isn't a generic template.

## What partners can test now (once the P0 items are resolved — see `05-current-product-state.md`)

- The Atlas seeded tenant provides a realistic, cross-linked demo dataset spanning every module — a partner can explore the full breadth of the product against real-looking (not empty) data.
- Role-based access can be demonstrated across the roles confirmed in code: `super_admin`, `school_admin`, `teacher`, `student`, `parent`, `accountant`, `receptionist`, `librarian`, `guard`, and employees via self-service.

## Current limitations a partner should know before testing

- **The application does not currently compile cleanly** (see `07-testing-results.md`). This must be fixed before any hands-on partner session.
- **No automated test suite has a confirmed passing run** — a partner relying on this for their own downstream customers should know the verification depth is currently manual, code-level review, not automated regression protection.
- **Payment-gateway integrations (CMI NAPS, Stripe) are real but uncertified** — not usable for real transactions yet, pending merchant credentials.
- **~25 features remain genuinely unbuilt** (see `remaining-work-backlog.csv`), mostly automation/convenience features rather than core-blocking gaps — a partner should scope any evaluation around what's confirmed working (see `04-complete-feature-inventory.md`) rather than assuming full feature parity with a mature competitor.

## Decisions or input needed from partners

- If a partner has a specific integration need (a payment processor, an SMS gateway, a national exam-board data format, etc.), that should be scoped explicitly — the existing integrations found in the codebase (a webhook-based SMS provider, CMI NAPS, Stripe) are real but narrow, not a general integration platform.
- Any partner providing real student/school data for testing should be aware no dedicated data-privacy/compliance review has been completed yet (see `13-risks-security-and-technical-debt.md`) — real student PII should not be used for partner testing until that's addressed.

## Proposed pilot scope, if a partner wants to move forward

1. **Phase 1 (weeks 1-2):** Partner reviews the feature inventory and picks 3-5 modules most relevant to their use case. Engineering fixes the P0 build/test items in parallel.
2. **Phase 2 (weeks 3-6):** Partner does hands-on testing against the seeded Atlas tenant with a rehearsed, guided walkthrough (not unsupervised exploration, given the current testing-depth gaps).
3. **Phase 3 (weeks 6+):** If the fit is confirmed, scope a real (non-seeded) pilot tenant with a real school, gated on the P1 backlog items being resolved first.

## Responsibilities and dependencies

- **Engineering side:** resolve P0/P1 backlog items (see `06-remaining-work-and-prioritized-backlog.md`) before Phase 2 begins.
- **Partner side:** provide specific integration requirements early, and be explicit about any real student data they intend to use, so the privacy/compliance gap can be addressed proportionally to actual need rather than as a generic checkbox.
