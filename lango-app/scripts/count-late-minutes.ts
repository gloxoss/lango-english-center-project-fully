import { db } from '../src/libs/DB';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

async function main() {
  // Check main DB (schoolos)
  const res1 = await db.execute(sql`SELECT COUNT(id)::int as count FROM attendance WHERE note LIKE 'Classe virtuelle:%' AND late_minutes > 60`);
  console.log('schoolos affected count:', res1.rows[0]);

  // Check audit DB (schoolos_audit)
  const auditUrl = (process.env.DATABASE_URL || '').replace(/\/[^/?]+(\?.*)?$/, '/schoolos_audit$1');
  const pool = new pg.Pool({ connectionString: auditUrl });
  const auditDb = drizzle(pool);
  try {
    const res2 = await auditDb.execute(sql`SELECT COUNT(id)::int as count FROM attendance WHERE note LIKE 'Classe virtuelle:%' AND late_minutes > 60`);
    console.log('schoolos_audit affected count:', res2.rows[0]);
  } catch (err: any) {
    console.log('schoolos_audit error:', err.message);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
