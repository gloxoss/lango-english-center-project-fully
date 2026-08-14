import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const EXPECTED_TABLES = [
  'transport_vehicles',
  'transport_vehicle_documents',
  'transport_stops',
  'transport_routes',
  'transport_route_versions',
  'transport_route_stops',
  'transport_crew_assignments',
  'transport_student_allocations',
  'transport_trips',
  'transport_trip_roster_snapshots',
  'transport_rider_events',
  'transport_incidents',
  'transport_incident_actions',
  'transport_fare_links',
  'transport_policies',
];

const EXPECTED_ENUMS = [
  'transport_vehicle_status',
  'transport_route_direction',
  'transport_route_status',
  'transport_route_version_status',
  'transport_allocation_direction',
  'transport_allocation_status',
  'transport_trip_status',
  'transport_rider_event_type',
  'transport_verification_method',
  'transport_incident_type',
  'transport_incident_severity',
  'transport_incident_status',
  'transport_fare_link_status',
];

async function checkMigration() {
  console.log('=== Step 1: Connecting to PostgreSQL ===');
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
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();

    console.log('\n=== Step 2: Verifying Transport Tables ===');
    const tableRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'transport_%'
    `);
    const existingTables = new Set(tableRes.rows.map(r => r.table_name));

    let missingTables = 0;
    for (const table of EXPECTED_TABLES) {
      if (existingTables.has(table)) {
        console.log(`  [OK] Table "${table}" exists.`);
      } else {
        console.error(`  [MISSING] Table "${table}" DOES NOT EXIST.`);
        missingTables++;
      }
    }

    console.log('\n=== Step 3: Verifying PostgreSQL Enums ===');
    const enumRes = await client.query(`
      SELECT typname
      FROM pg_type
      WHERE typname LIKE 'transport_%'
    `);
    const existingEnums = new Set(enumRes.rows.map(r => r.typname));

    let missingEnums = 0;
    for (const enumName of EXPECTED_ENUMS) {
      if (existingEnums.has(enumName)) {
        console.log(`  [OK] Enum "${enumName}" exists.`);
      } else {
        console.error(`  [MISSING] Enum "${enumName}" DOES NOT EXIST.`);
        missingEnums++;
      }
    }

    console.log('\n=== Step 4: Verifying Idempotency Unique Index ===');
    const indexRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'transport_rider_events' AND indexname = 'idx_transport_rider_events_idempotency'
    `);

    let indexOk = false;
    if (indexRes.rows.length > 0) {
      console.log(`  [OK] Index "${indexRes.rows[0].indexname}" exists: ${indexRes.rows[0].indexdef}`);
      indexOk = true;
    } else {
      console.error('  [MISSING] Unique index "idx_transport_rider_events_idempotency" DOES NOT EXIST on transport_rider_events.');
    }

    client.release();

    if (missingTables === 0 && missingEnums === 0 && indexOk) {
      console.log('\n======================================================');
      console.log('SUCCESS: All 15 transport tables, 13 enums, and idempotency unique index verified!');
      console.log('======================================================');
    } else {
      console.error(`\nFAILED: ${missingTables} missing tables, ${missingEnums} missing enums, indexOk=${indexOk}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Check failed with connection error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkMigration();
