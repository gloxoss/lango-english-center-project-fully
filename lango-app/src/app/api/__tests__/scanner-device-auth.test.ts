import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as verifyAndStage } from '@/app/api/attendance/qr/verify-and-stage/route';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { authenticateDevice } from '@/libs/attendance/device-auth';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceScanEvents,
  branches,
  classes,
  classSections,
  identityBadgeCredentials,
  mediums,
  scannerDevices,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// Phase 7: a paired terminal is an identity. Before this, `secret_key` was
// stored in plain text and never read — no scan route authenticated a device, so
// any operator could scan as any terminal, for any campus.

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const OTHER_TENANT = crypto.randomUUID();
const ADMIN = `DEV-ADMIN-${suffix}`;

const GOOD_SECRET = `dev-good-${crypto.randomUUID()}`;
const REVOKED_SECRET = `dev-revoked-${crypto.randomUUID()}`;
const DISABLED_SECRET = `dev-disabled-${crypto.randomUUID()}`;
const UNKNOWN_SECRET = `dev-unknown-${crypto.randomUUID()}`;
const STUDENT_B = crypto.randomUUID();
const TOKEN_B = `tok-b-${crypto.randomUUID()}`;

let branchA = '';
let branchB = '';
let sectionA = '';
let sectionB = '';

async function asAdmin(branchId: string | null = null) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: ADMIN, tenantId, role: 'school_admin', branchId,
  } as never);
}

describe.skipIf(!dbReachable)('scanner device identity — DB-backed', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-06T06:30:00.000Z'));

    await db.insert(tenants).values([
      { id: tenantId, name: `Dev ${suffix}`, slug: `dev-${suffix}` },
      { id: OTHER_TENANT, name: `DevOther ${suffix}`, slug: `devother-${suffix}` },
    ]);

    const branchRows = await db.insert(branches).values([
      { tenantId, name: `DA-${suffix}`, code: `DA-${suffix}` },
      { tenantId, name: `DB-${suffix}`, code: `DB-${suffix}` },
    ]).returning();

    branchA = branchRows[0]!.id;
    branchB = branchRows[1]!.id;

    await db.insert(user).values({ id: ADMIN, tenantId, branchId: branchA, name: 'Dev Admin', email: `dev-${suffix}@t.local`, role: 'school_admin' });

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const classRows = await db.insert(classes).values([
      { tenantId, branchId: branchA, name: `CA-${suffix}`, mediumId: medium!.id },
      { tenantId, branchId: branchB, name: `CB-${suffix}`, mediumId: medium!.id },
    ]).returning();
    const labelRows = await db.insert(sections).values([
      { tenantId, name: `SA-${suffix}` },
      { tenantId, name: `SB-${suffix}` },
    ]).returning();
    const sectionRows = await db.insert(classSections).values([
      { tenantId, classId: classRows[0]!.id, sectionId: labelRows[0]!.id, mediumId: medium!.id, maxStudents: 30 },
      { tenantId, classId: classRows[1]!.id, sectionId: labelRows[1]!.id, mediumId: medium!.id, maxStudents: 30 },
    ]).returning();

    sectionA = sectionRows[0]!.id;
    sectionB = sectionRows[1]!.id;

    await db.insert(scannerDevices).values([
      { tenantId, deviceLabel: 'Kiosk OK', branchId: branchA, status: 'active', isDisabled: false, secretHash: computeHmacHash(GOOD_SECRET), secretPrefix: GOOD_SECRET.slice(0, 12) },
      { tenantId, deviceLabel: 'Kiosk Revoked', branchId: branchA, status: 'revoked', isDisabled: true, secretHash: computeHmacHash(REVOKED_SECRET), secretPrefix: REVOKED_SECRET.slice(0, 12) },
      { tenantId, deviceLabel: 'Kiosk Disabled', branchId: branchA, status: 'disabled', isDisabled: true, secretHash: computeHmacHash(DISABLED_SECRET), secretPrefix: DISABLED_SECRET.slice(0, 12) },
    ]);

    await db.insert(user).values({ id: STUDENT_B, tenantId, branchId: branchB, name: 'Student B', email: `sb-${suffix}@t.local`, role: 'student', classSectionId: sectionB });
    await db.insert(identityBadgeCredentials).values({ tenantId, userId: STUDENT_B, tokenHash: computeHmacHash(TOKEN_B), status: 'active' });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, tenantId));
    await db.delete(scannerDevices).where(eq(scannerDevices.tenantId, tenantId));
    await db.delete(identityBadgeCredentials).where(eq(identityBadgeCredentials.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, OTHER_TENANT));
  });

  it('D7.1: a valid secret identifies the device and records a heartbeat', async () => {
    const before = await db.select({ lastSeenAt: scannerDevices.lastSeenAt }).from(scannerDevices).where(eq(scannerDevices.secretHash, computeHmacHash(GOOD_SECRET)));

    const device = await authenticateDevice(tenantId, GOOD_SECRET);

    expect(device.label).toBe('Kiosk OK');
    expect(device.branchId).toBe(branchA);

    const after = await db.select({ lastSeenAt: scannerDevices.lastSeenAt }).from(scannerDevices).where(eq(scannerDevices.secretHash, computeHmacHash(GOOD_SECRET)));

    // last_seen_at was decorative because nothing ever reported in.
    expect(before[0]!.lastSeenAt).toBeNull();
    expect(after[0]!.lastSeenAt).not.toBeNull();
  });

  it('D7.2: an unrecognised secret is refused', async () => {
    await expect(authenticateDevice(tenantId, UNKNOWN_SECRET)).rejects.toMatchObject({ code: 'DEVICE_NOT_RECOGNISED' });
  });

  it('D7.3: a secret from another tenant is refused', async () => {
    await expect(authenticateDevice(OTHER_TENANT, GOOD_SECRET)).rejects.toMatchObject({ code: 'DEVICE_NOT_RECOGNISED' });
  });

  it('D7.4: a revoked device is refused', async () => {
    await expect(authenticateDevice(tenantId, REVOKED_SECRET)).rejects.toMatchObject({ code: 'DEVICE_REVOKED' });
  });

  it('D7.5: a disabled device is refused', async () => {
    await expect(authenticateDevice(tenantId, DISABLED_SECRET)).rejects.toMatchObject({ code: 'DEVICE_DISABLED' });
  });

  it('D7.6: a device is refused before its branch is trusted — no scan from the wrong campus', async () => {
    // The device lives on campus A. Scanning for a campus-B section must be
    // refused on the DEVICE's branch, even though the caller is tenant-wide and
    // would otherwise be allowed.
    await asAdmin(null);

    const res = await verifyAndStage(new Request('http://x/api/attendance/qr/verify-and-stage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // A REAL badge, so the request reaches the branch gate instead of failing
      // on the credential first.
      body: JSON.stringify({ rawToken: TOKEN_B, classSectionId: sectionB, deviceSecret: GOOD_SECRET }),
    }));

    // Rejected at the branch gate, not accepted-and-then-failed.
    expect(res.status).toBe(403);
    expect((await res.json() as any).error.code).toBe('FORBIDDEN');
  });

  it('D7.7: a bad device secret fails the scan before the credential is even read', async () => {
    await asAdmin(null);

    const res = await verifyAndStage(new Request('http://x/api/attendance/qr/verify-and-stage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rawToken: 'nope', classSectionId: sectionA, deviceSecret: UNKNOWN_SECRET }),
    }));

    expect(res.status).toBe(401);
    expect((await res.json() as any).error.code).toBe('DEVICE_NOT_RECOGNISED');
  });

  it('D7.8: no secret still works for a logged-in operator in the browser', async () => {
    // The operator path is unchanged: this phase adds a device identity, it does
    // not make the browser scanner unusable.
    await asAdmin(branchA);

    const res = await verifyAndStage(new Request('http://x/api/attendance/qr/verify-and-stage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rawToken: 'nope', classSectionId: sectionA }),
    }));

    // Reaches credential resolution rather than being refused for device reasons.
    expect([404, 422]).toContain(res.status);
  });
});
