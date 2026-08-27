# T10 — Production Host Sizing: Options Analysis

**This is a decision document, not an executed change.** Per the task's own
gate, no infrastructure was modified — this VPS is shared with four other
clients' live production apps (fes-tawsil, wenaya, epioso-cms, telegrambot) and
none of these options should be executed without your explicit go-ahead.

## The problem, measured

- Host: 1935 MB RAM total, 2 vCPU (Tencent VPS, IP `43.157.17.129`)
- Observed at rest with SchoolOS running: ~88 MB free, ~1 GB swap in use
- **During SchoolOS's initial deployment, the host became completely
  unreachable** — SSH timed out at the banner-exchange stage, the Docker API
  returned HTTP 500 — and required an out-of-band reboot from the Tencent
  console. All four other clients' apps went down with it.
- Root cause: starting `clamav` + loading two new images + starting multiple
  new containers simultaneously was too much concurrent memory pressure for
  the box. It recovered cleanly after reboot and has been stable since
  (services are now started in stages, not all at once).

**Per-container memory, measured via `docker stats`:**

| Container | Memory |
|---|---|
| schoolos-clamav | ~474 MB (largest single consumer) |
| schoolos-app | ~227 MB |
| epioso-cms, fes-tawsil-web, wenaya, tsb-* (5 containers) | ~30-100 MB each |
| schoolos-db | ~54 MB |

## Option A — Dedicated host for SchoolOS

**What it buys:** SchoolOS deployments/restarts can no longer affect the other
four clients, and vice versa. Genuinely removes the blast-radius risk that
already materialized once.

**Cost:** a new VPS. Tencent Cloud Lighthouse 2-4GB tier is a reasonable
starting point given SchoolOS's actual footprint (~750 MB across app+db+clamav
today, growing with real tenant data) — roughly $5-15/mo depending on region
and term, but confirm current Tencent pricing rather than trust this estimate.

**Effort:** M. Steps: provision instance, install Docker, repeat the exact
deployment in `docs/runbooks/deploy.md` against the new host, point DNS
(`schoolos.epioso.com`) at the new IP, get a fresh Let's Encrypt cert, decommission
the old deployment once verified. No code changes required.

**Risk:** a migration window with a DNS TTL-dependent cutover; brief
downtime unless done carefully (stand up new host, verify, then switch DNS,
then tear down old).

## Option B — Add RAM to the existing host

**What it buys:** relieves the memory pressure without a migration. Does
**not** remove the shared-blast-radius risk — a SchoolOS problem can still
take down four other clients, just less easily.

**Cost:** depends on Tencent's resize pricing for this instance type/term;
confirm current pricing before committing (could not verify server-side
pricing without account access).

**Effort:** S, but likely requires a reboot (all five apps briefly down during
the resize) — coordinate a maintenance window with the other clients if you
don't own all of them.

**Risk:** lowest-effort option, but treats the symptom (memory pressure), not
the underlying shared-tenancy risk.

## Option C — Disable ClamAV scanning for the pilot

**Verified, not assumed:** grepped every API route and the codebase for
consumers of `malware-scan.ts`. There are exactly two:
- `src/features/attachments/services/asset-service.ts` (digital
  assets/attachments feature)
- `src/features/guard/services/incidents-service.ts` (guard incident evidence
  attachments)

**Student photos and general document uploads do NOT go through ClamAV** in
this codebase as it stands — disabling it does not remove scanning from the
paths people likely assume it protects. It specifically stops scanning
uploads to the attachments/asset library and guard incident evidence.

**What it buys:** frees ~474 MB (~24.5% of host RAM) immediately, no
migration, no cost.

**Cost:** those two upload paths become unscanned. For a synthetic-data pilot
this is a low-severity risk; **before onboarding a real school, re-enable it or
address it as part of Gate 4 (compliance).**

**Effort:** S — stop scanning at the two call sites (or stop the container and
make the scan calls fail-open with a logged warning, which is closer to what
already happens today if ClamAV is unreachable — verify that fail-open
behavior before relying on it).

**Risk:** lowest cost, but narrows a real (if currently limited) security
control. Reversible in minutes.

## Option D — Combination

Most defensible for the pilot phase: **C now (S effort, zero cost, immediate
relief) + A before any real student data is onboarded** (removes the shared-
blast-radius risk permanently). B is the weakest option on its own — it costs
money and doesn't fix the actual shared-tenancy problem.

## Recommendation (not a decision — yours to make)

Given the pilot is currently synthetic-data-only and cost-sensitive: **do C
immediately** (verified low blast radius, reversible, frees a quarter of host
RAM). **Plan A** before Gate 2/3 real-pilot readiness, since the "one incident
already took down four other clients" fact is the strongest argument in this
whole document and it doesn't go away with more RAM alone.

**Awaiting your decision before executing anything in this document.**
