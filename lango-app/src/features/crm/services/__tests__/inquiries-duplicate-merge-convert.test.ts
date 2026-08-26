// Lead-CRM: duplicate detection + safe merge, and admissions-convert.
//
// findDuplicateCandidates() matches on phone OR email within the same tenant.
// mergeInquiries() re-points follow-ups onto the primary, unions tags, appends
// notes, then deletes the secondaries - and refuses to merge anything already
// converted. convertInquiryToApplicant() is idempotent: a second call on an
// already-converted inquiry is rejected (422 ALREADY_CONVERTED), so exactly
// one admission applicant record is ever created per inquiry, even on retry.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { applicants, inquiries, inquiryFollowUps, tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';

// inquiries-service.ts imports requireTenant from the real @/libs/api/context,
// which transitively pulls in @/libs/auth (better-auth/jose) - unimportable in
// this test runtime. Mock just the pure, dependency-free piece we need.
vi.mock('@/libs/api/context', () => ({
  requireTenant: (ctx: { tenantId?: string | null }) => {
    if (!ctx.tenantId) throw new Error('TENANT_REQUIRED');
    return ctx.tenantId;
  },
}));

const {
  convertInquiryToApplicant,
  createInquiry,
  findDuplicateCandidates,
  mergeInquiries,
} = await import('@/features/crm/services/inquiries-service');

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('lead-crm duplicate detection + merge + admissions convert', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const adminId = `CRM-ADMIN-${suffix}`;
  const sharedPhone = '0611223344';
  const sharedEmail = `duplicate-${suffix}@test.local`;

  const ctx: RequestContext = {
    userId: adminId, tenantId, branchId: null, role: 'school_admin', baseRole: 'school_admin',
    name: 'CRM Admin', email: `crm-admin-${suffix}@test.local`,
  };

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `CRM Duplicate ${suffix}`, slug: `crm-dup-${suffix}` });
    await db.insert(user).values({ id: adminId, tenantId, name: 'CRM Admin', email: `crm-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' });
  }, 30_000);

  afterAll(async () => {
    await db.delete(inquiryFollowUps).where(eq(inquiryFollowUps.tenantId, tenantId));
    await db.delete(applicants).where(eq(applicants.tenantId, tenantId));
    await db.delete(inquiries).where(eq(inquiries.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  describe('duplicate detection + merge', () => {
    it('flags two inquiries sharing the same phone as duplicate candidates', async () => {
      const first = await createInquiry(tenantId, { contactName: 'Parent Un', phone: sharedPhone, source: 'walk_in' });
      const second = await createInquiry(tenantId, { contactName: 'Parent Deux', phone: sharedPhone, source: 'phone', notes: 'Suivi par tel', tags: ['urgent'] });

      const candidates = await findDuplicateCandidates(tenantId, { phone: sharedPhone, excludeId: first.id });
      expect(candidates.map(c => c.id)).toContain(second.id);
    });

    it('does not flag unrelated inquiries as duplicates', async () => {
      const unrelated = await createInquiry(tenantId, { contactName: 'Sans Rapport', phone: '0699999999', email: sharedEmail, source: 'web' });
      const candidates = await findDuplicateCandidates(tenantId, { phone: sharedPhone });
      expect(candidates.map(c => c.id)).not.toContain(unrelated.id);
    });

    it('merging preserves history: tags union, notes appended, follow-ups re-pointed, secondary deleted', async () => {
      const primary = await createInquiry(tenantId, { contactName: 'Fusion Principale', phone: '0677778888', source: 'referral', tags: ['vip'] });
      const secondary = await createInquiry(tenantId, { contactName: 'Fusion Secondaire', phone: '0677778888', source: 'phone', notes: 'Rappelé deux fois', tags: ['urgent'] });

      await db.insert(inquiryFollowUps).values({ tenantId, inquiryId: secondary.id, type: 'call', notes: 'Appel de suivi', createdById: adminId });

      const merged = await mergeInquiries(ctx, primary.id, [secondary.id]);
      expect(merged!.tags).toEqual(expect.arrayContaining(['vip', 'urgent']));
      expect(merged!.notes).toContain('Rappelé deux fois');

      const [stillThere] = await db.select().from(inquiries).where(eq(inquiries.id, secondary.id));
      expect(stillThere).toBeUndefined();

      const followUps = await db.select().from(inquiryFollowUps).where(eq(inquiryFollowUps.inquiryId, primary.id));
      expect(followUps).toHaveLength(1);
      expect(followUps[0]!.notes).toBe('Appel de suivi');
    });

    it('refuses to merge an already-converted inquiry', async () => {
      const converted = await createInquiry(tenantId, { contactName: 'Deja Converti', phone: '0611112222', source: 'web' });
      await convertInquiryToApplicant(ctx, converted.id);

      const other = await createInquiry(tenantId, { contactName: 'Autre', phone: '0611112222', source: 'web' });
      await expect(mergeInquiries(ctx, other.id, [converted.id])).rejects.toMatchObject({ code: 'CONVERTED_CANNOT_MERGE' });
    });
  });

  describe('admissions-convert integration', () => {
    it('converts a lead into exactly one real admission applicant', async () => {
      const lead = await createInquiry(tenantId, { contactName: 'Yassine Alami', phone: '0655554444', email: `yassine-${suffix}@test.local`, source: 'web' });

      const result = await convertInquiryToApplicant(ctx, lead.id);
      expect(result.applicant).toBeDefined();
      expect(result.applicant!.firstName).toBe('Yassine');
      expect(result.applicant!.lastName).toBe('Alami');

      const applicantRows = await db.select().from(applicants).where(eq(applicants.tenantId, tenantId));
      const forThisLead = applicantRows.filter(a => a.id === result.applicant!.id);
      expect(forThisLead).toHaveLength(1);
    });

    it('rejects converting the same inquiry twice, even on retry (exactly-once guarantee)', async () => {
      const lead = await createInquiry(tenantId, { contactName: 'Sara Idrissi', phone: '0644443333', source: 'web' });
      const first = await convertInquiryToApplicant(ctx, lead.id);
      expect(first.applicant).toBeDefined();

      await expect(convertInquiryToApplicant(ctx, lead.id)).rejects.toMatchObject({ code: 'ALREADY_CONVERTED' });

      const applicantRows = await db.select().from(applicants).where(eq(applicants.tenantId, tenantId));
      const forThisLead = applicantRows.filter(a => a.email === `prospect-${lead.id.slice(0, 8)}@schoolos.local` || a.firstName === 'Sara');
      expect(forThisLead).toHaveLength(1);
    });
  });
});
