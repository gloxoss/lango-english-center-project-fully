import fs from 'fs';
import path from 'path';

// 1. Load environment variables before DB initialization
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

async function runHttpAdversarialTests() {
  console.log('================================================================');
  console.log('    STUDENT TRANSPORT ADD-ON AUTHENTICATED HTTP ADVERSARIAL    ');
  console.log('================================================================\n');

  // Dynamic import of DB & Auth
  const { db } = await import('../src/libs/DB');
  const { user, tenants, addonEntitlements } = await import('../src/models/Schema');
  const { auth } = await import('../src/libs/auth');
  const { randomUUID } = await import('crypto');

  // Route Handlers
  const { GET: GET_vehicles, POST: POST_vehicles } = await import('../src/app/api/transport/vehicles/route');
  const { GET: GET_vehicle_by_id } = await import('../src/app/api/transport/vehicles/[id]/route');
  const { POST: POST_stops } = await import('../src/app/api/transport/stops/route');
  const { POST: POST_routes } = await import('../src/app/api/transport/routes/route');
  const { POST: POST_rider_events } = await import('../src/app/api/transport/rider-events/route');
  const { GET: GET_incidents, POST: POST_incidents } = await import('../src/app/api/transport/incidents/route');
  const { PUT: PUT_allocation } = await import('../src/app/api/transport/allocations/[id]/route');
  const { TransportService } = await import('../src/features/transport/services/transport-service');

  // Mock Session for test requests
  const originalGetSession = auth.api.getSession;
  (auth.api as any).getSession = async ({ headers }: { headers: Headers }) => {
    const testUserId = headers.get('x-test-user-id');
    if (!testUserId) return null;
    return {
      user: { id: testUserId },
      session: { id: 'test-session-id' },
    };
  };

  const suffix = Date.now().toString().slice(-6);
  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  const TENANT_DISABLED = randomUUID();

  const ADMIN_A = `user_admin_a_${suffix}`;
  const RECEPTIONIST_A = `user_recep_a_${suffix}`;
  const ADMIN_B = `user_admin_b_${suffix}`;
  const ADMIN_DISABLED = `user_admin_dis_${suffix}`;

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
    }
  }

  function makeRequest(urlStr: string, options: { method?: string; userId?: string; body?: any }) {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (options.userId) {
      headers.set('x-test-user-id', options.userId);
    }
    return new Request(urlStr, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  // Provisioning
  await db.insert(tenants).values([
    { id: TENANT_A, name: 'Adversarial School A', slug: TENANT_A },
    { id: TENANT_B, name: 'Adversarial School B', slug: TENANT_B },
    { id: TENANT_DISABLED, name: 'Adversarial Disabled', slug: TENANT_DISABLED },
  ]);

  await db.insert(addonEntitlements).values([
    { tenantId: TENANT_A, addonId: 'transport', isEnabled: true },
    { tenantId: TENANT_B, addonId: 'transport', isEnabled: true },
  ]);

  await db.insert(user).values([
    { id: ADMIN_A, tenantId: TENANT_A, email: `admin_a_${suffix}@test.com`, name: 'Admin A', role: 'school_admin', userStatus: 'active' },
    { id: RECEPTIONIST_A, tenantId: TENANT_A, email: `recep_a_${suffix}@test.com`, name: 'Receptionist A', role: 'receptionist', userStatus: 'active' },
    { id: ADMIN_B, tenantId: TENANT_B, email: `admin_b_${suffix}@test.com`, name: 'Admin B', role: 'school_admin', userStatus: 'active' },
    { id: ADMIN_DISABLED, tenantId: TENANT_DISABLED, email: `admin_dis_${suffix}@test.com`, name: 'Admin Disabled', role: 'school_admin', userStatus: 'active' },
  ]);

  console.log('--- 1. Testing Un-entitled Add-on Access Rejection via HTTP Route ---');
  const reqUnentitled = makeRequest('http://localhost:3000/api/transport/vehicles', { userId: ADMIN_DISABLED });
  const resUnentitled = await GET_vehicles(reqUnentitled);
  const dataUnentitled = await resUnentitled.json();

  assert(
    resUnentitled.status === 403 && dataUnentitled.error?.code === 'ADDON_NOT_ACTIVATED',
    'Disabled tenant HTTP request blocked with 403 ADDON_NOT_ACTIVATED',
    `Status: ${resUnentitled.status}, Body: ${JSON.stringify(dataUnentitled)}`
  );

  console.log('\n--- 2. Testing Cross-Tenant Resource Access Isolation via HTTP ---');
  const reqCreateVehA = makeRequest('http://localhost:3000/api/transport/vehicles', {
    method: 'POST',
    userId: ADMIN_A,
    body: { vehicleCode: `BUS-ADV-A-${suffix}`, registrationNumber: `REG-A-${suffix}`, capacity: 20 },
  });
  const resCreateVehA = await POST_vehicles(reqCreateVehA);
  const vehA = (await resCreateVehA.json()).data;

  const reqCreateVehB = makeRequest('http://localhost:3000/api/transport/vehicles', {
    method: 'POST',
    userId: ADMIN_B,
    body: { vehicleCode: `BUS-ADV-B-${suffix}`, registrationNumber: `REG-B-${suffix}`, capacity: 25 },
  });
  const resCreateVehB = await POST_vehicles(reqCreateVehB);
  const vehB = (await resCreateVehB.json()).data;

  const reqGetOtherVeh = makeRequest(`http://localhost:3000/api/transport/vehicles/${vehB.id}`, { userId: ADMIN_A });
  const resGetOtherVeh = await GET_vehicle_by_id(reqGetOtherVeh, { params: Promise.resolve({ id: vehB.id }) });
  const dataOtherVeh = await resGetOtherVeh.json();

  assert(
    resGetOtherVeh.status === 404,
    'Tenant A HTTP request for Tenant B vehicle returns 404 NOT_FOUND',
    `Status: ${resGetOtherVeh.status}, Body: ${JSON.stringify(dataOtherVeh)}`
  );

  console.log('\n--- 3. Testing Negative Capacity Rejection via HTTP ---');
  const reqNegCap = makeRequest('http://localhost:3000/api/transport/vehicles', {
    method: 'POST',
    userId: ADMIN_A,
    body: { vehicleCode: `BUS-NEG-${suffix}`, registrationNumber: `REG-NEG-${suffix}`, capacity: -5 },
  });
  const resNegCap = await POST_vehicles(reqNegCap);
  const dataNegCap = await resNegCap.json();

  assert(
    (resNegCap.status === 400 || resNegCap.status === 422) && (dataNegCap.error?.code === 'INVALID_CAPACITY' || dataNegCap.error?.code === 'VALIDATION_ERROR'),
    'Negative capacity vehicle creation rejected via HTTP (400/422 invalid capacity)',
    `Status: ${resNegCap.status}, Code: ${dataNegCap.error?.code}`
  );

  console.log('\n--- 4. Testing Invalid Geofence Radius Rejection via HTTP ---');
  const reqNegGeo = makeRequest('http://localhost:3000/api/transport/stops', {
    method: 'POST',
    userId: ADMIN_A,
    body: { stopCode: `STP-NEG-${suffix}`, stopName: 'Bad Stop', geofenceRadiusMeters: -10 },
  });
  const resNegGeo = await POST_stops(reqNegGeo);
  const dataNegGeo = await resNegGeo.json();

  assert(
    (resNegGeo.status === 400 || resNegGeo.status === 422) && (dataNegGeo.error?.code === 'INVALID_GEOFENCE' || dataNegGeo.error?.code === 'VALIDATION_ERROR'),
    'Negative geofence radius stop creation rejected via HTTP (400/422 invalid geofence)',
    `Status: ${resNegGeo.status}, Code: ${dataNegGeo.error?.code}`
  );

  console.log('\n--- 5. Testing Route Single-Stop Creation Rejection via HTTP ---');
  const reqSingleStop = makeRequest('http://localhost:3000/api/transport/routes', {
    method: 'POST',
    userId: ADMIN_A,
    body: {
      routeCode: `RT-SINGLE-${suffix}`,
      routeName: 'Single Stop Route',
      stops: [{ stopId: randomUUID(), stopSequence: 1 }],
    },
  });
  const resSingleStop = await POST_routes(reqSingleStop);
  const dataSingleStop = await resSingleStop.json();

  assert(
    (resSingleStop.status === 400 || resSingleStop.status === 422) && (dataSingleStop.error?.code === 'INVALID_ROUTE_STOPS' || dataSingleStop.error?.code === 'VALIDATION_ERROR'),
    'Single-stop route creation rejected via HTTP (400/422 invalid route stops)',
    `Status: ${resSingleStop.status}, Code: ${dataSingleStop.error?.code}`
  );

  console.log('\n--- 6. Testing Safeguarding Redacted Notes via HTTP ---');
  const reqInc = makeRequest('http://localhost:3000/api/transport/incidents', {
    method: 'POST',
    userId: ADMIN_A,
    body: {
      incidentType: 'safeguarding',
      severity: 'critical',
      title: 'Safeguarding Test Incident',
      safeguardingRedactedNotes: 'CONFIDENTIAL: Sensitive details',
    },
  });
  const resInc = await POST_incidents(reqInc);
  const resIncBody = await resInc.json();
  const incData = resIncBody.data;

  assert(
    resInc.status === 201 && Boolean(incData?.id),
    'Safeguarding incident created by admin (201)',
    `Status: ${resInc.status}, Body: ${JSON.stringify(resIncBody)}`
  );

  const reqRecepInc = makeRequest('http://localhost:3000/api/transport/incidents', { userId: RECEPTIONIST_A });
  const resRecepInc = await GET_incidents(reqRecepInc);
  const recepIncBody = await resRecepInc.json();
  const recepIncList = recepIncBody.data;
  const recepInc = Array.isArray(recepIncList) ? recepIncList.find((i: any) => i.id === incData?.id) : null;

  assert(
    Boolean(recepInc && recepInc.safeguardingRedactedNotes === undefined),
    'Safeguarding redacted notes stripped from receptionist HTTP incident response',
    `Recep status: ${resRecepInc.status}, Found: ${Boolean(recepInc)}, Notes: ${recepInc?.safeguardingRedactedNotes}`
  );

  const reqAdminInc = makeRequest('http://localhost:3000/api/transport/incidents', { userId: ADMIN_A });
  const resAdminInc = await GET_incidents(reqAdminInc);
  const adminIncList = (await resAdminInc.json()).data;
  const adminInc = Array.isArray(adminIncList) ? adminIncList.find((i: any) => i.id === incData?.id) : null;

  assert(
    Boolean(adminInc && adminInc.safeguardingRedactedNotes === 'CONFIDENTIAL: Sensitive details'),
    'Safeguarding notes preserved for school_admin role in HTTP response'
  );

  console.log('\n--- 7. Testing Allocation Update Invariant Re-evaluation via PUT HTTP Route ---');
  // Create small vehicle capacity = 1, route, 2 stops
  const stp1 = await TransportService.createStop(TENANT_A, { stopCode: `S1-${suffix}`, stopName: 'Stop 1' });
  const stp2 = await TransportService.createStop(TENANT_A, { stopCode: `S2-${suffix}`, stopName: 'Stop 2' });
  const veh1 = await TransportService.createVehicle(TENANT_A, { vehicleCode: `V1-${suffix}`, registrationNumber: `REG-1-${suffix}`, capacity: 1 });
  const routeCap1 = await TransportService.createRoute(TENANT_A, {
    routeCode: `RT1-${suffix}`,
    routeName: 'Cap 1 Route',
    assignedVehicleId: veh1.id,
    stops: [
      { stopId: stp1.id, stopSequence: 1, pickupAllowed: true },
      { stopId: stp2.id, stopSequence: 2, dropoffAllowed: true },
    ],
  });

  const std1 = `std_inv_1_${suffix}`;
  const std2 = `std_inv_2_${suffix}`;
  await db.insert(user).values([
    { id: std1, tenantId: TENANT_A, email: `${std1}@test.com`, name: 'Student 1', role: 'student', userStatus: 'active' },
    { id: std2, tenantId: TENANT_A, email: `${std2}@test.com`, name: 'Student 2', role: 'student', userStatus: 'active' },
  ]);

  // Allocation 1 active (takes seat 1/1)
  const alloc1 = await TransportService.allocateStudent(TENANT_A, {
    studentId: std1,
    routeId: routeCap1.id,
    pickupStopId: stp1.id,
    dropoffStopId: stp2.id,
    direction: 'both',
    effectiveStartDate: '2026-01-01',
  });

  // Allocation 2 waitlisted
  const alloc2 = await TransportService.allocateStudent(TENANT_A, {
    studentId: std2,
    routeId: routeCap1.id,
    pickupStopId: stp1.id,
    dropoffStopId: stp2.id,
    direction: 'both',
    status: 'waitlisted',
    effectiveStartDate: '2026-01-01',
  });

  // Try to reactivate Allocation 2 via PUT /api/transport/allocations/[id]
  const reqReactivate = makeRequest(`http://localhost:3000/api/transport/allocations/${alloc2.id}`, {
    method: 'PUT',
    userId: ADMIN_A,
    body: { status: 'active' },
  });
  const resReactivate = await PUT_allocation(reqReactivate, { params: Promise.resolve({ id: alloc2.id }) });
  const dataReactivate = await resReactivate.json();

  assert(
    resReactivate.status === 409 && dataReactivate.error?.code === 'CAPACITY_EXCEEDED',
    'PUT /api/transport/allocations/[id] reactivation rejected with 409 CAPACITY_EXCEEDED when capacity full',
    `Status: ${resReactivate.status}, Code: ${dataReactivate.error?.code}`
  );

  console.log('\n--- 8. Testing Idempotency Key Reuse Payload Mismatch Rejection via HTTP ---');
  // Create trip and start it
  const trip = await TransportService.generateTrip(TENANT_A, { routeId: routeCap1.id, serviceDate: '2026-08-08', direction: 'pickup' });
  await TransportService.startTrip(TENANT_A, trip.id);

  const idemKey = `KEY-MISMATCH-${suffix}`;
  const reqScan1 = makeRequest('http://localhost:3000/api/transport/rider-events', {
    method: 'POST',
    userId: ADMIN_A,
    body: {
      tripId: trip.id,
      studentId: std1,
      stopId: stp1.id,
      eventType: 'boarded',
      idempotencyKey: idemKey,
    },
  });
  const resScan1 = await POST_rider_events(reqScan1);
  const dataScan1 = await resScan1.json();
  assert(resScan1.status === 200 || resScan1.status === 201, 'Initial scan with idempotency key succeeded (200/201)', `Status: ${resScan1.status}, Body: ${JSON.stringify(dataScan1)}`);

  // Retry with same idempotencyKey but DIFFERENT studentId
  const reqScan2 = makeRequest('http://localhost:3000/api/transport/rider-events', {
    method: 'POST',
    userId: ADMIN_A,
    body: {
      tripId: trip.id,
      studentId: std2, // DIFFERENT STUDENT ID
      stopId: stp1.id,
      eventType: 'boarded',
      idempotencyKey: idemKey,
    },
  });
  const resScan2 = await POST_rider_events(reqScan2);
  const dataScan2 = await resScan2.json();

  assert(
    resScan2.status === 409 && dataScan2.error?.code === 'IDEMPOTENCY_KEY_REUSED',
    'Reusing idempotency key with mismatched payload rejected with 409 IDEMPOTENCY_KEY_REUSED',
    `Status: ${resScan2.status}, Code: ${dataScan2.error?.code}`
  );

  console.log('\n--- 9. Testing Operational Rider Event Stop Validation via HTTP ---');
  const invalidStopId = randomUUID();
  const reqInvalidStopScan = makeRequest('http://localhost:3000/api/transport/rider-events', {
    method: 'POST',
    userId: ADMIN_A,
    body: {
      tripId: trip.id,
      studentId: std1,
      stopId: invalidStopId,
      eventType: 'boarded',
      idempotencyKey: `KEY-INVALID-STOP-${suffix}`,
    },
  });
  const resInvalidStopScan = await POST_rider_events(reqInvalidStopScan);
  const dataInvalidStopScan = await resInvalidStopScan.json();

  assert(
    resInvalidStopScan.status === 400 && dataInvalidStopScan.error?.code === 'STOP_NOT_IN_ROUTE',
    'Scanning rider event at non-route stop rejected with 400 STOP_NOT_IN_ROUTE',
    `Status: ${resInvalidStopScan.status}, Code: ${dataInvalidStopScan.error?.code}`
  );

  // Restore original getSession
  (auth.api as any).getSession = originalGetSession;

  console.log('\n======================================================');
  console.log(`HTTP ADVERSARIAL SUITE SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runHttpAdversarialTests();
