// Card-management guard + public verification (adversarial) + auto-issue tests.
//
// Guard: `requireAddon(tenantId, 'card-management')` is the entitlement gate.
// Verification: the public `POST /api/public/cards/verify` route hashes a
// bearer token and returns `{valid:true}` only for a card whose status is
// `active`; it never echoes the render snapshot (DOB/NID/guardian data).
//
// Adversarial cases covered: forged token, revoked, replaced, expired
// (status='expired'), and past-validUntil-while-still-active cards all
// reject; a valid token resolves to its own tenant's school name (no
// cross-tenant contamination).
//
// Integration: `autoIssueStudentCardOnAdmission` issues a card end-to-end only
// when the tenant opted in via `cards.autoIssueStudentCardOnApproval` AND the
// `card-management` addon is enabled AND a published default template exists.
//
// The verify route checks both `status` and `validUntil` directly - a card
// left `active` past its `validUntil` timestamp fails verification immediately,
// independent of whatever expiry-sweep job may separately flip `status` to
// 'expired' later.
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireAddon } from '@/libs/api/entitlements';
import { addonEntitlements, settingValues, tenants, user } from '@/models/Schema';
import {
  documentEvents,
  documentTemplates,
  documentTemplateVersions,
  issuedDocuments,
} from '@/features/cards/models/cards-schema';
import { autoIssueStudentCardOnAdmission } from '@/features/cards/services/issue-service';
import { POST as verifyCard } from '@/app/api/public/cards/verify/route';

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

describe.skipIf(!dbReachable)('card-management guard + verification + auto-issue', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const adminA = `CARD-ADMIN-${suffix}`;
  const studentA = `CARD-STU-A-${suffix}`;
  const studentB = `CARD-STU-B-${suffix}`;

  const validTokenA = `CARD-VALID-A-${suffix}`;
  const validTokenB = `CARD-VALID-B-${suffix}`;
  const revokedToken = `CARD-REVOKED-${suffix}`;
  const replacedToken = `CARD-REPLACED-${suffix}`;
  const expiredToken = `CARD-EXPIRED-${suffix}`;
  const forgedToken = `CARD-FORGED-${suffix}`;
  const pastValidUntilToken = `CARD-PAST-VALID-UNTIL-${suffix}`;

  let versionA = '';
  let versionB = '';

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Card School A ${suffix}`, slug: `card-a-${suffix}` },
      { id: tenantB, name: `Card School B ${suffix}`, slug: `card-b-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminA, tenantId: tenantA, name: 'Card Admin', email: `card-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentA, tenantId: tenantA, name: 'Alice A', email: `card-stu-a-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: studentB, tenantId: tenantB, name: 'Bob B', email: `card-stu-b-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);

    const templateA = (await db.insert(documentTemplates).values({
      tenantId: tenantA, name: 'Student Card A', type: 'student_id', status: 'published', isDefault: true, createdBy: adminA,
    }).returning({ id: documentTemplates.id }))[0]!;
    versionA = (await db.insert(documentTemplateVersions).values({
      tenantId: tenantA, templateId: templateA.id, versionNumber: 1, pageWidthMm: 85, pageHeightMm: 55, orientation: 'landscape',
      schemaJson: {}, publishedById: adminA,
    }).returning({ id: documentTemplateVersions.id }))[0]!.id;

    const templateB = (await db.insert(documentTemplates).values({
      tenantId: tenantB, name: 'Student Card B', type: 'student_id', status: 'published', isDefault: true, createdBy: adminA,
    }).returning({ id: documentTemplates.id }))[0]!;
    versionB = (await db.insert(documentTemplateVersions).values({
      tenantId: tenantB, templateId: templateB.id, versionNumber: 1, pageWidthMm: 85, pageHeightMm: 55, orientation: 'landscape',
      schemaJson: {}, publishedById: adminA,
    }).returning({ id: documentTemplateVersions.id }))[0]!.id;

    // Cards for the verification matrix. `renderDataSnapshot.subjectName` is
    // what the public route echoes on a valid lookup — nothing else.
    await db.insert(issuedDocuments).values([
      { tenantId: tenantA, type: 'student_id', templateVersionId: versionA, subjectType: 'student', subjectId: studentA, publicTokenHash: sha256(validTokenA), status: 'active', renderDataSnapshot: { subjectName: 'Alice A' }, issuedById: adminA },
      { tenantId: tenantA, type: 'student_id', templateVersionId: versionA, subjectType: 'student', subjectId: studentA, publicTokenHash: sha256(revokedToken), status: 'revoked', renderDataSnapshot: { subjectName: 'Revoked Student' }, issuedById: adminA, revokedById: adminA, revokeReason: 'test' },
      { tenantId: tenantA, type: 'student_id', templateVersionId: versionA, subjectType: 'student', subjectId: studentA, publicTokenHash: sha256(replacedToken), status: 'replaced', renderDataSnapshot: { subjectName: 'Replaced Student' }, issuedById: adminA },
      { tenantId: tenantA, type: 'student_id', templateVersionId: versionA, subjectType: 'student', subjectId: studentA, publicTokenHash: sha256(expiredToken), status: 'expired', renderDataSnapshot: { subjectName: 'Expired Student' }, issuedById: adminA },
      { tenantId: tenantA, type: 'student_id', templateVersionId: versionA, subjectType: 'student', subjectId: studentA, publicTokenHash: sha256(pastValidUntilToken), status: 'active', validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), renderDataSnapshot: { subjectName: 'Past Valid Until Student' }, issuedById: adminA },
      { tenantId: tenantB, type: 'student_id', templateVersionId: versionB, subjectType: 'student', subjectId: studentB, publicTokenHash: sha256(validTokenB), status: 'active', renderDataSnapshot: { subjectName: 'Bob B' }, issuedById: adminA },
    ]);

    // Opt-in setting for the auto-issue integration test.
    await db.insert(settingValues).values({ tenantId: tenantA, branchId: null, key: 'cards.autoIssueStudentCardOnApproval', value: true });
  }, 30_000);

  afterAll(async () => {
    await db.delete(documentEvents).where(eq(documentEvents.tenantId, tenantA));
    await db.delete(documentEvents).where(eq(documentEvents.tenantId, tenantB));
    await db.delete(issuedDocuments).where(eq(issuedDocuments.tenantId, tenantA));
    await db.delete(issuedDocuments).where(eq(issuedDocuments.tenantId, tenantB));
    await db.delete(documentTemplateVersions).where(eq(documentTemplateVersions.tenantId, tenantA));
    await db.delete(documentTemplateVersions).where(eq(documentTemplateVersions.tenantId, tenantB));
    await db.delete(documentTemplates).where(eq(documentTemplates.tenantId, tenantA));
    await db.delete(documentTemplates).where(eq(documentTemplates.tenantId, tenantB));
    await db.delete(settingValues).where(eq(settingValues.tenantId, tenantA));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  }, 30_000);

  function verifyRequest(token: string, ip: string) {
    return new Request('http://localhost/api/public/cards/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ token }),
    });
  }

  async function verify(token: string, ip = '10.0.0.1') {
    const res = await verifyCard(verifyRequest(token, ip));
    return res.json() as Promise<{ success: boolean; data: { valid: boolean; subjectName?: string; schoolName?: string } }>;
  }

  describe('entitlement guard', () => {
    it('denies with ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
      await expect(requireAddon(tenantA, 'card-management')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
    });

    it('allows once enabled, then denies again after being disabled', async () => {
      await db.insert(addonEntitlements).values({ tenantId: tenantA, addonId: 'card-management', isEnabled: true });
      await expect(requireAddon(tenantA, 'card-management')).resolves.toBeUndefined();

      await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantA));
      await expect(requireAddon(tenantA, 'card-management')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });

      // Re-enable for the auto-issue integration test below.
      await db.update(addonEntitlements).set({ isEnabled: true }).where(eq(addonEntitlements.tenantId, tenantA));
    });
  });

  describe('public verification (adversarial)', () => {
    it('verifies an active card and echoes only the subject name + school name', async () => {
      const body = await verify(validTokenA, '10.1.0.1');
      expect(body.data.valid).toBe(true);
      expect(body.data.subjectName).toBe('Alice A');
      expect(body.data.schoolName).toBe(`Card School A ${suffix}`);
    });

    it('rejects a forged token that was never issued', async () => {
      const body = await verify(forgedToken, '10.1.0.2');
      expect(body.data.valid).toBe(false);
      expect(body.data.subjectName).toBeUndefined();
    });

    it('rejects a revoked card', async () => {
      const body = await verify(revokedToken, '10.1.0.3');
      expect(body.data.valid).toBe(false);
    });

    it('rejects a replaced (superseded) card', async () => {
      const body = await verify(replacedToken, '10.1.0.4');
      expect(body.data.valid).toBe(false);
    });

    it('rejects an expired card (status=expired)', async () => {
      const body = await verify(expiredToken, '10.1.0.5');
      expect(body.data.valid).toBe(false);
    });

    it('rejects a card whose validUntil has passed even while status is still active', async () => {
      const body = await verify(pastValidUntilToken, '10.1.0.9');
      expect(body.data.valid).toBe(false);
    });

    it('resolves each valid token to its own tenant school name (no cross-tenant bleed)', async () => {
      const a = await verify(validTokenA, '10.1.0.6');
      const b = await verify(validTokenB, '10.1.0.7');
      expect(a.data.valid).toBe(true);
      expect(b.data.valid).toBe(true);
      expect(a.data.schoolName).toBe(`Card School A ${suffix}`);
      expect(b.data.schoolName).toBe(`Card School B ${suffix}`);
    });
  });

  describe('auto-issue integration', () => {
    it('returns null when the opt-in setting is disabled', async () => {
      await db.delete(settingValues).where(and(eq(settingValues.tenantId, tenantA), eq(settingValues.key, 'cards.autoIssueStudentCardOnApproval')));
      const result = await autoIssueStudentCardOnAdmission(tenantA, studentA, adminA);
      expect(result).toBeNull();
      await db.insert(settingValues).values({ tenantId: tenantA, branchId: null, key: 'cards.autoIssueStudentCardOnApproval', value: true });
    });

    it('issues a card end-to-end and records an issuance event', async () => {
      const result = await autoIssueStudentCardOnAdmission(tenantA, studentA, adminA);
      expect(result).not.toBeNull();
      expect(result!.issuedDocument.status).toBe('active');
      expect(result!.issuedDocument.subjectId).toBe(studentA);
      expect(result!.rawToken).toBeTruthy();

      const events = await db.select().from(documentEvents)
        .where(and(eq(documentEvents.tenantId, tenantA), eq(documentEvents.issuedDocumentId, result!.issuedDocument.id)));
      expect(events).toHaveLength(1);
      expect(events[0]!.eventKind).toBe('issued');
    });
  });
});
