import 'dotenv/config';
import { db } from '../src/libs/DB';
import { sql } from 'drizzle-orm';

async function main() {
  const tables = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'communication%' ORDER BY tablename`);
  console.log('BROADCAST TABLES:', tables.rows.map((r: any) => r.tablename).join(', '));
  const cols = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='inquiries' AND column_name='tags'`);
  console.log('inquiries.tags exists:', cols.rows.length > 0);
  const enums = await db.execute(sql`SELECT unnest(enum_range(NULL::inquiry_source))::text AS v`);
  console.log('inquiry_source values:', enums.rows.map((r: any) => r.v).join(', '));
  const idx = await db.execute(sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='inquiries' AND indexname LIKE 'inquiries_tenant%' ORDER BY indexname`);
  console.log('inquiries tenant indexes:', idx.rows.map((r: any) => r.indexname).join(', '));
  const ents = await db.execute(sql`SELECT addon_id, tenant_id, is_enabled FROM addon_entitlements WHERE addon_id IN ('lead-crm','broadcast-messaging') ORDER BY addon_id`);
  console.log('entitlements:', JSON.stringify(ents.rows));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
