import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '../src/libs/DB';

async function main() {
  console.log('Running all migrations directly...');
  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations complete.');
  } catch(e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

main().then(()=>process.exit(0));
