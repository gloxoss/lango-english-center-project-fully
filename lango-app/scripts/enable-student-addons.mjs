import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TENANT_ID = '06ab27c5-7862-4e07-93af-49ef1935bfe6';

async function main() {
  const addons = ['hostel', 'transport', 'library', 'live-classrooms'];
  for (const addonId of addons) {
    await pool.query(`
      INSERT INTO addon_entitlements (id, tenant_id, addon_id, is_enabled, expires_at, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, true, null, NOW(), NOW())
      ON CONFLICT (tenant_id, addon_id) 
      DO UPDATE SET is_enabled = true, updated_at = NOW();
    `, [TENANT_ID, addonId]);
  }
  console.log('Enabled addons for tenant:', addons);
  await pool.end();
}

main().catch(console.error);
