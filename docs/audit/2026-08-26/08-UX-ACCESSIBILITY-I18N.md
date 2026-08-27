# UX, Accessibility, and Internationalization (2026-08-26)

> **Scope warning.** Only the i18n/localization section below rests on hard
> evidence. **No runtime UX or accessibility review was performed** — no browser
> was opened, no screen was rendered, no screenshot taken, no viewport tested,
> no contrast or screen-reader check made. The UX and accessibility sections
> record what was *not* done, so absence of findings is not read as absence of
> problems.

## 1. Internationalization — VERIFIED

### Infrastructure: correctly wired

| Element | Status | Evidence |
|---|---|---|
| Framework | next-intl, configured | `package.json`, `check:i18n` script present |
| Locale routing | Working | `src/app/[locale]/` route group; live app serves `/fr/...` |
| Locale files | 3 present | `locales/{ar,en,fr}.json` |
| RTL direction | Correctly implemented | `src/app/[locale]/layout.tsx:30` — `dir={isRTL ? 'rtl' : 'ltr'}` |

### Content layer: effectively absent

| Metric | Value |
|---|---|
| Translation keys per locale | **51** |
| Namespaces covered | `Common`, `Navigation`, `Roles`, `Status` |
| Feature components under `src/features` | 354 |
| Feature components calling `useTranslations`/`getTranslations` | **0** |
| Component files containing hardcoded French UI strings | 34+ |

**Conclusion:** the translation system is scaffolding that the application does
not use. All user-facing copy is hardcoded French inside components. Visiting
`/ar/dashboard` or `/en/dashboard` renders a **French** interface.

For Arabic specifically the result is worse than no support: the layout
direction correctly flips to RTL while the text remains French, producing
mirrored French — visually broken rather than merely untranslated.

Recorded as **D-6 (P1)**. The remediation is large but mechanical; the
infrastructure being correct means the work is string extraction, not
re-architecture.

### Not verified

- Whether the 51 existing keys are themselves complete/correct across all 3 files
  (key *counts* match at 51 each, but per-key value parity was not diffed).
- Whether `npm run check:i18n` passes (not executed).
- Date, number, and currency formatting per locale (MAD formatting appears
  hardcoded as `toLocaleString('fr-FR')` in several components observed
  incidentally, which would not adapt to Arabic locale conventions — **unverified
  as a systematic finding**).

## 2. Accessibility — NOT AUDITED

None of the following were checked. Listed explicitly so this is not mistaken
for a clean bill of health:

- Colour contrast ratios against WCAG AA
- Visible keyboard focus indicators
- Full keyboard operability of interactive components (modals, tables, menus)
- Semantic heading hierarchy
- Form label association and error announcement
- Screen-reader accessible names for icon-only controls (the UI uses many
  icon-only buttons — e.g. the `ArrowUpRight` "view" affordance in data tables —
  which are a common source of unlabelled-control failures, **unverified**)
- Touch-target sizing on mobile
- `prefers-reduced-motion` handling

## 3. Responsive / mobile — NOT AUDITED

Not tested at any viewport. Notably unverified, and important for this product:

- **Teacher attendance marking on a phone** — the brief calls this out as a
  primary mobile workflow. Completely unverified.
- Grade entry on a phone.
- Data-dense admin tables at 320/375/430 px.
- Desktop layouts at common widths.

## 4. UX states — NOT SYSTEMATICALLY AUDITED

Loading / empty / error / disabled / permission-denied / not-found states were
not reviewed screen by screen.

Two incidental observations from code read during other phases, recorded as
leads rather than findings:

- Several views implement genuine empty states with honest copy (e.g.
  `AttendanceChart` renders "Aucune présence enregistrée sur les 7 derniers
  jours." rather than a fake chart) — a good sign.
- A crash was found and fixed the same day where a role-stripped API field
  (`payments`) was consumed unconditionally by the UI
  (`student.payments.reduce(...)`), producing a white-screen
  `Cannot read properties of undefined` for `teacher`. **This suggests the
  role-conditional-rendering paths are under-tested generally** — the same shape
  could exist wherever an API varies its response by role. Not swept.

## 5. Recommended next steps for this phase

1. Run the app and click through every role's landing page in all 3 locales —
   cheapest possible way to surface the D-6 impact concretely and find more
   crashes of the shape above.
2. Automated accessibility pass (axe/Lighthouse) on the 10 role landing pages.
3. Phone-viewport test of the teacher attendance flow specifically.
4. Then, and only then, a systematic per-screen state review.
