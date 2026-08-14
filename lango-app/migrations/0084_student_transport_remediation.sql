-- Migration: 0084_student_transport_remediation.sql
-- Description: Composite tenant-scoped foreign keys, unique tenant constraints, domain check constraints, and vocabulary harmonization.

-- 1. Create Composite UNIQUE Constraints (tenant_id, id) on Parent Tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_transport_vehicles_tenant_id') THEN
    ALTER TABLE "transport_vehicles" ADD CONSTRAINT "uq_transport_vehicles_tenant_id" UNIQUE ("tenant_id", "id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_transport_stops_tenant_id') THEN
    ALTER TABLE "transport_stops" ADD CONSTRAINT "uq_transport_stops_tenant_id" UNIQUE ("tenant_id", "id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_transport_routes_tenant_id') THEN
    ALTER TABLE "transport_routes" ADD CONSTRAINT "uq_transport_routes_tenant_id" UNIQUE ("tenant_id", "id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_transport_route_versions_tenant_id') THEN
    ALTER TABLE "transport_route_versions" ADD CONSTRAINT "uq_transport_route_versions_tenant_id" UNIQUE ("tenant_id", "id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_transport_trips_tenant_id') THEN
    ALTER TABLE "transport_trips" ADD CONSTRAINT "uq_transport_trips_tenant_id" UNIQUE ("tenant_id", "id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_transport_allocations_tenant_id') THEN
    ALTER TABLE "transport_student_allocations" ADD CONSTRAINT "uq_transport_allocations_tenant_id" UNIQUE ("tenant_id", "id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_transport_incidents_tenant_id') THEN
    ALTER TABLE "transport_incidents" ADD CONSTRAINT "uq_transport_incidents_tenant_id" UNIQUE ("tenant_id", "id");
  END IF;
END $$;

-- 2. Add Composite Tenant-Consistent Foreign Key Constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_veh_docs_vehicle_tenant') THEN
    ALTER TABLE "transport_vehicle_documents"
      ADD CONSTRAINT "fk_transport_veh_docs_vehicle_tenant"
      FOREIGN KEY ("tenant_id", "vehicle_id")
      REFERENCES "transport_vehicles"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_route_ver_route_tenant') THEN
    ALTER TABLE "transport_route_versions"
      ADD CONSTRAINT "fk_transport_route_ver_route_tenant"
      FOREIGN KEY ("tenant_id", "route_id")
      REFERENCES "transport_routes"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_route_stops_ver_tenant') THEN
    ALTER TABLE "transport_route_stops"
      ADD CONSTRAINT "fk_transport_route_stops_ver_tenant"
      FOREIGN KEY ("tenant_id", "version_id")
      REFERENCES "transport_route_versions"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_route_stops_stop_tenant') THEN
    ALTER TABLE "transport_route_stops"
      ADD CONSTRAINT "fk_transport_route_stops_stop_tenant"
      FOREIGN KEY ("tenant_id", "stop_id")
      REFERENCES "transport_stops"("tenant_id", "id") ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_crew_route_tenant') THEN
    ALTER TABLE "transport_crew_assignments"
      ADD CONSTRAINT "fk_transport_crew_route_tenant"
      FOREIGN KEY ("tenant_id", "route_id")
      REFERENCES "transport_routes"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_alloc_route_tenant') THEN
    ALTER TABLE "transport_student_allocations"
      ADD CONSTRAINT "fk_transport_alloc_route_tenant"
      FOREIGN KEY ("tenant_id", "route_id")
      REFERENCES "transport_routes"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_alloc_pickup_stop_tenant') THEN
    ALTER TABLE "transport_student_allocations"
      ADD CONSTRAINT "fk_transport_alloc_pickup_stop_tenant"
      FOREIGN KEY ("tenant_id", "pickup_stop_id")
      REFERENCES "transport_stops"("tenant_id", "id") ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_alloc_dropoff_stop_tenant') THEN
    ALTER TABLE "transport_student_allocations"
      ADD CONSTRAINT "fk_transport_alloc_dropoff_stop_tenant"
      FOREIGN KEY ("tenant_id", "dropoff_stop_id")
      REFERENCES "transport_stops"("tenant_id", "id") ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_trips_route_tenant') THEN
    ALTER TABLE "transport_trips"
      ADD CONSTRAINT "fk_transport_trips_route_tenant"
      FOREIGN KEY ("tenant_id", "route_id")
      REFERENCES "transport_routes"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_trips_ver_tenant') THEN
    ALTER TABLE "transport_trips"
      ADD CONSTRAINT "fk_transport_trips_ver_tenant"
      FOREIGN KEY ("tenant_id", "route_version_id")
      REFERENCES "transport_route_versions"("tenant_id", "id") ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_roster_trip_tenant') THEN
    ALTER TABLE "transport_trip_roster_snapshots"
      ADD CONSTRAINT "fk_transport_roster_trip_tenant"
      FOREIGN KEY ("tenant_id", "trip_id")
      REFERENCES "transport_trips"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_rider_events_trip_tenant') THEN
    ALTER TABLE "transport_rider_events"
      ADD CONSTRAINT "fk_transport_rider_events_trip_tenant"
      FOREIGN KEY ("tenant_id", "trip_id")
      REFERENCES "transport_trips"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_rider_events_stop_tenant') THEN
    ALTER TABLE "transport_rider_events"
      ADD CONSTRAINT "fk_transport_rider_events_stop_tenant"
      FOREIGN KEY ("tenant_id", "stop_id")
      REFERENCES "transport_stops"("tenant_id", "id") ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_inc_actions_inc_tenant') THEN
    ALTER TABLE "transport_incident_actions"
      ADD CONSTRAINT "fk_transport_inc_actions_inc_tenant"
      FOREIGN KEY ("tenant_id", "incident_id")
      REFERENCES "transport_incidents"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_fare_links_alloc_tenant') THEN
    ALTER TABLE "transport_fare_links"
      ADD CONSTRAINT "fk_transport_fare_links_alloc_tenant"
      FOREIGN KEY ("tenant_id", "allocation_id")
      REFERENCES "transport_student_allocations"("tenant_id", "id") ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Add Domain Check Constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transport_vehicles_capacity') THEN
    ALTER TABLE "transport_vehicles" ADD CONSTRAINT "chk_transport_vehicles_capacity" CHECK ("capacity" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transport_stops_geofence') THEN
    ALTER TABLE "transport_stops" ADD CONSTRAINT "chk_transport_stops_geofence" CHECK ("geofence_radius_meters" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transport_route_stops_sequence') THEN
    ALTER TABLE "transport_route_stops" ADD CONSTRAINT "chk_transport_route_stops_sequence" CHECK ("stop_sequence" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transport_route_versions_dates') THEN
    ALTER TABLE "transport_route_versions"
      ADD CONSTRAINT "chk_transport_route_versions_dates"
      CHECK ("effective_end_date" IS NULL OR "effective_end_date" >= "effective_start_date");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transport_crew_dates') THEN
    ALTER TABLE "transport_crew_assignments"
      ADD CONSTRAINT "chk_transport_crew_dates"
      CHECK ("effective_end_date" IS NULL OR "effective_end_date" >= "effective_start_date");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transport_alloc_dates') THEN
    ALTER TABLE "transport_student_allocations"
      ADD CONSTRAINT "chk_transport_alloc_dates"
      CHECK ("effective_end_date" IS NULL OR "effective_end_date" >= "effective_start_date");
  END IF;
END $$;
