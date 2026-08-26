# UltraPlan Summary — Attachments Book

## What We're Building

A school-wide, tenant-scoped academic resource library for SchoolOS: teachers and admins upload learning materials once, target them at the right audience (school-wide, a role, a class, or a specific student), and reuse them across the app instead of re-attaching the same file everywhere. Every upload is malware-scanned before it can ever be downloaded, and every replacement creates a new version without breaking anything that already links to the old one.

## Key Features

- Configurable attachment-type taxonomy (admin-managed)
- Versioned digital assets with a real draft → quarantine → scan → ready → publish → archive lifecycle
- Real ClamAV malware scanning — infected files never become downloadable
- Precise audience targeting (school/role/class-section/class-subject/user), re-checked on every single download request (no stale URLs)
- Full content library UI: search/filter, table/grid, create/edit with real upload progress, detail/version inspector, admin types page
- Reuse via usage-links, wired into the existing homework module as the first real consumer

## Tech Stack

- Existing stack: Next.js 15/16 App Router, TypeScript, Drizzle ORM, PostgreSQL, Better Auth
- New: `clamdjs` (ClamAV TCP client) + a new `clamav/clamav:1.4` Docker Compose service
- New internal abstraction: `BlobStore` interface (local-disk adapter for v1; designed so a real S3-compatible adapter can be swapped in later with zero business-logic changes)

## Scope Decision (read this before executing)

v1 deliberately does NOT build: resumable/tus uploads, S3/SeaweedFS object storage, Apache Tika extraction, a storage/quota operations dashboard, or portability export. These are documented, reasoned follow-up work (see PRD.md Section 7) — right-sized to this app's actual 3-container Docker Compose deployment, not silently dropped. Malware scanning IS built now — it's the one piece of infra judged non-negotiable for a feature whose whole purpose is letting users download files other users uploaded.

## Risk Areas

- [red] section-05 — the upload/scan/download pipeline; get authorization or scan-status re-checking wrong here and it's a real data leak or a real malware-serving bug.
- [yellow] section-03 — first scanning-daemon infra this app has ever run; healthcheck timing must actually gate app startup, not just look like it does.
- [yellow] section-07 — largest UI surface in the plan.
- [yellow] section-09 — must prove security properties live (real EICAR test, real cross-tenant sweep), not self-report success.

## Plan Structure

- 9 sections, 35 total tasks
- 6 parallel batches (01/02/03 parallel; 06/08 parallel after 05)
- Critical path: 01 → 04 → 05 → 07 → 09

## How to Execute This Plan

1. Read `.ultraplan/sections/index.md` for the batch order.
2. Execute sections in dependency order (parallel batches can run together).
3. Section-09 is not optional — it's where the plan's security claims get proven against a real running system, matching the discipline already established twice this session (advanced-reporting, assessment-and-examination remediations).

## How to Update This Plan

Run `/ultraplan update` inside this same working directory (`future-implementation/attachments-book/`) and describe what changed — only affected sections get regenerated.
