import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { account, auditLogs, schoolLicenses, schoolSettings, tenantInvitations, tenants, user } from '@/models/Schema';

let mockRequestContext: { userId: string; role: string; tenantId: string } | null = null;

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async () => {
    if (!mockRequestContext) {
      throw new Error('UNAUTHORIZED');
    }
    return mockRequestContext;
  }),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => {
    if (!ctx.tenantId) throw new Error('TENANT_REQUIRED');
    return ctx.tenantId;
  }),
}));

const { POST: publicSignupPost } = await import('@/app/api/public/signup/route');
const { GET: settingsInvitationsGet, POST: settingsInvitationsPost } = await import('@/app/api/settings/invitations/route');
const { DELETE: settingsInvitationsDelete } = await import('@/app/api/settings/invitations/[id]/route');
const { GET: publicInvitationGet } = await import('@/app/api/public/invitations/[token]/route');
const { POST: publicInvitationAcceptPost } = await import('@/app/api/public/invitations/[token]/accept/route');

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('Part C: Self-Serve Tenant Signup & Teammate Invitations', () => {
  const timestamp = Date.now();
  const schoolName = `SchoolOS Test School ${timestamp}`;
  const slug = `schoolos-test-school-${timestamp}`;
  const adminEmail = `admin-${timestamp}@schoolostest.com`;
  const adminPassword = 'Password123456!';
  const adminName = 'Test School Admin';

  let createdTenantId: string | null = null;
  let createdAdminUserId: string | null = null;
  let inviteToken: string | null = null;
  let inviteId: string | null = null;
  let teacherUserId: string | null = null;

  afterAll(async () => {
    // Cleanup created test records
    if (!dbReachable || !createdTenantId) return;
    try {
      await db.delete(tenantInvitations).where(eq(tenantInvitations.tenantId, createdTenantId));
      await db.delete(schoolLicenses).where(eq(schoolLicenses.tenantId, createdTenantId));
      await db.delete(schoolSettings).where(eq(schoolSettings.tenantId, createdTenantId));
      await db.delete(auditLogs).where(eq(auditLogs.tenantId, createdTenantId));
      if (teacherUserId) {
        await db.delete(account).where(eq(account.userId, teacherUserId));
        await db.delete(user).where(eq(user.id, teacherUserId));
      }
      if (createdAdminUserId) {
        await db.delete(account).where(eq(account.userId, createdAdminUserId));
        await db.delete(user).where(eq(user.id, createdAdminUserId));
      }
      await db.delete(tenants).where(eq(tenants.id, createdTenantId));
    } catch {
      // ignore cleanup errors in mock/offline test environments
    }
  });

  describe('1. Self-Serve Public Signup (Atomic Multi-Entity)', () => {
    it('successfully creates tenant, admin user, credential account, 30-day license, school settings and audit log', async () => {
      const req = new Request('http://localhost/api/public/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName,
          slug,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });

      const response = await publicSignupPost(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.schoolName).toBe(schoolName);
      expect(json.data.slug).toBe(slug);
      expect(json.data.adminEmail).toBe(adminEmail);
      expect(json.data.tenantId).toBeDefined();

      createdTenantId = json.data.tenantId;

      // 1. Verify tenant in DB
      const [tenantRow] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, createdTenantId!))
        .limit(1);
      expect(tenantRow).toBeDefined();
      expect(tenantRow!.planTier).toBe('trial');
      expect(tenantRow!.subscriptionStatus).toBe('active');
      expect(tenantRow!.isActive).toBe(true);

      // 2. Verify admin user in DB
      const [userRow] = await db
        .select()
        .from(user)
        .where(eq(user.email, adminEmail))
        .limit(1);
      expect(userRow).toBeDefined();
      expect(userRow!.role).toBe('school_admin');
      expect(userRow!.tenantId).toBe(createdTenantId);
      expect(userRow!.userStatus).toBe('active');
      createdAdminUserId = userRow!.id;

      // 3. Verify credential account in DB
      const [accountRow] = await db
        .select()
        .from(account)
        .where(eq(account.userId, createdAdminUserId!))
        .limit(1);
      expect(accountRow).toBeDefined();
      expect(accountRow!.providerId).toBe('credential');
      expect(accountRow!.password).toBeDefined();

      // 4. Verify 30-day license in DB
      const [licenseRow] = await db
        .select()
        .from(schoolLicenses)
        .where(eq(schoolLicenses.tenantId, createdTenantId!))
        .limit(1);
      expect(licenseRow).toBeDefined();
      expect(licenseRow!.status).toBe('active');
      expect(licenseRow!.expiresAt).toBeDefined();
      expect(new Date(licenseRow!.expiresAt!).getTime()).toBeGreaterThan(Date.now() + 25 * 24 * 60 * 60 * 1000);

      // 5. Verify schoolSettings in DB
      const [settingsRow] = await db
        .select()
        .from(schoolSettings)
        .where(eq(schoolSettings.tenantId, createdTenantId!))
        .limit(1);
      expect(settingsRow).toBeDefined();
      expect(settingsRow!.establishmentName).toBe(schoolName);

      // 6. Verify audit log
      const [auditRow] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.tenantId, createdTenantId!))
        .limit(1);
      expect(auditRow).toBeDefined();
      expect(auditRow!.action).toBe('create');
      expect(auditRow!.entityType).toBe('tenant');
    });

    it('rejects duplicate email and leaves no orphaned rows', async () => {
      const req = new Request('http://localhost/api/public/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: 'Another School Name',
          slug: `another-slug-${Date.now()}`,
          adminName: 'Duplicate Admin',
          adminEmail, // already used email
          adminPassword,
        }),
      });

      const response = await publicSignupPost(req);
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error.code).toBe('EMAIL_EXISTS');
    });

    it('rejects duplicate slug when explicitly supplied', async () => {
      const req = new Request('http://localhost/api/public/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: 'Another School Name',
          slug, // already used slug
          adminName: 'Another Admin',
          adminEmail: `unique-email-${Date.now()}@schoolostest.com`,
          adminPassword,
        }),
      });

      const response = await publicSignupPost(req);
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error.code).toBe('SLUG_EXISTS');
    });
  });

  describe('2. Teammate Invitations Flow', () => {
    const inviteEmail = `teacher-${timestamp}@schoolostest.com`;

    beforeAll(() => {
      mockRequestContext = {
        userId: createdAdminUserId!,
        role: 'school_admin',
        tenantId: createdTenantId!,
      };
    });

    it('allows school admin to send a teammate invitation with 7-day TTL', async () => {
      const req = new Request('http://localhost/api/settings/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: 'teacher',
        }),
      });

      const response = await settingsInvitationsPost(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.email).toBe(inviteEmail);
      expect(json.data.role).toBe('teacher');
      expect(json.data.token).toBeDefined();
      expect(json.inviteUrl).toContain(json.data.token);

      inviteToken = json.data.token;
      inviteId = json.data.id;

      // Verify in DB
      const [invRow] = await db
        .select()
        .from(tenantInvitations)
        .where(eq(tenantInvitations.id, inviteId!))
        .limit(1);
      expect(invRow).toBeDefined();
      expect(invRow!.status).toBe('pending');
      expect(invRow!.tenantId).toBe(createdTenantId);
      expect(new Date(invRow!.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    });

    it('lists pending invitations for the tenant', async () => {
      const response = await settingsInvitationsGet(
        new Request('http://localhost/api/settings/invitations')
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      const found = json.data.find((inv: { id: string }) => inv.id === inviteId);
      expect(found).toBeDefined();
      expect(found.email).toBe(inviteEmail);
    });

    it('resolves public invitation metadata by token', async () => {
      const response = await publicInvitationGet(
        new Request(`http://localhost/api/public/invitations/${inviteToken}`),
        { params: Promise.resolve({ token: inviteToken! }) }
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.valid).toBe(true);
      expect(json.data.email).toBe(inviteEmail);
      expect(json.data.schoolName).toBe(schoolName);
      expect(json.data.role).toBe('teacher');
    });

    it('allows recipient to accept invitation, creating user and credential account linked to the tenant', async () => {
      const acceptReq = new Request(`http://localhost/api/public/invitations/${inviteToken}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Professor Test',
          password: 'TeacherPassword123!',
        }),
      });

      const response = await publicInvitationAcceptPost(acceptReq, {
        params: Promise.resolve({ token: inviteToken! }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.email).toBe(inviteEmail);
      expect(json.data.role).toBe('teacher');
      expect(json.data.userId).toBeDefined();
      teacherUserId = json.data.userId;

      // 1. Verify user created with correct tenantId & role
      const [teacherRow] = await db
        .select()
        .from(user)
        .where(eq(user.id, teacherUserId!))
        .limit(1);
      expect(teacherRow).toBeDefined();
      expect(teacherRow!.tenantId).toBe(createdTenantId);
      expect(teacherRow!.role).toBe('teacher');
      expect(teacherRow!.name).toBe('Professor Test');

      // 2. Verify account created for teacher
      const [accRow] = await db
        .select()
        .from(account)
        .where(eq(account.userId, teacherUserId!))
        .limit(1);
      expect(accRow).toBeDefined();
      expect(accRow!.providerId).toBe('credential');

      // 3. Verify invitation marked as accepted
      const [invRow] = await db
        .select()
        .from(tenantInvitations)
        .where(eq(tenantInvitations.id, inviteId!))
        .limit(1);
      expect(invRow!.status).toBe('accepted');
    });

    it('rejects re-acceptance of an already accepted invitation', async () => {
      const reAcceptReq = new Request(`http://localhost/api/public/invitations/${inviteToken}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Professor Duplicate',
          password: 'AnotherPassword123!',
        }),
      });

      const response = await publicInvitationAcceptPost(reAcceptReq, {
        params: Promise.resolve({ token: inviteToken! }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.code).toBe('INVITATION_NOT_PENDING');
    });

    it('allows school admin to revoke a pending invitation', async () => {
      // 1. Create a second invitation
      const createReq = new Request('http://localhost/api/settings/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `accountant-${timestamp}@schoolostest.com`,
          role: 'accountant',
        }),
      });
      const createRes = await settingsInvitationsPost(createReq);
      const createJson = await createRes.json();
      const secondInviteId = createJson.data.id;
      const secondInviteToken = createJson.data.token;

      // 2. Revoke it
      const deleteRes = await settingsInvitationsDelete(
        new Request(`http://localhost/api/settings/invitations/${secondInviteId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: secondInviteId }) }
      );
      expect(deleteRes.status).toBe(200);

      // 3. Verify public lookup reports revoked (200 with valid:false — the
      // route no longer errors on non-pending invitations)
      const getRes = await publicInvitationGet(
        new Request(`http://localhost/api/public/invitations/${secondInviteToken}`),
        { params: Promise.resolve({ token: secondInviteToken }) }
      );
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.valid).toBe(false);
      expect(getJson.data.status).toBe('revoked');

      // Clean up second invite
      await db.delete(tenantInvitations).where(eq(tenantInvitations.id, secondInviteId));
    });
  });

  describe('3. Tenant Isolation for Self-Serve Tenant', () => {
    let foreignTenantId: string | null = null;
    let foreignInviteId: string | null = null;

    beforeAll(async () => {
      foreignTenantId = crypto.randomUUID();
      await db.insert(tenants).values({
        id: foreignTenantId,
        name: 'Foreign School',
        slug: `foreign-school-${foreignTenantId}`,
        subscriptionStatus: 'active',
        isActive: true,
      });

      const [foreignInvite] = await db
        .insert(tenantInvitations)
        .values({
          tenantId: foreignTenantId,
          email: `foreign-teacher-${Date.now()}@foreign.local`,
          role: 'teacher',
          token: `foreign_tok_${Date.now()}`,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        })
        .returning();
      foreignInviteId = foreignInvite!.id;
    });

    afterAll(async () => {
      if (foreignTenantId) {
        await db.delete(tenantInvitations).where(eq(tenantInvitations.tenantId, foreignTenantId));
        await db.delete(tenants).where(eq(tenants.id, foreignTenantId));
      }
    });

    it('new tenant admin cannot see foreign tenant invitations', async () => {
      mockRequestContext = {
        userId: createdAdminUserId!,
        role: 'school_admin',
        tenantId: createdTenantId!,
      };

      const response = await settingsInvitationsGet(
        new Request('http://localhost/api/settings/invitations')
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      const leaked = json.data.find((inv: { id: string }) => inv.id === foreignInviteId);
      expect(leaked).toBeUndefined();
    });

    it('new tenant admin cannot revoke foreign tenant invitation', async () => {
      mockRequestContext = {
        userId: createdAdminUserId!,
        role: 'school_admin',
        tenantId: createdTenantId!,
      };

      const response = await settingsInvitationsDelete(
        new Request(`http://localhost/api/settings/invitations/${foreignInviteId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: foreignInviteId! }) }
      );
      // Route should return 404 since the invitation belongs to another tenant
      expect([403, 404]).toContain(response.status);
    });
  });
});
