import 'dotenv/config';
import { db } from '../src/libs/DB';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 15`);
  console.log(result.rows);
  process.exit(0);
}

main().catch(console.error);
