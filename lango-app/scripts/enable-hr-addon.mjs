import 'dotenv/config';
import pg from 'pg';
import crypto from 'node:crypto';

const TENANT_ID = '06ab27c5-7862-4e07-93af-49ef1935bfe6';

async function main() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const addons = ['human-resources', 'payroll-workforce', 'workforce', 'payroll', 'live-classrooms', 'hostel', 'transport', 'library'];

  for (const slug of addons) {
    await c.query(`
      INSERT INTO addon_entitlements (id, tenant_id, addon_id, is_enabled, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      ON CONFLICT (tenant_id, addon_id) DO UPDATE SET is_enabled = true, updated_at = NOW()
    `, [crypto.randomUUID(), TENANT_ID, slug]);
  }

  const res = await c.query('SELECT addon_id, is_enabled FROM addon_entitlements WHERE tenant_id = $1', [TENANT_ID]);
  console.log('Active entitlements for tenant:', res.rows);

  await c.end();
}

main().catch(console.error);
