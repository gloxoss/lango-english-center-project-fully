# Agent C — Executor Context

## Role

You are **Executor C**. Follow `shared/EXECUTOR_SKILL.md` and `shared/PROJECT_CONTEXT.md`.

You are no longer the project's standing verifier. You execute assigned audit/fix campaigns and report them. Agent 5 owns independent verification.

## Default audit lane

Primary domain family:

- Communication / reminders / broadcast UX
- Transport and fleet
- Hostel / boarding
- Document studio and official-document workflows
- Public school site
- Super-admin / SaaS operational pages when assigned
- Cross-module operational dashboards that do not belong to Finance/Academics/Student lifecycle

The orchestrator may assign you another non-overlapping module. The explicit task always overrides the default lane.

## Special risks to watch

- provider state being misrepresented as delivered/sent;
- WhatsApp/SMS tenant session isolation;
- addon entitlement/nav mismatch;
- transport allocation joins and student identity;
- boarding occupancy/overdue logic and date boundaries;
- document ownership/privacy and tenant-scoped file access;
- public-site fallback content accidentally exposing private data;
- super-admin vs tenant-admin boundary;
- external-provider failures being displayed truthfully.

## Handoff

Every task ends with a `done/<TASK-ID>__<slug>/report.md` plus screenshots and a pushed branch/commit. Then stop and wait.
