# Playwright results

41 routes × 3 variants = 123 full-page captures in `screenshots/` (`<variant>__<route>.png`), plus 11 interaction-state captures (`state__*.png`, `state-save-unchanged__*.png`). Script: `evidence/visual.mjs`; raw results: `evidence/visual-results.json`.

Automatic rejection checks per capture: visible skeletons, loading text ("Chargement", "Rendering...", "Loading..."), untranslated `Namespace.key` strings, Next.js error overlay, horizontal overflow (scrollWidth − innerWidth > 1px), API 5xx during load, redirect away from the requested route.

| Variant | Captures | Clean |
|---|---|---|
| desktop-fr | 41 | 35 |
| mobile390-fr | 41 | 35 |
| desktop-ar | 41 | 35 |

## Rejected captures

| Variant | Route | Why |
|---|---|---|
| desktop-fr | /dashboard/settings/branches | redirect→/fr/dashboard/settings/entitlements?addon=multi-branch |
| desktop-fr | /dashboard/settings | keys:SMS.ma,Settings.mod_documents_title,Settings.mod_documents_desc; error overlay |
| desktop-fr | /dashboard/settings/website/menu | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms |
| desktop-fr | /dashboard/settings/website/news | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms |
| desktop-fr | /dashboard/settings/website | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms |
| desktop-fr | /dashboard/settings/website/pages | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms |
| mobile390-fr | /dashboard/settings/branches | redirect→/fr/dashboard/settings/entitlements?addon=multi-branch |
| mobile390-fr | /dashboard/settings | keys:SMS.ma,Settings.mod_documents_title,Settings.mod_documents_desc; error overlay |
| mobile390-fr | /dashboard/settings/website/menu | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms |
| mobile390-fr | /dashboard/settings/website/news | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms |
| mobile390-fr | /dashboard/settings/website | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms |
| mobile390-fr | /dashboard/settings/website/pages | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms |
| desktop-ar | /dashboard/settings/branches | redirect→/ar/dashboard/settings/entitlements?addon=multi-branch |
| desktop-ar | /dashboard/settings | keys:SMS.ma,Settings.mod_documents_title,Settings.mod_documents_desc; error overlay |
| desktop-ar | /dashboard/settings/website/menu | redirect→/ar/dashboard/settings/entitlements?addon=school-website-cms |
| desktop-ar | /dashboard/settings/website/news | redirect→/ar/dashboard/settings/entitlements?addon=school-website-cms |
| desktop-ar | /dashboard/settings/website | redirect→/ar/dashboard/settings/entitlements?addon=school-website-cms |
| desktop-ar | /dashboard/settings/website/pages | redirect→/ar/dashboard/settings/entitlements?addon=school-website-cms |

All Arabic captures render with `dir="rtl"`. No capture had horizontal overflow, a skeleton, loading text or an API 5xx.

## Not rejected but notable

- `/settings/attendance`: renders cleanly but is a "Fonctionnalité à venir" placeholder (all 3 variants).
- `/settings/entitlements`: lists a disabled module "test" as "À venir" on the VPS (not present on dev; see module-entitlements.md).
- Redirects to `/settings/entitlements?addon=…` are the add-on gate working as designed (Atlas has no `multi-branch` or `school-website-cms` entitlement), not errors, but they make Branches unreachable while Atlas already has 2 campuses.

## Interaction states captured

- `{"name":"onboarding","button":true,"status":200,"body":"{\"success\":true,\"data\":{\"id\":\"9d568204-3586-47ca-92b1-787d81e57141\",\"tenantId\":\"9c496194-2fcc`
- `{"name":"policies","button":true,"status":"no request","body":"","toast":"Aucune modification à enregistrer. | "}`
- `{"name":"grading-policies","button":true,"status":200,"body":"{\"success\":true,\"data\":{\"passingScore\":10,\"eliminatoryScore\":5,\"rules\":[{\"name\":\"Exam`
- `academic-year-add-modal captured`
- `academic-year-add-validation action failed locator.click: Timeout 30000ms exceeded.`
- `Call log:`
- `[2m  - waiting for getByRole`
- `academic-year-add-validation captured`
- `semester-add-modal captured`
- `numbering-create-empty-validation captured`
- `custom-field-type-dropdown captured`
- `grading-coefficients-tab captured`
- `entitlements-request-modal captured`
- `security-page captured`

The "academic-year-add-validation" step could not find a submit button inside the dialog by role/name within 30 s; its capture shows the open dialog only. Validation copy for that modal was not verified.
