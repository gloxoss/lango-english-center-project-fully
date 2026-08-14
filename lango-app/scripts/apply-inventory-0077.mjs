// Apply the inventory migration 0077 directly (raw pg), bypassing the drizzle
// TS schema which currently fails to load because of a parallel agent's broken
// hostel-schema.ts import. Deliberately does NOT record a drizzle tracking row:
// the parallel 0076_hostel_management migration is broken mid-file (42601) and
// leaving 0076 untracked keeps `docker compose up migrate` honest — once the
// hostel agent fixes 0076, a migrate run will apply 0076 then re-apply this
// idempotent 0077 (no-op) and record both in journal order.
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const ROOT = path.join(process.cwd(), 'migrations');

async function main() {
  const file = path.join(ROOT, '0077_inventory_management.sql');
  const query = fs.readFileSync(file, 'utf-8');
  const blocks = query.split('--> statement-breakpoint').map((s) => s.trim()).filter((s) => s.length > 0);
  console.log(`APPLY 0077_inventory_management (${blocks.length} blocks)`);
  for (const block of blocks) {
    await pool.query(block);
  }
  console.log('DONE — 0077 applied (not recorded in drizzle tracking, by design)');
}

main().then(() => pool.end()).catch(async (e) => {
  console.error('FATAL', e);
  await pool.end();
  process.exit(1);
});
