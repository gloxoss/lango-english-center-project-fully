// Lead-CRM guard + duplicate/merge + admissions-convert tests.
//
// Guard: `requireAddon(tenantId, 'lead-crm')` is the entitlement gate behind
// every authenticated api/crm/** and api/admissions/inquiries/** route. The
// public capture endpoint (`POST /api/public/inquiries/[tenantSlug]`) is
// intentionally ungated — it must keep accepting leads with no entitlement, so
// this suite asserts that by design rather than treating it as a bug.
//
// Business rules exercised here: duplicate detection (phone OR email), merge
// (re-points follow-ups, unions tags, preserves notes/history, deletes the
// secondaries), and conversion idempotency (exactly one applicant even on retry).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireAddon } from '@/libs/api/entitlements';
import type { RequestContext } from '@/libs/api/context';
import { addonEntitlements, applicants, auditLogs, inquiryFollowUps, inquiries, tenants, user } from '@/models/Schema';
import {
  addFollowUp,
  convertInquiryToApplicant,
  createInquiry,
  findDuplicateCandidates,
  mergeInquiries,
} from '@/features/crm/services/inquiries-service';
import { POST as publicInquiryCapture } from '@/app/api/public/inquiries/[tenantSlug]/route';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('lead-crm guard + duplicate/merge/convert', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const adminA = `CRM-ADMIN-${suffix}`;
  const slug = `crm-${suffix}`;

  const ctx: RequestContext = {
    userId: adminA,
    tenantId: tenantA,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'CRM Admin',
    email: `crm-admin-${suffix}@test.local`,
  };

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantA, name: `CRM School ${suffix}`, slug });
    await db.insert(user).values({ id: adminA, tenantId: tenantA, name: 'CRM Admin', email: `crm-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' });
  }, 30_000);

  afterAll(async () => {
    await db.delete(inquiryFollowUps).where(eq(inquiryFollowUps.tenantId, tenantA));
    await db.delete(inquiries).where(eq(inquiries.tenantId, tenantA));
    await db.delete(applicants).where(eq(applicants.tenantId, tenantA));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantA));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
  }, 30_000);

  it('denies ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
    await expect(requireAddon(tenantA, 'lead-crm')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });

  it('captures a public inquiry with no entitlement (ungated by design)', async () => {
    const req = new Request(`http://localhost/api/public/inquiries/${slug}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.2.0.1' },
      body: JSON.stringify({ contactName: 'Public Lead', phone: '0633333333', email: 'public@test.local' }),
    });
    const res = await publicInquiryCapture(req, { params: Promise.resolve({ tenantSlug: slug }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const rows = await db.select().from(inquiries)
      .where(and(eq(inquiries.tenantId, tenantA), eq(inquiries.email, 'public@test.local')));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('web');
    expect(rows[0]!.status).toBe('new');
  });

  it('allows once enabled, then denies again after being disabled', async () => {
    await db.insert(addonEntitlements).values({ tenantId: tenantA, addonId: 'lead-crm', isEnabled: true });
    await expect(requireAddon(tenantA, 'lead-crm')).resolves.toBeUndefined();

    await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantA));
    await expect(requireAddon(tenantA, 'lead-crm')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });

    await db.update(addonEntitlements).set({ isEnabled: true }).where(eq(addonEntitlements.tenantId, tenantA));
  });

  it('flags inquiries sharing the same phone as duplicates', async () => {
    await createInquiry(tenantA, { contactName: 'Dup One', phone: '0644444441', email: 'dup1@test.local', source: 'web' });
    await createInquiry(tenantA, { contactName: 'Dup Two', phone: '0644444441', email: 'dup2@test.local', source: 'phone' });

    const dups = await findDuplicateCandidates(tenantA, { phone: '0644444441' });
    expect(dups.length).toBeGreaterThanOrEqual(2);

    const excluding = await findDuplicateCandidates(tenantA, { phone: '0644444441', excludeId: dups[0]!.id });
    expect(excluding.some(d => d.id === dups[0]!.id)).toBe(false);
  });

  it('merges secondaries into the primary, re-pointing follow-ups and preserving history', async () => {
    const primary = await createInquiry(tenantA, {
      contactName: 'Primary Lead', phone: '0655555555', email: 'primary@test.local', source: 'web', tags: ['vip'], notes: 'Primary note',
    });
    const secondary = await createInquiry(tenantA, {
      contactName: 'Secondary Lead', phone: '0655555555', email: 'secondary@test.local', source: 'referral', tags: ['summer'], notes: 'Secondary note',
    });
    await addFollowUp(tenantA, secondary.id, { type: 'call', notes: 'Call me back' }, adminA);

    const merged = await mergeInquiries(ctx, primary.id, [secondary.id]);

    expect(merged.id).toBe(primary.id);

    const followUps = await db.select().from(inquiryFollowUps).where(eq(inquiryFollowUps.inquiryId, primary.id));
    expect(followUps).toHaveLength(1);
    expect(followUps[0]!.notes).toBe('Call me back');

    const secondaryRows = await db.select().from(inquiries).where(eq(inquiries.id, secondary.id));
    expect(secondaryRows).toHaveLength(0);

    expect(merged.tags).toEqual(expect.arrayContaining(['vip', 'summer']));
    expect(merged.notes).toContain('Primary note');
    expect(merged.notes).toContain('Secondary note');
  });

  it('converts an inquiry into exactly one applicant, idempotently', async () => {
    const inquiry = await createInquiry(tenantA, {
      contactName: 'Convert Me', phone: '0666666666', email: 'convert@test.local', source: 'web',
    });

    const first = await convertInquiryToApplicant(ctx, inquiry.id);
    expect(first.applicant).toBeTruthy();
    expect(first.applicant!.firstName).toBe('Convert');
    expect(first.applicant!.lastName).toBe('Me');

    const inquiryAfter = await db.select().from(inquiries).where(eq(inquiries.id, inquiry.id));
    expect(inquiryAfter[0]!.status).toBe('converted');
    expect(inquiryAfter[0]!.convertedApplicantId).toBe(first.applicant!.id);

    const applicantsByEmail = await db.select().from(applicants).where(eq(applicants.email, 'convert@test.local'));
    expect(applicantsByEmail).toHaveLength(1);

    await expect(convertInquiryToApplicant(ctx, inquiry.id)).rejects.toMatchObject({ code: 'ALREADY_CONVERTED' });
    const applicantsAgain = await db.select().from(applicants).where(eq(applicants.email, 'convert@test.local'));
    expect(applicantsAgain).toHaveLength(1);
  });
});
