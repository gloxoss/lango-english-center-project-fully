import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Enums
export const transportVehicleStatusEnum = pgEnum('transport_vehicle_status', [
  'active',
  'maintenance',
  'out_of_service',
  'retired',
]);

export const transportRouteDirectionEnum = pgEnum('transport_route_direction', [
  'pickup',
  'dropoff',
  'shuttle',
  'bidirectional',
]);

export const transportRouteStatusEnum = pgEnum('transport_route_status', [
  'draft',
  'active',
  'suspended',
  'archived',
]);

export const transportRouteVersionStatusEnum = pgEnum('transport_route_version_status', [
  'draft',
  'published',
  'archived',
]);

export const transportAllocationDirectionEnum = pgEnum('transport_allocation_direction', [
  'morning',
  'afternoon',
  'both',
]);

export const transportAllocationStatusEnum = pgEnum('transport_allocation_status', [
  'active',
  'waitlisted',
  'suspended',
  'cancelled',
]);

export const transportTripStatusEnum = pgEnum('transport_trip_status', [
  'scheduled',
  'boarding',
  'in_progress',
  'completed',
  'cancelled',
  'failed',
]);

export const transportRiderEventTypeEnum = pgEnum('transport_rider_event_type', [
  'boarded',
  'alighted',
  'missed',
  'absent',
  'override',
]);

export const transportVerificationMethodEnum = pgEnum('transport_verification_method', [
  'qr_scan',
  'nfc',
  'manual',
  'override',
]);

export const transportIncidentTypeEnum = pgEnum('transport_incident_type', [
  'missed_pickup',
  'wrong_stop',
  'student_not_boarded',
  'unauthorized_pickup_attempt',
  'vehicle_breakdown',
  'late_route',
  'safeguarding',
  'medical',
  'other',
]);

export const transportIncidentSeverityEnum = pgEnum('transport_incident_severity', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const transportIncidentStatusEnum = pgEnum('transport_incident_status', [
  'open',
  'investigating',
  'resolved',
  'closed',
]);

export const transportFareLinkStatusEnum = pgEnum('transport_fare_link_status', [
  'pending',
  'billed',
  'waived',
  'cancelled',
]);

// 1. Vehicles
export const transportVehicles = pgTable(
  'transport_vehicles',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    branchId: text('branch_id'),
    vehicleCode: text('vehicle_code').notNull(),
    registrationNumber: text('registration_number').notNull(),
    capacity: integer('capacity').notNull(),
    vehicleType: text('vehicle_type').notNull().default('bus'),
    makeModel: text('make_model'),
    ownershipVendor: text('ownership_vendor'),
    externalGpsDeviceId: text('external_gps_device_id'),
    accessibilityAttributes: jsonb('accessibility_attributes'),
    status: transportVehicleStatusEnum('status').notNull().default('active'),
    insuranceExpiry: text('insurance_expiry'),
    inspectionExpiry: text('inspection_expiry'),
    permitExpiry: text('permit_expiry'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_vehicles_tenant').on(table.tenantId),
    index('idx_transport_vehicles_branch').on(table.tenantId, table.branchId),
    unique('uq_transport_vehicles_code').on(table.tenantId, table.vehicleCode),
    unique('uq_transport_vehicles_reg').on(table.tenantId, table.registrationNumber),
    unique('uq_transport_vehicles_tenant_id').on(table.tenantId, table.id),
  ],
);

// 2. Vehicle Documents
export const transportVehicleDocuments = pgTable(
  'transport_vehicle_documents',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    documentType: text('document_type').notNull(),
    title: text('title').notNull(),
    attachmentId: text('attachment_id'),
    expiryDate: text('expiry_date'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_veh_docs_tenant').on(table.tenantId),
    index('idx_transport_veh_docs_vehicle').on(table.tenantId, table.vehicleId),
  ],
);

// 3. Stops
export const transportStops = pgTable(
  'transport_stops',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    branchId: text('branch_id'),
    stopCode: text('stop_code').notNull(),
    stopName: text('stop_name').notNull(),
    address: text('address'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    geofenceRadiusMeters: integer('geofence_radius_meters').default(50),
    landmark: text('landmark'),
    safetyNotes: text('safety_notes'),
    accessibilityNotes: text('accessibility_notes'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_stops_tenant').on(table.tenantId),
    unique('uq_transport_stops_code').on(table.tenantId, table.stopCode),
    unique('uq_transport_stops_tenant_id').on(table.tenantId, table.id),
  ],
);

// 4. Routes
export const transportRoutes = pgTable(
  'transport_routes',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    branchId: text('branch_id'),
    routeCode: text('route_code').notNull(),
    routeName: text('route_name').notNull(),
    serviceDirection: transportRouteDirectionEnum('service_direction')
      .notNull()
      .default('bidirectional'),
    activeVersionId: uuid('active_version_id'),
    assignedVehicleId: uuid('assigned_vehicle_id'),
    status: transportRouteStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_routes_tenant').on(table.tenantId),
    unique('uq_transport_routes_code').on(table.tenantId, table.routeCode),
    unique('uq_transport_routes_tenant_id').on(table.tenantId, table.id),
  ],
);

// 5. Route Versions
export const transportRouteVersions = pgTable(
  'transport_route_versions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    routeId: uuid('route_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    effectiveStartDate: text('effective_start_date').notNull(),
    effectiveEndDate: text('effective_end_date'),
    distanceKm: numeric('distance_km', { precision: 8, scale: 2 }),
    durationMinutes: integer('duration_minutes'),
    status: transportRouteVersionStatusEnum('status').notNull().default('published'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_route_versions_tenant').on(table.tenantId),
    index('idx_transport_route_versions_route').on(table.tenantId, table.routeId),
    unique('uq_transport_route_version_num').on(table.tenantId, table.routeId, table.versionNumber),
    unique('uq_transport_route_versions_tenant_id').on(table.tenantId, table.id),
  ],
);

// 6. Route Stops
export const transportRouteStops = pgTable(
  'transport_route_stops',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    versionId: uuid('version_id').notNull(),
    stopId: uuid('stop_id').notNull(),
    stopSequence: integer('stop_sequence').notNull(),
    plannedArrivalTime: text('planned_arrival_time'),
    plannedDepartureTime: text('planned_departure_time'),
    dwellTimeSeconds: integer('dwell_time_seconds').default(60),
    pickupAllowed: boolean('pickup_allowed').default(true),
    dropoffAllowed: boolean('dropoff_allowed').default(true),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_route_stops_tenant').on(table.tenantId),
    index('idx_transport_route_stops_version').on(table.tenantId, table.versionId),
    unique('uq_transport_route_stop_seq').on(table.tenantId, table.versionId, table.stopSequence),
  ],
);

// 7. Crew Assignments
export const transportCrewAssignments = pgTable(
  'transport_crew_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    routeId: uuid('route_id').notNull(),
    vehicleId: uuid('vehicle_id'),
    driverEmployeeId: text('driver_employee_id').notNull(),
    attendantEmployeeId: text('attendant_employee_id'),
    effectiveStartDate: text('effective_start_date').notNull(),
    effectiveEndDate: text('effective_end_date'),
    recurringDays: jsonb('recurring_days'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_crew_tenant').on(table.tenantId),
    index('idx_transport_crew_route').on(table.tenantId, table.routeId),
    index('idx_transport_crew_driver').on(table.tenantId, table.driverEmployeeId),
  ],
);

// 8. Student Allocations
export const transportStudentAllocations = pgTable(
  'transport_student_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    studentId: text('student_id').notNull(),
    routeId: uuid('route_id').notNull(),
    pickupStopId: uuid('pickup_stop_id').notNull(),
    dropoffStopId: uuid('dropoff_stop_id').notNull(),
    direction: transportAllocationDirectionEnum('direction').notNull().default('both'),
    effectiveStartDate: text('effective_start_date').notNull(),
    effectiveEndDate: text('effective_end_date'),
    serviceDays: jsonb('service_days'),
    assistanceNotes: text('assistance_notes'),
    status: transportAllocationStatusEnum('status').notNull().default('active'),
    fareReferenceId: text('fare_reference_id'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_alloc_tenant').on(table.tenantId),
    index('idx_transport_alloc_student').on(table.tenantId, table.studentId),
    index('idx_transport_alloc_route').on(table.tenantId, table.routeId),
    unique('uq_transport_allocations_tenant_id').on(table.tenantId, table.id),
  ],
);

// 9. Trips
export const transportTrips = pgTable(
  'transport_trips',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    branchId: text('branch_id'),
    routeId: uuid('route_id').notNull(),
    routeVersionId: uuid('route_version_id').notNull(),
    serviceDate: text('service_date').notNull(),
    direction: transportRouteDirectionEnum('direction').notNull().default('pickup'),
    plannedStartTime: text('planned_start_time'),
    plannedEndTime: text('planned_end_time'),
    actualStartTime: text('actual_start_time'),
    actualEndTime: text('actual_end_time'),
    vehicleId: uuid('vehicle_id'),
    driverId: text('driver_id'),
    attendantId: text('attendant_id'),
    status: transportTripStatusEnum('status').notNull().default('scheduled'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_trips_tenant').on(table.tenantId),
    index('idx_transport_trips_date').on(table.tenantId, table.serviceDate),
    index('idx_transport_trips_route').on(table.tenantId, table.routeId),
    unique('uq_transport_trips_tenant_id').on(table.tenantId, table.id),
  ],
);

// 10. Trip Roster Snapshots
export const transportTripRosterSnapshots = pgTable(
  'transport_trip_roster_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    studentId: text('student_id').notNull(),
    pickupStopId: uuid('pickup_stop_id').notNull(),
    dropoffStopId: uuid('dropoff_stop_id').notNull(),
    direction: text('direction').notNull(),
    allocatedStatus: text('allocated_status').notNull().default('allocated'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_roster_tenant').on(table.tenantId),
    index('idx_transport_roster_trip').on(table.tenantId, table.tripId),
    unique('uq_transport_roster_trip_student').on(table.tenantId, table.tripId, table.studentId),
  ],
);

// 11. Rider Events
export const transportRiderEvents = pgTable(
  'transport_rider_events',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    studentId: text('student_id').notNull(),
    stopId: uuid('stop_id').notNull(),
    eventType: transportRiderEventTypeEnum('event_type').notNull(),
    verificationMethod: transportVerificationMethodEnum('verification_method')
      .notNull()
      .default('qr_scan'),
    eventTimestamp: timestamp('event_timestamp', { mode: 'string' }).defaultNow().notNull(),
    actorUserId: text('actor_user_id').notNull(),
    deviceId: text('device_id'),
    exceptionReason: text('exception_reason'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_rider_events_tenant').on(table.tenantId),
    index('idx_transport_rider_events_trip').on(table.tenantId, table.tripId),
    index('idx_transport_rider_events_student').on(table.tenantId, table.studentId),
    uniqueIndex('idx_transport_rider_events_idempotency').on(table.tenantId, table.idempotencyKey),
  ],
);

// 12. Incidents
export const transportIncidents = pgTable(
  'transport_incidents',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    tripId: uuid('trip_id'),
    vehicleId: uuid('vehicle_id'),
    driverId: text('driver_id'),
    incidentType: transportIncidentTypeEnum('incident_type').notNull(),
    severity: transportIncidentSeverityEnum('severity').notNull().default('medium'),
    status: transportIncidentStatusEnum('status').notNull().default('open'),
    reportedByUserId: text('reported_by_user_id').notNull(),
    assignedResponderUserId: text('assigned_responder_user_id'),
    title: text('title').notNull(),
    description: text('description'),
    resolutionSummary: text('resolution_summary'),
    safeguardingRedactedNotes: text('safeguarding_redacted_notes'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_incidents_tenant').on(table.tenantId),
    index('idx_transport_incidents_status').on(table.tenantId, table.status),
    unique('uq_transport_incidents_tenant_id').on(table.tenantId, table.id),
  ],
);

// 13. Incident Actions
export const transportIncidentActions = pgTable(
  'transport_incident_actions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    incidentId: uuid('incident_id').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    actionTaken: text('action_taken').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_inc_actions_tenant').on(table.tenantId),
    index('idx_transport_inc_actions_incident').on(table.tenantId, table.incidentId),
  ],
);

// 14. Fare Links
export const transportFareLinks = pgTable(
  'transport_fare_links',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    allocationId: uuid('allocation_id').notNull(),
    feeStructureId: text('fee_structure_id'),
    invoiceId: text('invoice_id'),
    chargeAmount: numeric('charge_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('MAD'),
    status: transportFareLinkStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_fare_links_tenant').on(table.tenantId),
    index('idx_transport_fare_links_alloc').on(table.tenantId, table.allocationId),
  ],
);

// 15. Policies
export const transportPolicies = pgTable(
  'transport_policies',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    maxCapacityMarginPercent: integer('max_capacity_margin_percent').default(0),
    requireSafeHandoffYoungerStudents: boolean('require_safe_handoff_younger_students').default(false),
    handoffAgeThresholdYears: integer('handoff_age_threshold_years').default(8),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_transport_policies_tenant').on(table.tenantId),
    unique('uq_transport_policies_tenant').on(table.tenantId),
  ],
);
