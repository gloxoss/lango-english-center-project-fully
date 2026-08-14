import 'dotenv/config';
import { db } from '../src/libs/DB';
import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';

async function main() {
  const fileSql = fs.readFileSync(path.join(process.cwd(), 'migrations/0088_parent_guardian_portal.sql'), 'utf-8');
  console.log('Running 0088 (run 1)...');
  await db.execute(sql.raw(fileSql));
  console.log('0088 run 1 SUCCESS');
  console.log('Running 0088 (run 2, idempotency)...');
  await db.execute(sql.raw(fileSql));
  console.log('0088 run 2 SUCCESS (idempotent)');
}
main().then(() => process.exit(0)).catch((e) => { console.error('0088 ERROR:'); console.error(e); process.exit(1); });
