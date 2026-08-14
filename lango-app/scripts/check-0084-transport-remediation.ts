import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function checkTransportRemediation() {
  console.log('=== Checking Migration 0084 (Transport Remediation Verification) ===');

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
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();

    // 1. Check Unique Constraints
    const expectedUniques = [
      'uq_transport_vehicles_tenant_id',
      'uq_transport_stops_tenant_id',
      'uq_transport_routes_tenant_id',
      'uq_transport_route_versions_tenant_id',
      'uq_transport_trips_tenant_id',
      'uq_transport_allocations_tenant_id',
      'uq_transport_incidents_tenant_id',
    ];

    console.log('\n--- Checking Composite Unique Constraints ---');
    for (const uq of expectedUniques) {
      const res = await client.query(
        `SELECT conname FROM pg_constraint WHERE conname = $1 AND contype = 'u'`,
        [uq],
      );
      if (res.rows.length === 0) {
        throw new Error(`Missing unique constraint: ${uq}`);
      }
      console.log(`[PASS] Unique constraint verified: ${uq}`);
    }

    // 2. Check Composite Foreign Keys
    const expectedFKs = [
      'fk_transport_veh_docs_vehicle_tenant',
      'fk_transport_route_ver_route_tenant',
      'fk_transport_route_stops_ver_tenant',
      'fk_transport_route_stops_stop_tenant',
      'fk_transport_crew_route_tenant',
      'fk_transport_alloc_route_tenant',
      'fk_transport_alloc_pickup_stop_tenant',
      'fk_transport_alloc_dropoff_stop_tenant',
      'fk_transport_trips_route_tenant',
      'fk_transport_trips_ver_tenant',
      'fk_transport_roster_trip_tenant',
      'fk_transport_rider_events_trip_tenant',
      'fk_transport_rider_events_stop_tenant',
      'fk_transport_inc_actions_inc_tenant',
      'fk_transport_fare_links_alloc_tenant',
    ];

    console.log('\n--- Checking Composite Foreign Keys ---');
    for (const fk of expectedFKs) {
      const res = await client.query(
        `SELECT conname FROM pg_constraint WHERE conname = $1 AND contype = 'f'`,
        [fk],
      );
      if (res.rows.length === 0) {
        throw new Error(`Missing foreign key constraint: ${fk}`);
      }
      console.log(`[PASS] Foreign key verified: ${fk}`);
    }

    // 3. Check Domain Constraints
    const expectedChecks = [
      'chk_transport_vehicles_capacity',
      'chk_transport_stops_geofence',
      'chk_transport_route_stops_sequence',
      'chk_transport_route_versions_dates',
      'chk_transport_crew_dates',
      'chk_transport_alloc_dates',
    ];

    console.log('\n--- Checking Domain Check Constraints ---');
    for (const chk of expectedChecks) {
      const res = await client.query(
        `SELECT conname FROM pg_constraint WHERE conname = $1 AND contype = 'c'`,
        [chk],
      );
      if (res.rows.length === 0) {
        throw new Error(`Missing check constraint: ${chk}`);
      }
      console.log(`[PASS] Check constraint verified: ${chk}`);
    }

    console.log('\n======================================================');
    console.log('SUCCESS: All composite unique constraints, foreign keys, and check constraints verified!');
    console.log('======================================================');
    client.release();
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkTransportRemediation();
