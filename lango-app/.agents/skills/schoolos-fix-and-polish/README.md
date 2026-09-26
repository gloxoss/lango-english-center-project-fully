# SchoolOS Fix & Polish Skill

Comprehensive troubleshooting, error diagnosis, business logic repair, and UI/UX polish playbook for SchoolOS (Moroccan multi-tenant school management platform).

## Core Capabilities

1. **Systematic Root-Cause Diagnosis**:
   - Trace PostgreSQL constraint errors (`23503` foreign key violations, `23505` uniqueness conflicts).
   - Trace HTTP status codes (`409` register locks, `403` cross-section boundaries, `401` session expiries).
   - Inspect production VPS Docker container logs via remote SSH (`docker logs schoolos-app`, `docker logs schoolos-db`).

2. **Relational Hierarchy Resolution**:
   - Handle dual-level class structures (`class_sections` vs parent `classes`).
   - Automatically resolve section UUIDs to parent class UUIDs to prevent foreign key errors on registers, attendance, and exam tables.

3. **UI/UX Excellence & Invariant Compliance**:
   - Zero dead controls (enforce click/submit/link handlers on all buttons).
   - Informative lifecycle lock banners with administrative 1-click reopen modals and audit reasons.
   - 100% dynamic data with rich contextual empty states (zero hardcoded mock arrays).

4. **Moroccan Localization & i18n**:
   - Trilingual parity across English (`en`), French (`fr`), and Arabic (`ar`).
   - Strict RTL parity with `<main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>`.
   - Moroccan regulatory standards (/20 grading scale, MAD currency, GSM-7 telecom encoding, Law 09-08 CNDP data privacy).

5. **Automated Quality Verification & VPS Deployment**:
   - `npm run check:types`: TypeScript zero-error guarantee.
   - `npm run check:i18n`: Dictionaries parity check.
   - `npm run check:ui`: UI reality ratchet check.
   - `npm run check:isolation`: Static tenant isolation audit on all 799+ API routes.
   - `npm run deploy:vps`: Zero-downtime local Linux AMD64 container build and remote VPS deployment.
