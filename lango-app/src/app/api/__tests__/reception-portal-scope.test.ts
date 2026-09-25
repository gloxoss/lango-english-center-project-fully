import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Reception-portal scope regression suite (AUD-RECEPTION-01).
//
// Covers:
//   - receptionists can read the student directory (nav promised it) with a
//     least-privilege projection (no finance, no identity papers, no academic
//     history), and roles outside the allowlist stay out;
//   - the shared host picker opens for visitor.manage alone (not only
//     appointment.manage);
//   - the reception home counts are branch-scoped and use the school day;
//   - approved-template notifications go through the provider-aware path and
//     never fabricate a 'sent' status without provider evidence.

let currentSessionUserId: string | null = null;

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { guardVisits } = await import('@/features/guard/models/guard-schema');
const { smsMessages, tenants, user, userPermissionOverrides } = await import('@/models/Schema');
const studentsRoute = await import('@/app/api/students/route');
const staffRoute = await import('@/app/api/reception/staff/route');
const { sendApprovedNotification } = await import('@/features/reception/services/notifications-service');
const { getReceptionHome } = await import('@/features/reception/services/home-service');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('reception portal scope', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);

  const receptionistId = `USR-RPS-REC-${suffix}`;
  const parentId = `USR-RPS-PAR-${suffix}`;
  const studentId = `USR-RPS-STU-${suffix}`;
  const otherTenantStudentId = `USR-RPS-STU-OTHER-${suffix}`;

  const branchA = crypto.randomUUID();
  const branchB = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Reception Scope Test', slug: `rps-${suffix}` },
      { id: otherTenantId, name: 'Reception Scope Other', slug: `rps-o-${suffix}` },
    ]);

    await db.insert(user).values([
      { id: receptionistId, tenantId, name: 'Front Desk', email: `rps-rec-${suffix}@t.local`, role: 'receptionist', userStatus: 'active' },
      { id: parentId, tenantId, name: 'A Parent', email: `rps-par-${suffix}@t.local`, role: 'parent', userStatus: 'active' },
      {
        id: studentId,
        tenantId,
        branchId: branchA,
        name: 'Directory Student',
        email: `rps-stu-${suffix}@t.local`,
        role: 'student',
        userStatus: 'active',
        nationalId: `MASSAR-${suffix}`,
        bloodGroup: 'O+',
        address: '1 rue Test',
        guardianName: 'Guardian Name',
        guardianPhone: '+212600000000',
      },
      { id: otherTenantStudentId, tenantId: otherTenantId, name: 'Other Student', email: `rps-stu-o-${suffix}@t.local`, role: 'student', userStatus: 'active' },
    ]);

    // Noon UTC is always the same calendar day in Casablanca (UTC+1): keeps the
    // "today" assertions out of the midnight boundary window.
    const noonUtc = new Date();
    noonUtc.setUTCHours(12, 0, 0, 0);
    const now = noonUtc.toISOString();
    await db.insert(guardVisits).values([
      { tenantId, branchId: branchA, visitorFirstName: 'VisA', visitorLastName: 'One', purpose: 'parent meeting', status: 'checked_in', createdById: receptionistId, createdAt: now, updatedAt: now },
      { tenantId, branchId: branchB, visitorFirstName: 'VisB', visitorLastName: 'Two', purpose: 'supplier', status: 'checked_in', createdById: receptionistId, createdAt: now, updatedAt: now },
      { tenantId: otherTenantId, branchId: branchA, visitorFirstName: 'VisX', visitorLastName: 'Other', purpose: 'parent meeting', status: 'checked_in', createdById: otherTenantStudentId, createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    await db.delete(smsMessages).where(eq(smsMessages.tenantId, tenantId));
    await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.tenantId, tenantId));
    await db.delete(guardVisits).where(eq(guardVisits.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('lets a receptionist read the student directory with a least-privilege projection', async () => {
    currentSessionUserId = receptionistId;
    const res = await studentsRoute.GET(new Request('http://x/api/students?pageSize=10'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);

    const row = body.data[0];

    expect(row.fullName).toBe('Directory Student');
    expect(row.nationalId).toBeNull();
    expect(row.outstandingAmount).toBe(0);
    expect(row.overdueAmount).toBe(0);
  });

  it('strips finance, identity papers and academic history from the receptionist student detail', async () => {
    currentSessionUserId = receptionistId;
    const res = await studentsRoute.GET(new Request(`http://x/api/students?id=${studentId}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.fullName).toBe('Directory Student');
    expect(body.data.nationalId).toBeUndefined();
    expect(body.data.bloodGroup).toBeUndefined();
    expect(body.data.address).toBeUndefined();
    expect(body.data.payments).toBeUndefined();
    expect(body.data.balanceDue).toBeUndefined();
    expect(body.data.recentAssessments).toBeUndefined();
  });

  it('keeps roles outside the directory allowlist out', async () => {
    currentSessionUserId = parentId;
    const res = await studentsRoute.GET(new Request('http://x/api/students?pageSize=10'));

    expect(res.status).toBe(403);
  });

  it('opens the shared host picker for visitor.manage without appointment.manage', async () => {
    await db.insert(userPermissionOverrides).values({
      tenantId,
      userId: receptionistId,
      permissionId: 'reception.appointment.manage',
      granted: false,
    });

    currentSessionUserId = receptionistId;
    let res = await staffRoute.GET(new Request('http://x/api/reception/staff'));

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(Array.isArray(body.data)).toBe(true);

    // With both capabilities denied the same route must refuse.
    await db.insert(userPermissionOverrides).values({
      tenantId,
      userId: receptionistId,
      permissionId: 'reception.visitor.manage',
      granted: false,
    });
    res = await staffRoute.GET(new Request('http://x/api/reception/staff'));

    expect(res.status).toBe(403);
  });

  it('branch-scopes the reception home visitor counts', async () => {
    await db.delete(userPermissionOverrides).where(and(
      eq(userPermissionOverrides.tenantId, tenantId),
      eq(userPermissionOverrides.userId, receptionistId),
    ));

    const branchAHome = await getReceptionHome({
      userId: receptionistId,
      tenantId,
      branchId: branchA,
      role: 'receptionist',
    } as never);

    expect(branchAHome.checkedInVisitorsCount).toBe(1);
    expect(branchAHome.todayVisitsCount).toBe(1);

    const allBranchesHome = await getReceptionHome({
      userId: receptionistId,
      tenantId,
      branchId: null,
      role: 'receptionist',
    } as never);

    expect(allBranchesHome.checkedInVisitorsCount).toBe(2);
    expect(allBranchesHome.todayVisitsCount).toBe(2);
  });

  it('never fabricates a sent status for approved-template notifications', async () => {
    vi.stubEnv('PLATFORM_DEFAULT_SMS_PROVIDER', '');
    vi.stubEnv('DEFAULT_SMS_PROVIDER', '');
    vi.stubEnv('PLATFORM_DEFAULT_WHATSAPP_PROVIDER', '');

    const ctx = { userId: receptionistId, tenantId, branchId: null, role: 'receptionist' };
    const result = await sendApprovedNotification(ctx as never, {
      templateKey: 'appointment_scheduled',
      recipientPhone: '+212612345678',
      data: { date: '01/01/2026', time: '10:00', purpose: 'Test' },
      actorId: receptionistId,
    });

    expect(result).not.toBeNull();
    expect(result!.delivery).toBe('simulated');

    const [row] = await db
      .select({ status: smsMessages.status, sentAt: smsMessages.sentAt })
      .from(smsMessages)
      .where(eq(smsMessages.id, result!.id))
      .limit(1);

    expect(row!.status).toBe('queued');
    expect(row!.sentAt).toBeNull();

    await expect(sendApprovedNotification(ctx as never, {
      templateKey: 'free_form_not_allowed',
      recipientPhone: '+212612345678',
      data: { purpose: 'Test' },
      actorId: receptionistId,
    })).rejects.toMatchObject({ status: 422 });

    vi.unstubAllEnvs();
  });
});
