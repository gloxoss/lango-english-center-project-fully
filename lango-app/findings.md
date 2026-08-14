# Cross-module findings

## Confirmed audit findings
- P0: Role Portal derived-parent authorization, search, and home bypass relationship status/effective dates enforced by the Parent relationship resolver.
- P0: Library Management is currently migration/schema plus mock catalog UI, without the planned operational APIs and workflows.
- P1: Parent home widgets are placeholders; major finance, messaging, consent, document, and household workflows remain incomplete.
- P1: Parent excuse evidence accepts an arbitrary document URL; attendance may expose an internal note field.
- P1: Live Classroom webhook lookup is not strongly bound to tenant/provider profile/provider type and lacks an explicit request-body limit.
- P1: Transport APIs are guarded and tested, but dashboard pages lack server-side page authorization.

## Verified baseline evidence
- Global TypeScript check passed before remediation.
- Transport: 28/28 constraints, 14/14 live acceptance, 12/12 HTTP adversarial.
- Live Classrooms focused tests: 64/64.
- Role Portal: 41/41 focused tests and 47/47 live verifier.
- Parent relationship tests: 11/11; parent security verifier: 23/23.
- Library migration verifier: 23/23 tables and required constraints/indexes/enums.

