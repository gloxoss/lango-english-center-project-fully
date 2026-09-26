const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos'
  });

  await client.connect();
  console.log('Connected to dev db schoolos');

  const sqlPath = path.resolve('lango-app/migrations/0161_timetable_no_overlap.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split statements by --> statement-breakpoint
  const statements = sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    console.log('Executing:', stmt.slice(0, 50), '...');
    await client.query(stmt);
  }

  // Insert migration tracking row
  await client.query(
    'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
    ['aaa5b9b4e9c6f3033e0a9090790a366595450d7a28964a5ef7e1b0a73ca24506', 1790120004000]
  );
  console.log('Migration 0161 record added to drizzle.__drizzle_migrations');

  // Verify constraints
  const res = await client.query(
    "SELECT conname, contype FROM pg_constraint WHERE conname LIKE 'class_schedule_slots%';"
  );
  console.log('Constraints on class_schedule_slots in schoolos:');
  console.table(res.rows);

  await client.end();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error applying 0161 to dev schoolos:', err);
  process.exit(1);
});
