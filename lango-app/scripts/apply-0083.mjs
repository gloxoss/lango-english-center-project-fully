// Apply the Role Portals Foundation migration 0083 directly (raw pg), twice,
// to prove idempotency, then assert the three tables exist with expected shape.
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const ROOT = path.join(process.cwd(), 'migrations');
const TABLE_NAMES = ['portal_active_contexts', 'portal_preferences', 'portal_activity_events'];

async function main() {
  const file = path.join(ROOT, '0083_role_portals_foundation.sql');
  const query = fs.readFileSync(file, 'utf-8');
  const blocks = query.split('--> statement-breakpoint').map((s) => s.trim()).filter((s) => s.length > 0);

  const runs = [
    ['run 1', 1],
    ['run 2 (idempotency)', 2],
  ];
  for (const [label] of runs) {
    console.log(`APPLY 0083 ${label} (${blocks.length} blocks)`);
    for (const block of blocks) {
      await pool.query(block);
    }
    console.log(`  ${label} OK`);
  }

  for (const name of TABLE_NAMES) {
    const { rows } = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
      [name],
    );
    const cols = rows.map((r) => r.column_name);
    console.log(`TABLE ${name}: ${cols.join(', ')}`);
    for (const required of ['tenant_id', 'id']) {
      if (!cols.includes(required)) {
        throw new Error(`${name} missing required column ${required}`);
      }
    }
  }

  const count = await pool.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = ANY($1)",
    [TABLE_NAMES],
  );
  if (count.rows[0].n !== TABLE_NAMES.length) {
    throw new Error('Not all portal tables present');
  }
  console.log('ALL CHECKS PASS — 0083 applied and idempotent');
}

main().then(() => pool.end()).catch(async (e) => {
  console.error('FATAL', e);
  await pool.end();
  process.exit(1);
});
