# Section 03: ClamAV Docker Service & Scan Client

## Overview
Adds a real malware-scanning daemon to the Docker Compose stack and a small Node.js client the upload pipeline (section-05) calls to scan a quarantined file before it can ever become downloadable.

## Risk: [yellow] - first time this app runs a scanning daemon; startup/health-gating timing needs to be correct or uploads could bypass scanning during a cold start

## Dependencies
- Depends on: none
- Blocks: section-05
- Parallel batch: 1

## TDD Test Stubs
- Test: (infra + I/O section, no pure-function unit test — verified live in section-09 with a real EICAR test file against a real running clamd container)

## Tasks

<task type="auto" id="03-01">
  <name>Add the clamav service to docker-compose.yml</name>
  <files>docker-compose.yml</files>
  <action>
    Add a new service:
    ```yaml
      clamav:
        image: clamav/clamav:1.4
        container_name: schoolos-clamav
        restart: unless-stopped
        volumes:
          - schoolos_clamav_db:/var/lib/clamav
        healthcheck:
          test: ["CMD-SHELL", "clamdcheck.sh"]
          interval: 30s
          timeout: 10s
          retries: 5
          start_period: 180s
    ```
    (`clamdcheck.sh` ships inside the official `clamav/clamav` image as its documented healthcheck entrypoint script — no custom script file needed.) Add `schoolos_clamav_db` to the top-level `volumes:` block. Update the `app` service to add:
    ```yaml
        depends_on:
          migrate:
            condition: service_completed_successfully
          clamav:
            condition: service_healthy
        environment:
          # ...existing entries...
          CLAMAV_HOST: clamav
          CLAMAV_PORT: "3310"
    ```
    The `start_period: 180s` is deliberately generous (per RESEARCH.md's finding that first-boot virus-database load can take 1-5+ minutes) so the app container never starts accepting requests while clamd's database is still loading — `condition: service_healthy` blocks `app` startup until the healthcheck passes, not just until the container starts.
  </action>
  <verify>`docker compose config` parses cleanly (validates the compose file). `docker compose up -d clamav` then `docker compose ps` eventually shows clamav as `healthy` (may take several minutes on first pull).</verify>
  <done>docker-compose.yml has a clamav service with a persisted volume, a real healthcheck, and app now depends on it being healthy.</done>
</task>

<task type="auto" id="03-02">
  <name>Add the clamdjs dependency</name>
  <files>package.json</files>
  <action>
    Add `"clamdjs": "^1.0.0"` (or the latest published version) to `dependencies`. Run the project's package manager install command so `package-lock.json`/equivalent lockfile updates too.
  </action>
  <verify>`node -e "require('clamdjs')"` (or ESM equivalent) resolves inside the container after the next `docker compose build app`.</verify>
  <done>clamdjs is a real dependency, lockfile updated.</done>
</task>

<task type="auto" id="03-03">
  <name>Write the scan client wrapper</name>
  <files>src/libs/api/malware-scan.ts</files>
  <action>
    ```ts
    import { createScanner } from 'clamdjs';

    export type ScanResult = { clean: true } | { clean: false; reason: string };

    const scanner = createScanner(process.env.CLAMAV_HOST || 'clamav', Number(process.env.CLAMAV_PORT) || 3310);

    export async function scanBuffer(bytes: Buffer): Promise<ScanResult> {
      const reply = await scanner.scanBuffer(bytes, 30000, 1024 * 1024);
      if (reply.includes('OK')) {
        return { clean: true };
      }
      return { clean: false, reason: reply };
    }
    ```
    (Exact `clamdjs` API surface confirmed at implementation time against the installed package's actual TypeScript types/README — the shape above is RESEARCH.md's documented `scanBuffer(buffer, timeout, chunkSize)` signature; adjust the reply-parsing condition to match the real return format if it differs from a plain string containing 'OK'/'FOUND'.) This wrapper is the only place `clamdjs` is imported — section-05's upload pipeline calls `scanBuffer`, never the raw client, so a future swap to `clamscan` or a different client only touches this one file.
  </action>
  <verify>Compiles; calling `scanBuffer(Buffer.from('test'))` against a real running clamav container (once section-09 stands it up) returns `{ clean: true }` for a benign buffer.</verify>
  <done>malware-scan.ts exports scanBuffer, the single integration point section-05 depends on.</done>
</task>
