# Matricule analysis

## Formats seen

| Format | Where | Source |
|---|---|---|
| `ATL-2526-0001…0201` | 200 seeded Atlas students | seed (`naming_series` prefix `ATL-2526`, current 200) |
| `STD-2026-0001` | student "test 111" (created in the app) | `reserveMatricule` fallback |
| `STD-2026-0002` | "Aperçu prochain numéro" on `/students/matricules` | `previewMatricule` (default prefix `STD-{year}-`) |
| `ATL-2526-0201` | Numbering settings page | `numbering_series_definitions` (decorative, see numbering-analysis.md) |
| `STD-########` (8 digits of `Date.now()`) | `features/students/services/admission-service.ts:1202` | a third generator in one admission path |

## Root cause of the mixed formats: a broken regex (P1, proven)

`libs/services/matricule.ts:29`, function `currentTenantPrefix`, is meant to continue the school's existing format (audit S-24):

```
/^(.*D)(d{3,})$/.exec(latest.matricule)      // file content today
/^(.*\D)(\d{3,})$/.exec(latest.matricule)    // intended
```

The backslashes were lost (same failure mode as the syllabus URL regex fixed earlier). Proof (node, evidence in report):

```
ATL-2526-0006 current: NO MATCH -> STD fallback | intended: ATL-2526-
STD-2026-0001 current: NO MATCH -> STD fallback | intended: STD-2026-
```

So every new student gets `STD-{year}-####`, starting a second series next to the school's real one. The S-24 fix is effectively disabled.

History: `git log -S` shows `currentTenantPrefix` and the broken pattern arrived together in checkpoint `6e13e293` (the S-24 fix was written this way; there was never a working version). No test references `currentTenantPrefix`, so the suite stays green. S-24 is one of the items whose "verification" (antigravity-1, then the script-written gemini note "currentTenantPrefix fallback; 13/13") was voided by the owner on 2026-09-25: this is a concrete case of what that verification missed.

## Canonical generator

`reserveMatricule` (naming_series, advisory lock + row lock, reconciles upwards) is the canonical, concurrency-safe generator. The `STD-${Date.now()...}` path in admission-service is a non-sequential outlier (collision-safe only by timestamp, not tenant-sequential).

## Other matricule observations

- `/students/matricules` shows "Identifiants incomplets 201": all 201 students lack a Massar code (demo data), so every row is flagged; the KPI reads as an alarm on a fresh school.
- A custom field with key `matricule` ("N° matricule", 10 values) duplicates the core `user.matricule` (see custom-fields-analysis.md).
- `naming_series` prefix `ATL-2526` has no trailing `-` while the numbers contain one (`ATL-2526-0006`): the seed stores the prefix without the dash; the generator's reconciliation must parse either shape.

## Recommendation (not implemented)

Restore the regex (and add a test with a real `ATL-2526-0006` row, no mocking); route the admission-service path through `reserveMatricule`; let the school choose the matricule format once (settings) and store it, instead of inferring it from the latest row.
