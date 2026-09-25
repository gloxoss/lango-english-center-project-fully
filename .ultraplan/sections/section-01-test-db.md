# Section 01: Test database isolation + leftover tenant

## Overview
DB tests write to the development database `schoolos` because `lango-app/.env` points there and no `schoolos_audit` exists in the `schoolos-db` container. Create `schoolos_audit`, make the test run refuse `schoolos`, remove the one leftover test tenant.

## Risk: [yellow] DB creation is safe; 01-03 deletes data and needs owner decision D5.

## Dependencies
- Depends on: none · Blocks: 04, 12, 13 · Batch 1 · Hub item: `task:up-01-test-db`

## Tasks

<task type="auto" id="01-01">
  <name>Create and migrate schoolos_audit</name>
  <files>none (database only)</files>
  <action>
    Take user/password from lango-app/.env DATABASE_URL (never print them).
    docker exec schoolos-db psql -U <user> -d postgres -c "CREATE DATABASE schoolos_audit OWNER <user>;"
    cd lango-app && DATABASE_URL=postgresql://<user>:<pass>@localhost:5433/schoolos_audit npm run db:migrate
  </action>
  <verify>select count(*) from drizzle.__drizzle_migrations in schoolos_audit equals the count in schoolos (162 on 2026-09-25).</verify>
  <done>schoolos_audit exists, fully migrated.</done>
</task>

<task type="auto" id="01-02">
  <name>Refuse to run DB tests against the dev database</name>
  <files>lango-app/vitest.config.ts</files>
  <action>
    vitest.config.ts already resolves DATABASE_URL (shell wins over .env, ~line 76) and has a DB precondition (~line 38). Next to that precondition add one guard: if the resolved DATABASE_URL's database name is not schoolos_audit and ALLOW_DB_SKIP is not set, throw with the message "DB tests must use schoolos_audit: set DATABASE_URL=.../schoolos_audit".
    Comment it: // ponytail: name check only; a dedicated TEST_DATABASE_URL var if more test DBs appear.
    Add one line to lango-app/.env.example documenting the test URL.
  </action>
  <verify>With the dev URL: npx vitest run grade-entry-route fails fast with the message. With the audit URL: it passes.</verify>
  <done>Running tests against schoolos is impossible by accident.</done>
</task>

<task type="auto" id="01-03">
  <name>Delete the leftover test tenant (ONLY after owner decision D5)</name>
  <files>none (database only)</files>
  <action>
    In db schoolos: SELECT first and confirm exactly 1 row with slug 'gl-status-bc4222f4-05fb-4999-acd1-6ba0756eb9dd' created 2026-09-25. Then DELETE that tenant in one transaction; children cascade. If a FK blocks it, stop and report; do not delete children by hand.
  </action>
  <verify>select count(*) from tenants where slug like 'gl-status-%' = 0.</verify>
  <done>No test tenant left in the dev DB.</done>
</task>

<task type="auto" id="01-04">
  <name>Full-suite baseline on schoolos_audit</name>
  <files>none</files>
  <action>Run the full suite with the audit URL. Post totals and every failing test's first error line in the hub done note.</action>
  <verify>Paste the exact "Test Files" and "Tests" lines.</verify>
  <done>A trustworthy baseline that never touched schoolos.</done>
</task>
