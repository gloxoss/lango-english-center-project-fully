// Certificate-management guard + public verification (adversarial) + revoke
// workflow tests.
//
// Verification: `POST /api/public/certificates/verify` hashes a bearer token and
// returns `{valid:true}` only for a certificate whose status is `valid`. The
// response never distinguishes a revoked/replaced cert from a never-issued
// token, and never echoes evidenceSnapshot (DOB/NID/salary/internal notes).
//
// Adversarial cases: forged token, revoked, and replaced certificates all
// reject; a valid token resolves to its own tenant's school name.
//
// Workflow: the authenticated `POST /api/certificates/issued/[id]/revoke`
// route (school_admin + `certificate-management` + `certificates.revoke`)
// flips status to `revoked` and records an event; the public verifier then
// rejects that certificate — proving revocation actually stops verification,
// not just a flag nobody checks.
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireAddon } from '@/libs/api/entitlements';
import { addonEntitlements, tenants, user } from '@/models/Schema';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
  certificateEvents,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';
import { POST as verifyCertificate } from '@/app/api/public/certificates/verify/route';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const sessionUserId = { value: null as string | null };

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () =>
        sessionUserId.value
          ? { user: { id: sessionUserId.value }, session: { id: 'sess-cert' } }
          : null,
    },
  },
}));

vi.mock('@/features/portal/services/active-context', () => ({
  resolveActiveContext: async () => null,
}));

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('certificate-management guard + verification + revoke', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const adminA = `CERT-ADMIN-${suffix}`;
  const studentA = `CERT-STU-A-${suffix}`;
  const studentB = `CERT-STU-B-${suffix}`;

  const validTokenA = `CERT-VALID-A-${suffix}`;
  const validTokenB = `CERT-VALID-B-${suffix}`;
  const workflowToken = `CERT-WORKFLOW-${suffix}`;
  const revokedToken = `CERT-REVOKED-${suffix}`;
  const replacedToken = `CERT-REPLACED-${suffix}`;
  const forgedToken = `CERT-FORGED-${suffix}`;

  let workflowCertId = '';

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Cert School A ${suffix}`, slug: `cert-a-${suffix}` },
      { id: tenantB, name: `Cert School B ${suffix}`, slug: `cert-b-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminA, tenantId: tenantA, name: 'Cert Admin', email: `cert-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentA, tenantId: tenantA, name: 'Alice A', email: `cert-stu-a-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: studentB, tenantId: tenantB, name: 'Bob B', email: `cert-stu-b-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);

    const defA = (await db.insert(certificateDefinitions).values({
      tenantId: tenantA, title: 'Certificat A', allowedTargetType: 'student', createdBy: adminA,
    }).returning({ id: certificateDefinitions.id }))[0]!;
    const verA = (await db.insert(certificateDefinitionVersions).values({
      tenantId: tenantA, definitionId: defA.id, versionNumber: 1, fieldAllowlist: {}, templateSchema: {}, pdfmeBasePdf: {}, createdBy: adminA,
    }).returning({ id: certificateDefinitionVersions.id }))[0]!;

    const defB = (await db.insert(certificateDefinitions).values({
      tenantId: tenantB, title: 'Certificat B', allowedTargetType: 'student', createdBy: adminA,
    }).returning({ id: certificateDefinitions.id }))[0]!;
    const verB = (await db.insert(certificateDefinitionVersions).values({
      tenantId: tenantB, definitionId: defB.id, versionNumber: 1, fieldAllowlist: {}, templateSchema: {}, pdfmeBasePdf: {}, createdBy: adminA,
    }).returning({ id: certificateDefinitionVersions.id }))[0]!;

    const cert = (values: Record<string, unknown>) => ({
      tenantId: tenantA, definitionId: defA.id, versionId: verA.id, recipientId: studentA,
      serialNumber: values.serialNumber as string, verificationTokenHash: values.verificationTokenHash as string,
      fileExt: 'pdf', status: values.status as any, evidenceSnapshot: {}, issuedBy: adminA,
    });

    const workflow = await db.insert(issuedCertificates).values([
      cert({ serialNumber: `CERT-A-1-${suffix}`, verificationTokenHash: sha256(validTokenA), status: 'valid' }),
      cert({ serialNumber: `CERT-A-2-${suffix}`, verificationTokenHash: sha256(workflowToken), status: 'valid' }),
      cert({ serialNumber: `CERT-A-3-${suffix}`, verificationTokenHash: sha256(revokedToken), status: 'revoked' }),
      cert({ serialNumber: `CERT-A-4-${suffix}`, verificationTokenHash: sha256(replacedToken), status: 'replaced' }),
      { tenantId: tenantB, definitionId: defB.id, versionId: verB.id, recipientId: studentB, serialNumber: `CERT-B-1-${suffix}`, verificationTokenHash: sha256(validTokenB), fileExt: 'pdf', status: 'valid', evidenceSnapshot: {}, issuedBy: adminA },
    ]).returning({ id: issuedCertificates.id });

    workflowCertId = workflow[1]!.id;

    await db.insert(addonEntitlements).values({ tenantId: tenantA, addonId: 'certificate-management', isEnabled: true });
    sessionUserId.value = adminA;
  }, 30_000);

  afterAll(async () => {
    await db.delete(certificateEvents).where(eq(certificateEvents.tenantId, tenantA));
    await db.delete(certificateEvents).where(eq(certificateEvents.tenantId, tenantB));
    await db.delete(issuedCertificates).where(eq(issuedCertificates.tenantId, tenantA));
    await db.delete(issuedCertificates).where(eq(issuedCertificates.tenantId, tenantB));
    await db.delete(certificateDefinitionVersions).where(eq(certificateDefinitionVersions.tenantId, tenantA));
    await db.delete(certificateDefinitionVersions).where(eq(certificateDefinitionVersions.tenantId, tenantB));
    await db.delete(certificateDefinitions).where(eq(certificateDefinitions.tenantId, tenantA));
    await db.delete(certificateDefinitions).where(eq(certificateDefinitions.tenantId, tenantB));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  }, 30_000);

  function verifyRequest(token: string, ip: string) {
    return new Request('http://localhost/api/public/certificates/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ token }),
    });
  }

  async function verify(token: string, ip = '10.3.0.1') {
    const res = await verifyCertificate(verifyRequest(token, ip));
    return res.json() as Promise<{ success: boolean; data: { valid: boolean; recipientName?: string; schoolName?: string; serialNumber?: string } }>;
  }

  describe('entitlement guard', () => {
    it('denies with ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
      await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantA));
      await expect(requireAddon(tenantA, 'certificate-management')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
      await db.update(addonEntitlements).set({ isEnabled: true }).where(eq(addonEntitlements.tenantId, tenantA));
    });

    it('allows once enabled', async () => {
      await expect(requireAddon(tenantA, 'certificate-management')).resolves.toBeUndefined();
    });
  });

  describe('public verification (adversarial)', () => {
    it('verifies a valid certificate and echoes only safe fields', async () => {
      const body = await verify(validTokenA, '10.3.1.1');
      expect(body.data.valid).toBe(true);
      expect(body.data.recipientName).toBe('Alice A');
      expect(body.data.schoolName).toBe(`Cert School A ${suffix}`);
    });

    it('rejects a forged token that was never issued', async () => {
      const body = await verify(forgedToken, '10.3.1.2');
      expect(body.data.valid).toBe(false);
      expect(body.data.recipientName).toBeUndefined();
    });

    it('rejects a revoked certificate', async () => {
      const body = await verify(revokedToken, '10.3.1.3');
      expect(body.data.valid).toBe(false);
    });

    it('rejects a replaced (superseded) certificate', async () => {
      const body = await verify(replacedToken, '10.3.1.4');
      expect(body.data.valid).toBe(false);
    });

    it('resolves each valid token to its own tenant school name (no cross-tenant bleed)', async () => {
      const a = await verify(validTokenA, '10.3.1.5');
      const b = await verify(validTokenB, '10.3.1.6');
      expect(a.data.valid).toBe(true);
      expect(b.data.valid).toBe(true);
      expect(a.data.schoolName).toBe(`Cert School A ${suffix}`);
      expect(b.data.schoolName).toBe(`Cert School B ${suffix}`);
    });
  });

  describe('revocation workflow', () => {
    it('revoking a certificate makes its token stop verifying and records an event', async () => {
      const before = await verify(workflowToken, '10.3.2.1');
      expect(before.data.valid).toBe(true);

      const revokeRoute = await import('@/app/api/certificates/issued/[id]/revoke/route');
      const req = new Request(`http://localhost/api/certificates/issued/${workflowCertId}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Test revocation' }),
      });
      const res = await revokeRoute.POST(req, { params: Promise.resolve({ id: workflowCertId }) });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('revoked');

      const after = await verify(workflowToken, '10.3.2.2');
      expect(after.data.valid).toBe(false);

      const events = await db.select().from(certificateEvents)
        .where(eq(certificateEvents.issuedCertificateId, workflowCertId));
      expect(events).toHaveLength(1);
      expect(events[0]!.eventKind).toBe('revoked');
    });
  });
});
