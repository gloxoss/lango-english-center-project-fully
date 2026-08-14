-- Student Transport Add-on Migration
DO $$ BEGIN
  CREATE TYPE "transport_vehicle_status" AS ENUM ('active', 'maintenance', 'out_of_service', 'retired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_route_direction" AS ENUM ('pickup', 'dropoff', 'shuttle', 'bidirectional');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_route_status" AS ENUM ('draft', 'active', 'suspended', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_route_version_status" AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_allocation_direction" AS ENUM ('morning', 'afternoon', 'both');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_allocation_status" AS ENUM ('active', 'waitlisted', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_trip_status" AS ENUM ('scheduled', 'boarding', 'in_progress', 'completed', 'cancelled', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_rider_event_type" AS ENUM ('boarded', 'alighted', 'missed', 'absent', 'override');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_verification_method" AS ENUM ('qr_scan', 'nfc', 'manual', 'override');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_incident_type" AS ENUM ('missed_pickup', 'wrong_stop', 'student_not_boarded', 'unauthorized_pickup_attempt', 'vehicle_breakdown', 'late_route', 'safeguarding', 'medical', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_incident_severity" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_incident_status" AS ENUM ('open', 'investigating', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transport_fare_link_status" AS ENUM ('pending', 'billed', 'waived', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Vehicles
CREATE TABLE IF NOT EXISTS "transport_vehicles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "branch_id" text,
  "vehicle_code" text NOT NULL,
  "registration_number" text NOT NULL,
  "capacity" integer NOT NULL,
  "vehicle_type" text DEFAULT 'bus' NOT NULL,
  "make_model" text,
  "ownership_vendor" text,
  "external_gps_device_id" text,
  "accessibility_attributes" jsonb,
  "status" "transport_vehicle_status" DEFAULT 'active' NOT NULL,
  "insurance_expiry" text,
  "inspection_expiry" text,
  "permit_expiry" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_transport_vehicles_code" UNIQUE ("tenant_id", "vehicle_code"),
  CONSTRAINT "uq_transport_vehicles_reg" UNIQUE ("tenant_id", "registration_number")
);
CREATE INDEX IF NOT EXISTS "idx_transport_vehicles_tenant" ON "transport_vehicles" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_vehicles_branch" ON "transport_vehicles" ("tenant_id", "branch_id");

-- 2. Vehicle Documents
CREATE TABLE IF NOT EXISTS "transport_vehicle_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "vehicle_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "title" text NOT NULL,
  "attachment_id" text,
  "expiry_date" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transport_veh_docs_tenant" ON "transport_vehicle_documents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_veh_docs_vehicle" ON "transport_vehicle_documents" ("tenant_id", "vehicle_id");

-- 3. Stops
CREATE TABLE IF NOT EXISTS "transport_stops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "branch_id" text,
  "stop_code" text NOT NULL,
  "stop_name" text NOT NULL,
  "address" text,
  "latitude" numeric(10, 7),
  "longitude" numeric(10, 7),
  "geofence_radius_meters" integer DEFAULT 50,
  "landmark" text,
  "safety_notes" text,
  "accessibility_notes" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_transport_stops_code" UNIQUE ("tenant_id", "stop_code")
);
CREATE INDEX IF NOT EXISTS "idx_transport_stops_tenant" ON "transport_stops" ("tenant_id");

-- 4. Routes
CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "branch_id" text,
  "route_code" text NOT NULL,
  "route_name" text NOT NULL,
  "service_direction" "transport_route_direction" DEFAULT 'bidirectional' NOT NULL,
  "active_version_id" uuid,
  "assigned_vehicle_id" uuid,
  "status" "transport_route_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_transport_routes_code" UNIQUE ("tenant_id", "route_code")
);
CREATE INDEX IF NOT EXISTS "idx_transport_routes_tenant" ON "transport_routes" ("tenant_id");

-- 5. Route Versions
CREATE TABLE IF NOT EXISTS "transport_route_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "route_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "effective_start_date" text NOT NULL,
  "effective_end_date" text,
  "distance_km" numeric(8, 2),
  "duration_minutes" integer,
  "status" "transport_route_version_status" DEFAULT 'published' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_transport_route_version_num" UNIQUE ("tenant_id", "route_id", "version_number")
);
CREATE INDEX IF NOT EXISTS "idx_transport_route_versions_tenant" ON "transport_route_versions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_route_versions_route" ON "transport_route_versions" ("tenant_id", "route_id");

-- 6. Route Stops
CREATE TABLE IF NOT EXISTS "transport_route_stops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "version_id" uuid NOT NULL,
  "stop_id" uuid NOT NULL,
  "stop_sequence" integer NOT NULL,
  "planned_arrival_time" text,
  "planned_departure_time" text,
  "dwell_time_seconds" integer DEFAULT 60,
  "pickup_allowed" boolean DEFAULT true,
  "dropoff_allowed" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_transport_route_stop_seq" UNIQUE ("tenant_id", "version_id", "stop_sequence")
);
CREATE INDEX IF NOT EXISTS "idx_transport_route_stops_tenant" ON "transport_route_stops" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_route_stops_version" ON "transport_route_stops" ("tenant_id", "version_id");

-- 7. Crew Assignments
CREATE TABLE IF NOT EXISTS "transport_crew_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "route_id" uuid NOT NULL,
  "vehicle_id" uuid,
  "driver_employee_id" text NOT NULL,
  "attendant_employee_id" text,
  "effective_start_date" text NOT NULL,
  "effective_end_date" text,
  "recurring_days" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transport_crew_tenant" ON "transport_crew_assignments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_crew_route" ON "transport_crew_assignments" ("tenant_id", "route_id");
CREATE INDEX IF NOT EXISTS "idx_transport_crew_driver" ON "transport_crew_assignments" ("tenant_id", "driver_employee_id");

-- 8. Student Allocations
CREATE TABLE IF NOT EXISTS "transport_student_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "student_id" text NOT NULL,
  "route_id" uuid NOT NULL,
  "pickup_stop_id" uuid NOT NULL,
  "dropoff_stop_id" uuid NOT NULL,
  "direction" "transport_allocation_direction" DEFAULT 'both' NOT NULL,
  "effective_start_date" text NOT NULL,
  "effective_end_date" text,
  "service_days" jsonb,
  "assistance_notes" text,
  "status" "transport_allocation_status" DEFAULT 'active' NOT NULL,
  "fare_reference_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transport_alloc_tenant" ON "transport_student_allocations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_alloc_student" ON "transport_student_allocations" ("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "idx_transport_alloc_route" ON "transport_student_allocations" ("tenant_id", "route_id");

-- 9. Trips
CREATE TABLE IF NOT EXISTS "transport_trips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "branch_id" text,
  "route_id" uuid NOT NULL,
  "route_version_id" uuid NOT NULL,
  "service_date" text NOT NULL,
  "direction" "transport_route_direction" DEFAULT 'pickup' NOT NULL,
  "planned_start_time" text,
  "planned_end_time" text,
  "actual_start_time" text,
  "actual_end_time" text,
  "vehicle_id" uuid,
  "driver_id" text,
  "attendant_id" text,
  "status" "transport_trip_status" DEFAULT 'scheduled' NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transport_trips_tenant" ON "transport_trips" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_trips_date" ON "transport_trips" ("tenant_id", "service_date");
CREATE INDEX IF NOT EXISTS "idx_transport_trips_route" ON "transport_trips" ("tenant_id", "route_id");

-- 10. Trip Roster Snapshots
CREATE TABLE IF NOT EXISTS "transport_trip_roster_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "trip_id" uuid NOT NULL,
  "student_id" text NOT NULL,
  "pickup_stop_id" uuid NOT NULL,
  "dropoff_stop_id" uuid NOT NULL,
  "direction" text NOT NULL,
  "allocated_status" text DEFAULT 'allocated' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_transport_roster_trip_student" UNIQUE ("tenant_id", "trip_id", "student_id")
);
CREATE INDEX IF NOT EXISTS "idx_transport_roster_tenant" ON "transport_trip_roster_snapshots" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_roster_trip" ON "transport_trip_roster_snapshots" ("tenant_id", "trip_id");

-- 11. Rider Events
CREATE TABLE IF NOT EXISTS "transport_rider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "trip_id" uuid NOT NULL,
  "student_id" text NOT NULL,
  "stop_id" uuid NOT NULL,
  "event_type" "transport_rider_event_type" NOT NULL,
  "verification_method" "transport_verification_method" DEFAULT 'qr_scan' NOT NULL,
  "event_timestamp" timestamp DEFAULT now() NOT NULL,
  "actor_user_id" text NOT NULL,
  "device_id" text,
  "exception_reason" text,
  "idempotency_key" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transport_rider_events_tenant" ON "transport_rider_events" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_rider_events_trip" ON "transport_rider_events" ("tenant_id", "trip_id");
CREATE INDEX IF NOT EXISTS "idx_transport_rider_events_student" ON "transport_rider_events" ("tenant_id", "student_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_transport_rider_events_idempotency" ON "transport_rider_events" ("tenant_id", "idempotency_key");

-- 12. Incidents
CREATE TABLE IF NOT EXISTS "transport_incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "trip_id" uuid,
  "vehicle_id" uuid,
  "driver_id" text,
  "incident_type" "transport_incident_type" NOT NULL,
  "severity" "transport_incident_severity" DEFAULT 'medium' NOT NULL,
  "status" "transport_incident_status" DEFAULT 'open' NOT NULL,
  "reported_by_user_id" text NOT NULL,
  "assigned_responder_user_id" text,
  "title" text NOT NULL,
  "description" text,
  "resolution_summary" text,
  "safeguarding_redacted_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transport_incidents_tenant" ON "transport_incidents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_incidents_status" ON "transport_incidents" ("tenant_id", "status");

-- 13. Incident Actions
CREATE TABLE IF NOT EXISTS "transport_incident_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "incident_id" uuid NOT NULL,
  "actor_user_id" text NOT NULL,
  "action_taken" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transport_inc_actions_tenant" ON "transport_incident_actions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_inc_actions_incident" ON "transport_incident_actions" ("tenant_id", "incident_id");

-- 14. Fare Links
CREATE TABLE IF NOT EXISTS "transport_fare_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "allocation_id" uuid NOT NULL,
  "fee_structure_id" text,
  "invoice_id" text,
  "charge_amount" numeric(10, 2) DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'MAD' NOT NULL,
  "status" "transport_fare_link_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transport_fare_links_tenant" ON "transport_fare_links" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transport_fare_links_alloc" ON "transport_fare_links" ("tenant_id", "allocation_id");

-- 15. Policies
CREATE TABLE IF NOT EXISTS "transport_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "max_capacity_margin_percent" integer DEFAULT 0,
  "require_safe_handoff_younger_students" boolean DEFAULT false,
  "handoff_age_threshold_years" integer DEFAULT 8,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_transport_policies_tenant" UNIQUE ("tenant_id")
);
CREATE INDEX IF NOT EXISTS "idx_transport_policies_tenant" ON "transport_policies" ("tenant_id");
