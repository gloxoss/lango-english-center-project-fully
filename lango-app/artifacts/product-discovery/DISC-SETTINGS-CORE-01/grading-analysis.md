# Grading analysis

## What the Grading Policies page stores

`PUT /api/academics/grading-policies` (school_admin + `grading.manage`) writes three registry keys (`route.ts:104-106`):

| Key | Stored | Consumed by |
|---|---|---|
| `academic.passThreshold` | yes (versioned, optimistic lock) | `report-card-service.ts` (Admis/Ajourné decision), `/api/students/promotions/preview` |
| `academic.eliminatoryScore` | yes | `report-card-service.ts` (a subject average below it makes the student Ajourné) |
| `academic.evaluationWeights` (the 50/30/15/5 table) | yes | **nothing** except the grading-policies API itself |
| `academic.gradingScale` | yes | report-card-service, promotions preview, grading-policies |

## Proof that weightings are not applied

- `grep evaluationWeights src/` → only `app/api/academics/grading-policies/route.ts`, `features/grading/data/assessment-policies-config.ts` (comment) and `libs/settings/registry.ts`.
- `features/academics/services/report-card-service.ts getClassReportCards` weights **subjects** by `class_subjects.coefficient` and averages each subject's published outcomes; it never reads evaluation weights by assessment type.
- The page's own amber banner says so ("Pondérations : enregistrées … pas encore appliquées au calcul des moyennes"). The banner is truthful.

## Same setting, two pages

`academic.passThreshold` is also editable on `/settings/policies` ("Règles académiques et alertes"). Proven one store: a PATCH via the policies API (10 → 11) was immediately returned by `GET /api/academics/grading-policies` (evidence/persistence.txt, T2), then restored to 10 (version 2).

## Other observations

- The cycle / level / trimester selectors at the top of the page ("Secondaire Qualifiant (BAC)", "1ère", "Trimestre 1") do not scope the stored policy: the keys are tenant-wide (`branch_id` null, no cycle/level dimension). Changing the selectors and saving writes the same global keys.
- Mention scale (Très Bien 16–20 … Insuffisant 0–10) is displayed; no mention keys exist in the registry, so it is fixed in code.
- Saving unchanged on the page returns 200 and writes a new version (UI save test).

## Recommendation (not implemented)

Either wire evaluation weights into the report-card average (per assessment type, per cycle) or hide the table; remove the pass mark from `/settings/policies` (single editor); make the cycle/level selectors either real dimensions or remove them.
