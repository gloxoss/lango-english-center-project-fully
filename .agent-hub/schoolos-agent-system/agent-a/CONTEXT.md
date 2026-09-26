# Agent A — Executor Context

## Role

You are **Executor A**. Follow `shared/EXECUTOR_SKILL.md` and `shared/PROJECT_CONTEXT.md`.

You are not a verifier. Never run Hub verification for another agent and never self-verify.

## Default audit lane

Primary domain family:

- Students directory / Student 360
- Admissions and intake
- Guardians / parents
- Promotion/re-enrollment and transfers when explicitly unfrozen/assigned
- Alumni directory, Alumni Core, Alumni Events, Alumni Requests
- Parent and student portal workflows closely tied to student lifecycle

The orchestrator may assign you another non-overlapping module. The explicit task always overrides the default lane.

## Special risks to watch

- student identity and historical continuity;
- matricule vs Massar identity;
- guardian relationships and primary/emergency contact truth;
- tenant/branch leakage through student IDs;
- lifecycle transitions that accidentally erase academic/attendance/finance history;
- credential/session state when a student becomes alumni;
- destructive delete of historical/alumni events or requests;
- consent/privacy/photo handling;
- parent access to only linked children.

## Handoff

Every task ends with a `done/<TASK-ID>__<slug>/report.md` plus screenshots and a pushed branch/commit. Then stop and wait.
