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

async function runAdversarialTests() {
  console.log('================================================================');
  console.log('    STUDENT TRANSPORT ADD-ON AUTHENTICATED ADVERSARIAL SUITE    ');
  console.log('================================================================\n');

  const { db } = await import('../src/libs/DB');
  const { TransportService } = await import('../src/features/transport/services/transport-service');
  const { user, tenants, addonEntitlements } = await import('../src/models/Schema');
  const { transportVehicles, transportRoutes, transportStops } = await import('../src/features/transport/models/transport-schema');
  const { eq, and } = await import('drizzle-orm');
  const { requireAddon } = await import('../src/libs/api/entitlements');

  const { randomUUID } = await import('crypto');
  const suffix = Date.now().toString().slice(-6);
  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  const TENANT_DISABLED = randomUUID();

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

  // Provisioning
  await db.insert(tenants).values({ id: TENANT_A, name: 'Adversarial School A', slug: TENANT_A });
  await db.insert(tenants).values({ id: TENANT_B, name: 'Adversarial School B', slug: TENANT_B });
  await db.insert(tenants).values({ id: TENANT_DISABLED, name: 'Adversarial Disabled', slug: TENANT_DISABLED });

  await db.insert(addonEntitlements).values({ tenantId: TENANT_A, addonId: 'transport', isEnabled: true });
  await db.insert(addonEntitlements).values({ tenantId: TENANT_B, addonId: 'transport', isEnabled: true });

  console.log('--- 1. Testing Un-entitled Add-on Access Rejection ---');
  let entitlementError: any = null;
  try {
    await requireAddon(TENANT_DISABLED, 'transport');
  } catch (err: any) {
    entitlementError = err;
  }
  assert(
    entitlementError && entitlementError.code === 'ADDON_NOT_ACTIVATED',
    'Disabled tenant blocked with ADDON_NOT_ACTIVATED error'
  );

  console.log('\n--- 2. Testing Cross-Tenant Resource Access Security ---');
  const vehA = await TransportService.createVehicle(TENANT_A, {
    vehicleCode: `BUS-ADV-A-${suffix}`,
    registrationNumber: `REG-ADV-A-${suffix}`,
    capacity: 20,
  });

  const vehB = await TransportService.createVehicle(TENANT_B, {
    vehicleCode: `BUS-ADV-B-${suffix}`,
    registrationNumber: `REG-ADV-B-${suffix}`,
    capacity: 25,
  });

  const fetchedByOtherTenant = await TransportService.getVehicleById(TENANT_A, vehB.id);
  assert(
    fetchedByOtherTenant === null,
    'Tenant A cannot read Tenant B vehicle by ID (Cross-tenant leak prevented)'
  );

  console.log('\n--- 3. Testing Negative Capacity Rejection ---');
  let capError: any = null;
  try {
    await TransportService.createVehicle(TENANT_A, {
      vehicleCode: `BUS-NEG-${suffix}`,
      registrationNumber: `REG-NEG-${suffix}`,
      capacity: -5,
    });
  } catch (err: any) {
    capError = err;
  }
  assert(
    capError && (capError.code === 'INVALID_CAPACITY' || capError.status === 400),
    'Negative capacity vehicle creation rejected'
  );

  console.log('\n--- 4. Testing Invalid Geofence Radius Rejection ---');
  let geoError: any = null;
  try {
    await TransportService.createStop(TENANT_A, {
      stopCode: `STP-NEG-${suffix}`,
      stopName: 'Invalid Geofence Stop',
      geofenceRadiusMeters: -10,
    });
  } catch (err: any) {
    geoError = err;
  }
  assert(
    geoError && (geoError.code === 'INVALID_GEOFENCE' || geoError.status === 400),
    'Negative geofence radius stop creation rejected'
  );

  console.log('\n--- 5. Testing Route Single-Stop Creation Rejection ---');
  const stopSingle = await TransportService.createStop(TENANT_A, {
    stopCode: `STP-S1-${suffix}`,
    stopName: 'Single Stop',
  });

  let singleStopError: any = null;
  try {
    await TransportService.createRoute(TENANT_A, {
      routeCode: `RT-SINGLE-${suffix}`,
      routeName: 'Single Stop Route',
      stops: [{ stopId: stopSingle.id, stopSequence: 1 }],
    });
  } catch (err: any) {
    singleStopError = err;
  }
  assert(
    singleStopError && (singleStopError.code === 'INVALID_ROUTE_STOPS' || singleStopError.status === 400),
    'Route creation with < 2 stops rejected'
  );

  console.log('\n--- 6. Testing Safeguarding Notes Protection ---');
  const inc = await TransportService.createIncident(TENANT_A, {
    incidentType: 'safeguarding',
    severity: 'critical',
    reportedByUserId: 'user_01',
    title: 'Safeguarding Test Incident',
    safeguardingRedactedNotes: 'CONFIDENTIAL: Sensitive student details',
  });

  const incidentsForTeacher = await TransportService.getIncidents(TENANT_A, 'teacher');
  const teacherInc = incidentsForTeacher.find(i => i.id === inc.id);
  assert(
    Boolean(teacherInc && (teacherInc as any).safeguardingRedactedNotes === undefined),
    'Safeguarding redacted notes stripped from teacher incident response'
  );

  const incidentsForAdmin = await TransportService.getIncidents(TENANT_A, 'school_admin');
  const adminInc = incidentsForAdmin.find(i => i.id === inc.id);
  assert(
    Boolean(adminInc && (adminInc as any).safeguardingRedactedNotes === 'CONFIDENTIAL: Sensitive student details'),
    'Safeguarding notes preserved for school_admin role'
  );

  console.log('\n======================================================');
  console.log(`ADVERSARIAL SUITE SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('======================================================\n');
}

runAdversarialTests();
