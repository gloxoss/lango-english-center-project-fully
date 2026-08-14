# Cross-module remediation progress

## 2026-08-08
- Completed independent audit of the five requested modules.
- Started implementation remediation under user authorization.
- Selected dependency order: shared portal authorization → Parent → Live Classrooms → Transport → Library → global gates → Docker.
- Role Portal effective-relationship filters added to derived role, parent search, and parent home; focused portal suite passes 43/43.
- Parent attendance projection no longer exposes operational notes.
- Parent excuse JSON no longer accepts arbitrary document URLs; relationship-scoped upload/download endpoint added.
- Live Classroom webhook body capped at 256 KiB; provider type/profile join and ambiguity rejection added.
- Transport server page guards added for all 12 nested sections and the root overview.

## Test log
| Gate | Status | Evidence |
|---|---|---|
| Baseline TypeScript | Pass | `npx tsc --noEmit --pretty false` |
| Remediation tests | Pass | Focused suites and live DB harnesses listed below |
| Production build | Pass | exit 0, TypeScript green, 335 static pages |
| Docker Compose | Pass | images built, migration exit 0, app live on port 3000 |

## Final verification evidence
- Portal/Parent/Library focused Vitest: 58/58.
- Live Classrooms: 64/64.
- Library DB operational lifecycle: 4/4; migration verifier applies twice and validates 23/23 tables.
- Transport: 28 constraints, 14/14 live acceptance, 12/12 HTTP adversarial.
- Production `next build`: exit 0; TypeScript passed; 335 static pages generated.
- Docker image: built after raising the builder heap to 4 GiB.
- Compose migration: exit 0; app ready on port 3000; `/fr` 200; anonymous guardian API 401.
- Docker-backed Role Portal verifier: 47/47.
- Docker-backed Parent verifier: 23/23 (harness paced to respect production auth rate limiting).
