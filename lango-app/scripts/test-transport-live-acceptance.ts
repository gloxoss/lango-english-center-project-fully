import fs from 'fs';
import path from 'path';

// 1. Synchronously load environment variables before any DB module is imported
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

async function runLiveAcceptanceTests() {
  console.log('================================================================');
  console.log('      STUDENT TRANSPORT ADD-ON LIVE ACCEPTANCE TEST SUITE       ');
  console.log('================================================================\n');

  // Dynamic import to guarantee process.env.DATABASE_URL is set before DB initialization
  const { db } = await import('../src/libs/DB');
  const { TransportService } = await import('../src/features/transport/services/transport-service');
  const { user, tenants, addonEntitlements } = await import('../src/models/Schema');
  const {
    transportRiderEvents,
    transportTrips,
  } = await import('../src/features/transport/models/transport-schema');
  const { eq, and } = await import('drizzle-orm');
  const { requireAddon } = await import('../src/libs/api/entitlements');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  try {
    console.log('=== Step 1: Provisioning Test Tenants & Entitlements ===');
    const suffix = Date.now().toString().slice(-6);

    const [tenantA] = await db
      .insert(tenants)
      .values({
        name: `Transport Tenant A ${suffix}`,
        slug: `tenant-a-trans-${suffix}`,
      })
      .returning();

    const [tenantB] = await db
      .insert(tenants)
      .values({
        name: `Transport Tenant B ${suffix}`,
        slug: `tenant-b-trans-${suffix}`,
      })
      .returning();

    const [tenantDisabled] = await db
      .insert(tenants)
      .values({
        name: `Transport Tenant Disabled ${suffix}`,
        slug: `tenant-dis-trans-${suffix}`,
      })
      .returning();

    if (!tenantA || !tenantB || !tenantDisabled) {
      throw new Error('Failed to create test tenants');
    }

    // Grant transport entitlement to Tenant A and Tenant B
    await db.insert(addonEntitlements).values([
      { tenantId: tenantA.id, addonId: 'transport', isEnabled: true },
      { tenantId: tenantB.id, addonId: 'transport', isEnabled: true },
    ]);

    const TENANT_A = tenantA.id;
    const TENANT_B = tenantB.id;
    const TENANT_DISABLED = tenantDisabled.id;

    console.log(`Provisioned Tenant A (${TENANT_A}), Tenant B (${TENANT_B}), Tenant Disabled (${TENANT_DISABLED}).\n`);

    // -------------------------------------------------------------------------
    // TEST 1: Entitlement Gating Check
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Add-on Entitlement Gating ---');
    try {
      await requireAddon(TENANT_A, 'transport');
      assert(true, 'requireAddon passes for tenant with active transport entitlement');
    } catch (err: any) {
      assert(false, 'requireAddon failed for enabled tenant', err.message);
    }

    let disabledDenied = false;
    try {
      await requireAddon(TENANT_DISABLED, 'transport');
    } catch (err: any) {
      if (err.code === 'ADDON_NOT_ACTIVATED' || err.status === 403) {
        disabledDenied = true;
      }
    }
    assert(disabledDenied, 'requireAddon rejects tenant without active entitlement (ADDON_NOT_ACTIVATED 403)');

    // -------------------------------------------------------------------------
    // TEST 2: Two-Tenant Data Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Two-Tenant Isolation ---');
    const vehicleA = await TransportService.createVehicle(TENANT_A, {
      vehicleCode: `BUS-A-${suffix}`,
      registrationNumber: `11111-A-${suffix}`,
      capacity: 30,
      vehicleType: 'bus',
    });

    const vehicleB = await TransportService.createVehicle(TENANT_B, {
      vehicleCode: `BUS-B-${suffix}`,
      registrationNumber: `22222-B-${suffix}`,
      capacity: 25,
      vehicleType: 'minibus',
    });

    const listA = await TransportService.getVehicles(TENANT_A);
    const listB = await TransportService.getVehicles(TENANT_B);

    assert(
      listA.length === 1 && listA[0]!.id === vehicleA.id,
      'Tenant A only sees its own vehicle in list',
      `Expected 1 vehicle (${vehicleA.id}), got ${listA.length}`
    );

    assert(
      listB.length === 1 && listB[0]!.id === vehicleB.id,
      'Tenant B only sees its own vehicle in list',
      `Expected 1 vehicle (${vehicleB.id}), got ${listB.length}`
    );

    const vehicleBSeenByA = await TransportService.getVehicleById(TENANT_A, vehicleB.id);
    assert(
      vehicleBSeenByA === null,
      'Tenant A cannot fetch Tenant B vehicle by ID (Cross-tenant leak blocked)'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Capacity Race Condition under Concurrent Allocations
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Capacity Race Condition under Concurrency ---');

    // Create route, stops, and version for Tenant A
    const stop1 = await TransportService.createStop(TENANT_A, {
      stopCode: `STP1-${suffix}`,
      stopName: 'Campus Gate',
    });
    const stop2 = await TransportService.createStop(TENANT_A, {
      stopCode: `STP2-${suffix}`,
      stopName: 'Central Station',
    });

    const vehicleCap2 = await TransportService.createVehicle(TENANT_A, {
      vehicleCode: `CAP2-${suffix}`,
      registrationNumber: `99999-C-${suffix}`,
      capacity: 2, // Strict capacity limit = 2 seats
    });

    const route = await TransportService.createRoute(TENANT_A, {
      routeCode: `RT-CAP2-${suffix}`,
      routeName: 'Route Cap 2',
      assignedVehicleId: vehicleCap2.id,
      stops: [
        { stopId: stop1.id, stopSequence: 1, pickupAllowed: true },
        { stopId: stop2.id, stopSequence: 2, dropoffAllowed: true },
      ],
    });

    assert(route !== null && route !== undefined, 'Route created successfully');
    const activeVersionId = route!.activeVersionId!;

    // Create 5 dummy student accounts in Tenant A
    const studentIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const sId = `std_conc_${i}_${suffix}`;
      await db.insert(user).values({
        id: sId,
        tenantId: TENANT_A,
        email: `${sId}@school.test`,
        name: `Student Concurrency ${i}`,
        role: 'student',
      });
      studentIds.push(sId);
    }

    // Launch 5 parallel allocation requests concurrently
    console.log('  Launching 5 concurrent seat allocation requests for capacity=2 vehicle...');
    const allocationPromises = studentIds.map((sId) =>
      TransportService.allocateStudent(TENANT_A, {
        studentId: sId,
        routeId: route!.id,
        pickupStopId: stop1.id,
        dropoffStopId: stop2.id,
        direction: 'both',
        effectiveStartDate: '2026-01-01',
      })
        .then((res) => ({ success: true, res, code: undefined as string | undefined }))
        .catch((err) => ({ success: false, error: err.message, code: err.code as string | undefined }))
    );

    const allocationResults = await Promise.all(allocationPromises);
    const successfulAllocations = allocationResults.filter((r) => r.success);
    const failedAllocations = allocationResults.filter((r) => !r.success);

    assert(
      successfulAllocations.length === 2,
      'Exactly 2 allocations succeeded for capacity=2 vehicle',
      `Succeeded: ${successfulAllocations.length}, Failed: ${failedAllocations.length}`
    );

    assert(
      failedAllocations.length === 3 && failedAllocations.every((f) => f.code === 'CAPACITY_EXCEEDED'),
      'Remaining 3 allocation requests failed with CAPACITY_EXCEEDED',
      `Failures: ${JSON.stringify(failedAllocations)}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Rider Event Idempotency under Concurrency
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Rider Event Idempotency under Concurrency ---');

    const trip = await TransportService.generateTrip(TENANT_A, {
      routeId: route!.id,
      serviceDate: '2026-08-08',
      direction: 'pickup',
    });

    await TransportService.startTrip(TENANT_A, trip.id);

    const idempotencyKey = `IDEM-KEY-${suffix}`;
    const scanPayload = {
      tripId: trip.id,
      studentId: studentIds[0]!,
      stopId: stop1.id,
      eventType: 'boarded' as const,
      verificationMethod: 'qr_scan' as const,
      actorUserId: 'driver_01',
      idempotencyKey,
    };

    console.log('  Launching 5 parallel duplicate scan requests with identical idempotencyKey...');
    const scanPromises = Array.from({ length: 5 }).map(() =>
      TransportService.recordRiderEvent(TENANT_A, scanPayload)
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, res: undefined as any, error: err.message }))
    );

    const scanResults = await Promise.all(scanPromises);
    const successfulScans = scanResults.filter((r) => r.success);

    // Count records in DB
    const recordedEvents = await db
      .select()
      .from(transportRiderEvents)
      .where(
        and(
          eq(transportRiderEvents.tenantId, TENANT_A),
          eq(transportRiderEvents.idempotencyKey, idempotencyKey)
        )
      );

    assert(
      recordedEvents.length === 1,
      'Exactly 1 database event record exists for the idempotencyKey',
      `Found ${recordedEvents.length} DB records`
    );

    assert(
      successfulScans.length === 5 &&
        successfulScans.every((s) => s.res?.id === recordedEvents[0]!.id),
      'All 5 concurrent scan requests returned the identical event record',
      `Distinct returned event IDs: ${new Set(successfulScans.map((s) => s.res?.id)).size}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Concurrency-Safe Trip State Transitions
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Concurrency-Safe Trip State Transitions ---');

    // First transition trip to 'boarding' so scans/starts are valid under state machine
    await db
      .update(transportTrips)
      .set({ status: 'scheduled' })
      .where(eq(transportTrips.id, trip.id));

    console.log('  Launching 5 parallel startTrip requests on scheduled trip...');
    const startTripPromises = Array.from({ length: 5 }).map(() =>
      TransportService.startTrip(TENANT_A, trip.id)
        .then((res) => ({ success: true, res, code: undefined as string | undefined }))
        .catch((err) => ({ success: false, code: err.code as string | undefined, message: err.message }))
    );

    const startTripResults = await Promise.all(startTripPromises);
    const successfulStarts = startTripResults.filter((r) => r.success);
    const failedStarts = startTripResults.filter((r) => !r.success);

    assert(
      successfulStarts.length === 1,
      'Exactly 1 worker successfully started the trip',
      `Succeeded: ${successfulStarts.length}, Failed: ${failedStarts.length}`
    );

    assert(
      failedStarts.length === 4 && failedStarts.every((f) => f.code === 'INVALID_TRIP_STATE'),
      'Remaining 4 workers rejected with INVALID_TRIP_STATE',
      `Failures: ${JSON.stringify(failedStarts)}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: HR PII Protection Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing HR PII Protection ---');
    const driverUser = `driver_user_${suffix}`;
    await db.insert(user).values({
      id: driverUser,
      tenantId: TENANT_A,
      email: `${driverUser}@school.test`,
      name: 'John Driver',
      role: 'teacher',
    });

    const driversList = await TransportService.getDrivers(TENANT_A);
    const registeredDriver = driversList.find((d) => d.id === driverUser);

    assert(
      registeredDriver !== undefined,
      'Driver / staff profile retrieved successfully'
    );

    if (registeredDriver) {
      const keys = Object.keys(registeredDriver);
      const hasSalary = keys.includes('salary');
      const hasNationalId = keys.includes('nationalId');
      const hasBankRib = keys.includes('bankRib');

      assert(
        !hasSalary && !hasNationalId && !hasBankRib,
        'Driver payload strictly redacts HR PII (salary, nationalId, bankRib)',
        `Exposed keys: ${keys.filter((k) => ['salary', 'nationalId', 'bankRib'].includes(k)).join(', ')}`
      );
    }

    console.log('\n======================================================');
    console.log(`LIVE ACCEPTANCE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('======================================================');

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during acceptance test execution:', error);
    process.exit(1);
  }
}

runLiveAcceptanceTests();
