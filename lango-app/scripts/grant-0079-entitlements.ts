import 'dotenv/config';
import { db } from '../src/libs/DB';
import { sql } from 'drizzle-orm';

const TENANTS = [
  { name: 'Atlas', id: 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239' },
  { name: 'Lango', id: 'f62f31eb-1fc8-4102-9145-a5ce0bca989b' },
];
const ADDONS = ['lead-crm', 'broadcast-messaging'];

async function main() {
  const tenants = await db.execute(sql`SELECT id, name FROM tenants ORDER BY name`);
  console.log('TENANTS IN DB:', JSON.stringify(tenants.rows));

  for (const t of TENANTS) {
    for (const addon of ADDONS) {
      await db.execute(sql`
        INSERT INTO addon_entitlements (tenant_id, addon_id, is_enabled, note, created_at, updated_at)
        VALUES (${t.id}, ${addon}, true, 'granted for lead-crm+broadcast verification', now(), now())
        ON CONFLICT (tenant_id, addon_id)
        DO UPDATE SET is_enabled = true, updated_at = now()
      `);
      console.log(`entitled ${t.name} -> ${addon}`);
    }
  }

  const check = await db.execute(sql`SELECT tenant_id, addon_id, is_enabled FROM addon_entitlements WHERE addon_id IN ('lead-crm','broadcast-messaging') ORDER BY addon_id`);
  console.log('ENTITLEMENTS:', JSON.stringify(check.rows));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
