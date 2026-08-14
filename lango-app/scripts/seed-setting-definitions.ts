import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/libs/DB';
import { syncAllTenantDefinitions } from '../src/features/settings/services/definitions-service';

// Idempotent: safe to run any number of times. First run inserts catalog
// metadata rows for every SETTINGS_REGISTRY key; later runs are no-ops unless
// the code registry changed (metadata diff bumps the version history).

async function main() {
  const tenants = await db.execute(sql`SELECT id, name FROM tenants ORDER BY name`);
  console.log('TENANTS:', JSON.stringify(tenants.rows));

  const first = await syncAllTenantDefinitions();
  console.log('SYNC (1st run):', JSON.stringify(first));

  const second = await syncAllTenantDefinitions();
  console.log('SYNC (2nd run, all created/updated should be 0):', JSON.stringify(second));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
