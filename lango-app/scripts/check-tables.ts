import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/libs/DB';

async function main() {
  const result = await db.execute(sql`
    SELECT tablename FROM pg_tables 
    WHERE tablename IN (
      'certificate_event_rosters', 
      'document_templates'
    );
  `);
  console.log('Found tables:');
  result.rows.forEach(row => console.log('-', row.tablename));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
