import 'dotenv/config';
import { db } from '../src/libs/DB';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Dropping public schema...');
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE;`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  console.log('Creating public schema...');
  await db.execute(sql`CREATE SCHEMA public;`);
  await db.execute(sql`GRANT ALL ON SCHEMA public TO schoolos;`);
  await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);
  console.log('Database reset complete.');
}
main().then(()=>process.exit(0)).catch(e => { console.error(e); process.exit(1); });
