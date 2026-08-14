import 'dotenv/config';
import { db } from '../src/libs/DB';
import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';

async function main() {
  const fileSql = fs.readFileSync(path.join(process.cwd(), 'migrations/0057_add_admission_model_enhancement.sql'), 'utf-8');
  console.log("Running 0057...");
  try {
    await db.execute(sql.raw(fileSql));
    console.log("0057 SUCCESS");
  } catch (e) {
    console.error("0057 ERROR:");
    console.error(e);
  }
}
main().then(()=>process.exit(0)).catch(e => { console.error(e); process.exit(1); });
