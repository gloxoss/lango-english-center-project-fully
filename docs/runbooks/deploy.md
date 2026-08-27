# Runbook: Deploy & Rollback

Verified against actual production practice, 2026-08-26/27. This is a
build-locally-ship-the-image process — the VPS never builds. Its 2GB RAM
cannot safely run `next build`; doing so once took the host fully
unreachable and knocked out four unrelated clients' apps.

## Pre-deploy checks (all must pass before building)

```bash
cd lango-app
npx tsc --noEmit                              # must exit 0
npm run test                                  # 0 assertion failures (suite
                                               # itself is not yet exit-0-
                                               # reliable under full parallel
                                               # load - see D-4; check pass
                                               # count didn't drop, not just
                                               # the process exit code)
```

Migration-from-clean is not yet part of this checklist as an automated step —
do it manually if `migrations/` changed:
```bash
docker run -d --name migrate-check -e POSTGRES_DB=test -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test -p 15433:5432 postgres:17-alpine
DATABASE_URL=postgresql://test:test@127.0.0.1:15433/test npx drizzle-kit migrate
docker rm -f migrate-check
```

## Build

```bash
docker compose build app migrate
```

Known constraints, both already handled in `next.config.ts` — do not remove
either without understanding why they're there:
- `experimental.cpus: 2` caps the "Collecting page data" worker pool. Without
  it, the build pegs every core and has caused thermal shutdowns on the build
  machine.
- Type-checking inside the Docker build is skipped
  (`NEXT_IGNORE_TYPES=1` in the Dockerfile) because the TypeScript worker's
  heap can exceed BuildKit's VM limit even when the same build passes on the
  host. The pre-deploy `tsc --noEmit` above is what actually gates this.

If the build fails with a Docker daemon/BuildKit crash rather than a code
error (`Worker exited unexpectedly`, daemon unreachable, HTTP 500 from the
Docker API): this has happened before under resource pressure. Prune build
cache (`docker buildx prune -a -f`), confirm `docker ps` responds, retry. Real
exit codes only — never trust output truncated through a pipe (`| tail`
silently swallows Docker's actual exit code; always append
`; echo "EXIT=$?"` after the real command and check that).

## Transfer

```bash
docker tag lango-app-app:latest schoolos-app:latest
docker tag lango-app-migrate:latest schoolos-migrate:latest
docker save schoolos-app:latest | gzip -1 > schoolos-app.tar.gz
docker save schoolos-migrate:latest | gzip -1 > schoolos-migrate.tar.gz
scp -i <key> schoolos-app.tar.gz schoolos-migrate.tar.gz ubuntu@<vps>:~/schoolos-app/
ssh -i <key> ubuntu@<vps> "cd ~/schoolos-app && docker load -i schoolos-app.tar.gz && docker load -i schoolos-migrate.tar.gz && rm *.tar.gz"
```

## Migrate, then start the app

```bash
ssh ... "cd ~/schoolos-app && docker compose run --rm migrate"
# Confirm it printed "migrations applied successfully!" before continuing.
ssh ... "cd ~/schoolos-app && docker compose up -d app"
```

**If migrate fails partway:** do not proceed to `up -d app` — `app`'s
`depends_on: migrate: condition: service_completed_successfully` will refuse
to start anyway, which is the correct fail-safe. Diagnose from the migrate
container's log; do not re-run blindly if the failure is a real schema
conflict rather than a transient connection issue.

## Post-deploy verification

```bash
curl -s https://schoolos.epioso.com/api/health
# {"status":"healthy","database":"reachable",...}
docker compose ps          # all three (db, clamav, app) Up/healthy
```

## Rollback

**The honest gap this runbook exists to close:** there is currently no
automated image versioning — `docker load` overwrites the `:latest` tag, so
the previous image is gone once the new one loads unless you deliberately
keep it.

**Until that's fixed, the only real rollback is re-running the build from an
earlier commit:**
```bash
git checkout <previous-good-commit>
# repeat the full Build -> Transfer -> Migrate -> Start sequence above
```

**Migrations are the harder part of rollback.** `drizzle-kit migrate` has no
built-in "down" migration in this project — migrations here are additive
(`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). Rolling back
application code while a forward migration has already applied is **not
generally safe** if that migration removed a column/table the old code reads.
For an additive migration (the common case here), rolling back the app while
keeping the new schema is usually fine — the old code just doesn't use the
new columns. If a migration ever needs to be undone, that must be a
deliberate, reviewed action, not a blind rollback — this project does not yet
have a tested down-migration path.

**Recommendation, not yet implemented:** tag images with a commit SHA in
addition to `:latest` (`docker tag ... schoolos-app:$(git rev-parse
--short HEAD)`) and keep the last 2-3 on the VPS, so rollback is
`docker compose up -d` against a previous tag rather than a full rebuild.

## Known traps (hit and fixed during this project's actual deployment)

- **`app` will not start if `clamav` is unhealthy** — `depends_on: clamav:
  condition: service_healthy`. ClamAV's first boot (loading its virus
  database) can take a couple of minutes; don't assume a stall means failure.
- **Starting everything simultaneously on first deploy overloaded the 2GB
  host** and made it briefly fully unreachable (SSH timed out at banner
  exchange). Bring services up in stages on a fresh host, not all via one
  `docker compose up -d` with nothing already warm.
- **Postgres and the app port are bound to `127.0.0.1` only**, reverse-proxied
  by nginx — never publish either to `0.0.0.0` on this shared VPS.
