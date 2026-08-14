import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function migrateTransport() {
  console.log('=== Step 1: Loading Migration File ===');
  const migrationPath = path.join(__dirname, '../migrations/0082_student_transport.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at ${migrationPath}`);
  }

  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Loaded migration 0082_student_transport.sql (${sqlContent.length} bytes).`);

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

  const connectionString = process.env.DATABASE_URL || 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos';
  console.log(`Connecting to PostgreSQL at ${connectionString.replace(/:[^:@]+@/, ':***@')}...`);

  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL.');

    console.log('=== Step 2: Executing Migration SQL ===');
    await client.query(sqlContent);
    console.log('Migration SQL executed successfully.');

    client.release();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateTransport();
