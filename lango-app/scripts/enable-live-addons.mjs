import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tenants = ['06ab27c5-7862-4e07-93af-49ef1935bfe6', '5be685d1-27ef-4234-ad57-1e3f5826a540'];
  for (const tid of tenants) {
    const existing = await pool.query('SELECT id, is_enabled FROM addon_entitlements WHERE tenant_id = $1 AND addon_id = $2', [tid, 'live-classrooms']);
    if (existing.rows.length === 0) {
      await pool.query('INSERT INTO addon_entitlements (id, tenant_id, addon_id, is_enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())', [crypto.randomUUID(), tid, 'live-classrooms', true]);
      console.log(`Enabled live-classrooms for tenant ${tid}`);
    } else if (!existing.rows[0].is_enabled) {
      await pool.query('UPDATE addon_entitlements SET is_enabled = true WHERE id = $1', [existing.rows[0].id]);
      console.log(`Updated is_enabled to true for tenant ${tid}`);
    } else {
      console.log(`live-classrooms already active for tenant ${tid}`);
    }

    // Ensure dev provider profile exists
    const prov = await pool.query('SELECT id FROM live_class_provider_profiles WHERE tenant_id = $1 AND enabled = true', [tid]);
    if (prov.rows.length === 0) {
      const pid = crypto.randomUUID();
      await pool.query(`
        INSERT INTO live_class_provider_profiles (id, tenant_id, name, provider_type, base_url, enabled, created_at, updated_at)
        VALUES ($1, $2, 'Salle Virtuelle Locale', 'dev', 'http://localhost:3114/api/mock-bbb', true, NOW(), NOW())
      `, [pid, tid]);
      console.log(`Created dev provider profile for tenant ${tid}`);
    }
  }
  await pool.end();
}
main().catch(console.error);
