# Student Transport Add-on — Manual & Automated Verification Guide

This document outlines manual testing procedures, cURL commands, and automated test suite execution steps for verifying the production-ready **Student Transport Add-on** (`transport`) in Lango / SchoolOS.

---

## 1. Prerequisites & Database Setup

### Step 1.1: Apply Migration 0082
Execute the transport migration script to create all 15 transport tables, 13 PostgreSQL enums, foreign keys, and unique indexes:

```bash
npx --prefix lango-english-center-project-fully/lango-app tsx lango-english-center-project-fully/lango-app/scripts/migrate-0082-transport.ts
```

### Step 1.2: Verify Database Schema
Verify that all 15 transport tables, 13 enums, and the unique idempotency index `idx_transport_rider_events_idempotency` exist in live PostgreSQL:

```bash
npx --prefix lango-english-center-project-fully/lango-app tsx lango-english-center-project-fully/lango-app/scripts/check-0082-transport-migration.ts
```

*Expected Output:*
```
======================================================
SUCCESS: All 15 transport tables, 13 enums, and idempotency unique index verified!
======================================================
```

---

## 2. Automated Live Acceptance Test Suite

Run the full end-to-end acceptance & concurrency test harness:

```bash
npx --prefix lango-english-center-project-fully/lango-app tsx --tsconfig lango-english-center-project-fully/lango-app/tsconfig.json lango-english-center-project-fully/lango-app/scripts/test-transport-live-acceptance.ts
```

### Verifications Performed by Test Harness (13/13 Passing):
1. **Add-on Entitlement Gating**: Verifies `requireAddon(tenantId, 'transport')` passes for active grants and rejects disabled/un-entitled tenants (`403 ADDON_NOT_ACTIVATED`).
2. **Two-Tenant Isolation**: Proves Tenant A cannot list or read Tenant B vehicles, routes, or rider events.
3. **Concurrent Capacity Enforcement**: Fires 5 parallel seat allocation requests against a vehicle with capacity = 2. Verifies exactly 2 allocations succeed and 3 fail with `409 CAPACITY_EXCEEDED` via PostgreSQL `.for('update')` row-level locks.
4. **Rider Event Idempotency**: Fires 5 parallel QR scan events with identical `idempotencyKey`. Verifies exactly 1 DB record is created and all 5 requests return the identical event record.
5. **State Machine Trip Transitions**: Fires 5 parallel `startTrip` calls on a scheduled trip. Verifies exactly 1 worker transitions trip to `in_progress` and 4 workers receive `400 INVALID_TRIP_STATE`.
6. **HR PII Protection**: Verifies driver profile responses redact `salary`, `nationalId`, and `bankRib`.

---

## 3. Manual Testing API Endpoints Overview

All endpoints require valid authentication context with `tenantId` and entitlement for `transport`.

### 3.1 Vehicles Management (`/api/transport/vehicles`)
- **GET `/api/transport/vehicles`**: List vehicles for tenant.
- **POST `/api/transport/vehicles`**: Create new vehicle.
  ```json
  {
    "vehicleCode": "BUS-101",
    "registrationNumber": "12345-A-6",
    "capacity": 30,
    "vehicleType": "bus",
    "status": "active"
  }
  ```
- **GET `/api/transport/vehicles/[id]`**: Get vehicle details.
- **PUT `/api/transport/vehicles/[id]`**: Update vehicle.
- **DELETE `/api/transport/vehicles/[id]`**: Delete vehicle.

### 3.2 Stops & Geofences (`/api/transport/stops`)
- **GET `/api/transport/stops`**: List stops.
- **POST `/api/transport/stops`**: Create stop with GPS coordinates & geofence.
  ```json
  {
    "stopCode": "STP-01",
    "stopName": "Central Gate",
    "address": "123 Main Street",
    "latitude": 33.5731,
    "longitude": -7.5898,
    "geofenceRadiusMeters": 50
  }
  ```

### 3.3 Routes & Versions (`/api/transport/routes`)
- **POST `/api/transport/routes`**: Create route with ordered stops.
  ```json
  {
    "routeCode": "RT-NORTH",
    "routeName": "North Campus Route",
    "serviceDirection": "bidirectional",
    "stops": [
      { "stopId": "<STOP_ID_1>", "stopSequence": 1, "pickupAllowed": true },
      { "stopId": "<STOP_ID_2>", "stopSequence": 2, "dropoffAllowed": true }
    ]
  }
  ```

### 3.4 Student Seat Allocation (`/api/transport/allocations`)
- **POST `/api/transport/allocations`**: Allocate student to route.
  ```json
  {
    "studentId": "<STUDENT_USER_ID>",
    "routeId": "<ROUTE_ID>",
    "pickupStopId": "<STOP_ID_1>",
    "dropoffStopId": "<STOP_ID_2>",
    "direction": "both",
    "effectiveStartDate": "2026-08-08"
  }
  ```

### 3.5 Trip Operations & Roster (`/api/transport/trips`)
- **POST `/api/transport/trips/generate`**: Generate trip and snapshot passenger roster.
- **POST `/api/transport/trips/[id]/start`**: Start trip (`scheduled` -> `in_progress`).
- **POST `/api/transport/trips/[id]/complete`**: Complete trip (`in_progress` -> `completed`).
- **GET `/api/transport/trips/[id]/roster`**: Fetch trip roster.

### 3.6 Rider Scans & Evidence (`/api/transport/rider-events`)
- **POST `/api/transport/rider-events`**: Record student boarding/alighting scan.
  ```json
  {
    "tripId": "<TRIP_ID>",
    "studentId": "<STUDENT_USER_ID>",
    "stopId": "<STOP_ID>",
    "eventType": "boarded",
    "verificationMethod": "qr_scan",
    "idempotencyKey": "SCAN-REQ-98765"
  }
  ```

### 3.7 Incidents & Safeguarding (`/api/transport/incidents`)
- **POST `/api/transport/incidents`**: Report incident.
- **GET `/api/transport/incidents`**: List incidents (non-safeguarding staff receive redacted notes).

---

## 4. UI Testing Guide

1. Navigate to `/dashboard/transport/vehicles` in browser.
2. Verify vehicle list renders cleanly with capacity, status badges, and inspection dates.
3. Add a new vehicle using modal form and confirm instant table update.
4. Verify edit and delete operations execute with immediate state refresh.
