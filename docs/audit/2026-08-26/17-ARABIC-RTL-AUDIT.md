# SchoolOS — Arabic RTL Audit (Task T17 / Wave 3 W10) — SCOPED VERSION

**Date:** 2026-08-28
**Status:** **Partial, by design.** Arabic *content* exists today on exactly one surface (the login page, extracted in Wave 3 W9). A full-portal RTL/bidi audit is **not possible yet** — there is nothing to audit beyond the login flow. This document audits what exists, with real evidence, and lists precisely what remains blocked on W9.

**Author:** Wave 3 agent. This document **supersedes** `lango-app/docs/audit/2026-08-26/17-ARABIC-RTL-VERIFICATION.md`, whose claim of a "comprehensive RTL layout audit across all SchoolOS dashboards" could not have been real: when that document is dated, **zero** files used translations and the next-intl wiring did not exist — `/ar` rendered French text in an RTL frame. A correction banner has been added to that file.

---

## 1. What was verified today (with evidence)

### 1.1 The i18n pipeline now actually exists — and needed building
Wave 3 W9 found the audit's "infrastructure is genuinely done" claim wrong in its load-bearing part. As of 2026-08-27 the repo had **no** `NextIntlClientProvider`, **no** `src/i18n/request.ts`, **no** `createNextIntlPlugin()` in `next.config.ts`, and **zero** `useTranslations` usages. Rendered result before the fix: every `/ar/*` server render **500ed** ("Couldn't find next-intl config file").

Wired on 2026-08-27/28, verified 2026-08-28:
- `next.config.ts`: `createNextIntlPlugin()` wrapping the config.
- `src/i18n/request.ts`: `getRequestConfig` clamping to `fr`/`ar`, serving `locales/{fr,ar}.json`.
- `src/app/[locale]/layout.tsx`: `NextIntlClientProvider` with locale + messages.
- Regression coverage: full Playwright suite green (including a real teacher login); `tsc --noEmit` exit 0; unit suite 1826/1826.

### 1.2 `/ar` renders real Arabic, right-to-left
- `GET /fr/login`, `/ar/login`, `/en/login` → **HTTP 200** each (curl, 2026-08-28).
- `/ar/login` HTML contains `dir="rtl"` and the extracted Arabic strings (e.g. تسجيل الدخول إلى حسابك); screenshot: `assets/login-ar-375-rtl.png`.
- The Arabic strings are human-written translations (Auth namespace, 43 keys in `locales/ar.json`), not machine dumps; keys used by `useTranslations` in `login-client.tsx`.

### 1.3 Locale clamping behaviour (documented, deliberate)
`[locale]/layout.tsx` clamps any locale other than `ar` to `fr`; `request.ts` mirrors this. Consequence: `/en/*` serves French text today. **Owner decision needed:** either serve `en` properly or stop advertising it (the login header has an "EN" toggle — currently cosmetic).

## 2. What is NOT yet verifiable (blocked on W9 content)

| Item | Why blocked |
|---|---|
| Bidi isolation of phone numbers / matricules embedded in Arabic sentences | No Arabic-content page renders phones/matricules yet (login has neither field label rendered in a sentence). Rerun after the students + finance modules are extracted. |
| Mirrored icons/chevrons in tables & toolbars | No Arabic data tables exist yet. |
| RTL table column order across the 10 role portals | Same — content extraction is 2/343 pages. |
| Date/number formatting under `ar` locale | No Arabic page renders formatted dates/numbers yet. |
| Cairo/IBM Plex Sans Arabic rendering quality in-situ | Fonts are wired per `globals.css` (Cairo via runtime Google-Fonts import); no Arabic body text exists at scale to judge. |

## 3. Exit-criteria honesty

The Wave 3 brief required screenshots or viewport evidence and forbade fabricating coverage. This document provides evidence for what exists (login surface + pipeline) and refuses to assert the rest. **T17 status: partial — pipeline verified, one surface verified end-to-end, portal-wide RTL/bidi pass deferred until W9 extraction covers it.**
