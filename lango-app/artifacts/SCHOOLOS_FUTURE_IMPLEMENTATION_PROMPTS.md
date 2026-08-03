# SchoolOS Future Implementation Prompt Pack

## How to use this file

This is the master entry point for future SchoolOS page implementation. Give an agent this file, `SCHOOLOS_FUTURE_PRODUCT_CONTEXT.md`, `SCHOOLOS_FUTURE_DESIGN.md`, the relevant domain prompt pack, and the corresponding `future-implementation/<module>` plan.

Do not ask an agent to implement the entire roadmap in one change. Use one bounded domain slice or one vertical workflow at a time.

## Master implementation prompt

```text
You are a senior product engineer implementing a production SchoolOS workflow in the existing Next.js, TypeScript, Drizzle ORM and PostgreSQL codebase.

Read, in order:
1. AGENT-HANDOFF.md, ARCHITECTURE.md and MIGRATION-NOTES.md.
2. FUTURE-IMPLEMENTATION-MIGRATION-ROADMAP.md.
3. artifacts/SCHOOLOS_FUTURE_PRODUCT_CONTEXT.md.
4. artifacts/SCHOOLOS_FUTURE_DESIGN.md.
5. The selected artifacts/schoolos-implementation-prompts/<domain>.md file.
6. The selected future-implementation/<module> specification and reference file.

Before coding, audit existing schemas, APIs, services, routes, components, tests and migrations. Reuse real foundations and identify stale mock UI. Do not resurrect deprecated LMS tables or duplicate student, guardian, employee, finance, settings, file, notification, audit or permission logic.

Implement a complete vertical slice: schema/migration when necessary, domain service, validation, authenticated and tenant-scoped API, capability/object authorization, audit events, UI route and components, loading/empty/error/forbidden/success states, translations, tests, migration/backfill notes and rollout flag. Use additive migrations and idempotency for retries. Use decimal-safe and immutable patterns for money. Use background jobs for bulk work.

Every add-on must check tenant entitlement server-side and disappear cleanly from navigation when unavailable. Portals call shared domain APIs with narrower permissions; they never fork business logic.

Do not fabricate data or claim provider delivery/compliance that did not happen. Do not leave decorative controls. Preserve unrelated user changes. Verify targeted lint, TypeScript, unit/integration tests, tenant isolation and production build in proportion to risk. Report remaining gaps honestly.
```

## Page prompt generator

```text
Create one additional SchoolOS page prompt that is consistent with the supplied product and design contracts. Include: page ID/name, route, maturity/dependency, authorized roles and object scope, objective, user mindset, source entities, layout, components, primary/secondary actions, workflow transitions, validation, API/service contract, audit events, loading/empty/error/forbidden/offline/success states, responsive and RTL behavior, accessibility, test acceptance and explicit exclusions. Reuse shared SchoolOS services and never invent a parallel domain model.
```

## Domain prompt packs

| Pack | Scope | Roadmap phases |
|---|---|---|
| [01-platform-foundations](schoolos-implementation-prompts/01-platform-foundations.md) | Migration safety, settings, permissions, 2FA, entitlements and shared services | 0–1 |
| [02-people-academics](schoolos-implementation-prompts/02-people-academics.md) | Admissions, students, guardians, academic structure and scheduling | 2 |
| [03-teaching-learning](schoolos-implementation-prompts/03-teaching-learning.md) | Attendance, resources, homework, assessment and online exams | 3 |
| [04-finance-accounting](schoolos-implementation-prompts/04-finance-accounting.md) | Student accounting, payments and office accounting | 4 |
| [05-role-portals](schoolos-implementation-prompts/05-role-portals.md) | Teacher, student, parent, accountant, reception, employee, guard and leadership portals | 5–6 |
| [06-workforce](schoolos-implementation-prompts/06-workforce.md) | HR, payroll, advances, leave and awards | 6 |
| [07-engagement-learning](schoolos-implementation-prompts/07-engagement-learning.md) | CRM, broadcasts, events and live classrooms | 7 |
| [08-operational-addons](schoolos-implementation-prompts/08-operational-addons.md) | Library, inventory, transport and hostel | 8 |
| [09-documents-reporting](schoolos-implementation-prompts/09-documents-reporting.md) | Cards, certificates and governed reporting | 9–10 |
| [10-public-commercial-advanced](schoolos-implementation-prompts/10-public-commercial-advanced.md) | CMS, domains, alumni, subscriptions and differentiation | 11–13 |

## Future-implementation coverage map

Use this matrix to select the prompt pack and the deeper implementation specification. Every current `future-implementation` area is assigned exactly one primary pack; cross-domain dependencies remain governed by the master implementation prompt.

| Future implementation | Primary prompt pack |
|---|---|
| `admission-and-student-model` | 02 People and Academics |
| `academic-management-enhancement` | 02 People and Academics |
| `assessment-and-examination` | 03 Teaching and Learning |
| `attachments-book` | 03 Teaching and Learning |
| `attendance-qr-enhancement` | 03 Teaching and Learning |
| `student-accounting` | 04 Finance and Accounting |
| `office-accounting` | 04 Finance and Accounting |
| `teacher-portal` | 05 Role Portals |
| `student-portal` | 05 Role Portals |
| `parent-guardian-portal` | 05 Role Portals |
| `accountant-portal` | 05 Role Portals |
| `receptionist-portal` | 05 Role Portals |
| `librarian-portal` | 05 Role Portals |
| `employee-self-service-portal` | 05 Role Portals |
| `guard-security-portal` | 05 Role Portals |
| `school-leadership-portal` | 05 Role Portals |
| `role-portals-foundation` | 05 Role Portals |
| `human-resources-employee-management` | 06 Workforce |
| `payroll-and-workforce-operations` | 06 Workforce |
| `lead-crm-and-broadcast-messaging` | 07 Engagement, Events, and Live Learning |
| `event-management` | 07 Engagement, Events, and Live Learning |
| `live-classrooms` | 07 Engagement, Events, and Live Learning |
| `library-management` | 08 Operational Add-ons |
| `inventory-management` | 08 Operational Add-ons |
| `student-transport` | 08 Operational Add-ons |
| `hostel-management` | 08 Operational Add-ons |
| `card-and-admit-card-management` | 09 Documents and Reporting |
| `certificate-management` | 09 Documents and Reporting |
| `advanced-reporting` | 09 Documents and Reporting |
| `settings-platform` | 01 Platform Foundations |
| `two-factor-authentication` | 01 Platform Foundations |
| `school-website-cms` | 10 Public, Commercial, and Advanced |
| `custom-domain` | 10 Public, Commercial, and Advanced |
| `alumni-portal` | 10 Public, Commercial, and Advanced |
| `subscription-licensing` | 10 Public, Commercial, and Advanced |

## Global shell prompt

```text
Design and implement the SchoolOS shell as a role-aware, multi-tenant workspace. Desktop uses a 256px viewport-height sidebar with fixed brand header, independently scrolling navigation and fixed role/sign-out footer; a sticky top bar provides tenant/branch context, global search, language switcher, notifications and profile. Mobile uses a drawer or role-specific bottom navigation. Build navigation from the server-generated portal manifest and entitlement/capability results. Show only authorized destinations, automatically open the active group, preserve keyboard focus, support Arabic RTL, and provide explicit loading and session-expired states. Marketing CSS must remain route-scoped and never leak into authenticated pages.
```

## Shared implementation rules

- Data truth before dashboard visualization.
- API authorization before navigation visibility.
- One domain service reused by admin and portals.
- One neutral document engine reused by cards, certificates and official reports.
- Student Accounting is a receivables subledger; Office Accounting is the general ledger.
- Notifications use the outbox; bulk communication adds delivery-provider events.
- Reports query governed definitions and preserve row-level security.
- Every page prompt inherits the product and design contracts.

## Asset prompts

### Portrait set

```text
Create a consent-safe fictional portrait set for a Moroccan school software mockup: diverse adult staff, guardians and secondary-school students, neutral studio background, consistent soft daylight, documentary realism, no logos, no text, individual square crops, appropriate professional clothing, never resembling public figures.
```

### Official document samples

```text
Create fictional SchoolOS sample documents for UI previews: invoice, receipt, report card, student ID, employee ID, exam admit card and school certificate. Use Moroccan French/Arabic bilingual structure, MAD currency where relevant, obvious SAMPLE watermark, invented names and identifiers, clean printable hierarchy, no government seals or false compliance marks.
```

### Empty-state illustrations

```text
Create a restrained SchoolOS empty-state illustration family using simple geometric line art in ink, slate and SchoolOS blue. Subjects: no students, no attendance session, no invoices, no messages, no books, no trips, no hostel allocation and no reports. Transparent background, accessible silhouette, no gradients, no decorative text.
```

## Mock-data contract

- Tenant: Groupe Scolaire Atlas; branches: Casablanca Centre, Rabat Agdal.
- Academic year: 2026–2027; classes: 2ème Année Collège A, Tronc Commun B.
- Students: Salma Bennani, Adam El Idrissi, Lina Alaoui, Youssef El Amrani.
- Staff: Nadia Benali (director), Karim Amrani (teacher), Sara Chraibi (accountant).
- Currency: MAD; phone: +212 6xx xxx xxx; identifiers are fictional.
- Use enough records to demonstrate pagination, conflicts, exceptions and empty states.

## All-pages generation prompt

```text
Generate a cohesive multi-screen SchoolOS product set using the supplied product context, design contract and domain prompt packs. Keep the same shell, spacing, typography, tokens, table behavior, status semantics and realistic Moroccan data across every screen. Produce desktop administration views and mobile portal/field views where specified. Include meaningful loading, empty, error and forbidden variants. Do not copy Ramom styling, do not use generic bento layouts, do not invent unavailable metrics, and do not expose private child, finance, HR or location data in previews.
```

## Recommended execution sequence

1. Platform foundations.
2. People and academic truth.
3. Teaching and learning.
4. Finance and accounting.
5. Primary portals.
6. Workforce.
7. Engagement.
8. Operational add-ons.
9. Documents and reporting.
10. Public/commercial/advanced features.
