import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function migrateTransportRemediation() {
  console.log('=== Executing Migration 0084 (Transport Remediation) ===');
  const migrationPath = path.join(__dirname, '../migrations/0084_student_transport_remediation.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at ${migrationPath}`);
  }

  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Loaded migration 0084_student_transport_remediation.sql (${sqlContent.length} bytes).`);

  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.trim().match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]!]) {
        process.env[match[1]!] = match[2]!;
      }
    }
  }

  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos';
  console.log(`Connecting to PostgreSQL...`);

  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL.');

    await client.query(sqlContent);
    console.log('Migration 0084 executed successfully!');

    client.release();
  } catch (error) {
    console.error('Migration 0084 failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateTransportRemediation();
