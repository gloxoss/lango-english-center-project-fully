# Section 10: i18n backlog (cheap agent)

## Overview
1 211 hardcoded French strings (ratchet baseline) and 213 hardcoded `'fr-FR'` date/number formats. Top modules: features/students 171, app/pages ~150, features/events 121, features/academics 112, features/website 65, features/communication 63. fr-FR: features/finance 16, settings 9, inventory 8, super-admin 7, library 7.

## Risk: [green] Mechanical. Main danger is breaking the locale JSON (PLAN.md rule 8).

## Dependencies
- Depends on: 03 · Blocks: none · Batch 2 · Hub item: `task:up-10-i18n-<module>` (one claim per module, never two agents on the same module)

## Rules
- One screen per commit-sized change; one new namespace per screen; identical ICU plural structure in fr/en/ar (Arabic plural branches must contain `#`).
- Strings sent by the API as data values (e.g. French role labels used as lookup keys) are NOT UI text: leave them.
- For dates/numbers: `const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR'` from `useLocale()` / `getLocale()`; never hardcode 'fr-FR'.
- Do not change behaviour. If you find a bug, log it in the hub (`say`) for a stronger agent; do not fix it here.

## Tasks

<task type="auto" id="10-01">
  <name>Per module: translate, verify, lower the baseline</name>
  <files>the module's files + lango-app/locales/{fr,en,ar}.json + lango-app/scripts/i18n-hardcoded-baseline.json</files>
  <action>node scripts/check-hardcoded-french.mjs --list <module>; translate each visible string; replace 'fr-FR' formats; then node scripts/check-hardcoded-french.mjs --update.</action>
  <verify>npm run check:i18n pass; npm run check:i18n:keys 0 missing; baseline total strictly lower; tsc 0; eslint 0 on touched files; duplicate/nested namespace scan on the 3 locale files clean.</verify>
  <done>Module fully translated; baseline locked lower.</done>
</task>
