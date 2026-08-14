import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { tenants, user, settingValues } from '@/models/Schema';
import { settingApprovals, settingDrafts } from '@/features/settings/models/settings-schema';
import type { RequestContext } from '@/libs/api/context';
import {
  approveDraft, cancelDraft, createDraft, getDraft, rejectDraft, submitDraft, updateDraft,
} from '../services/drafts-service';

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

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('drafts maker/checker workflow', () => {
  const tenantId = crypto.randomUUID();
  const authorId = `DRFT-AUTH-${crypto.randomUUID()}`;
  const approverId = `DRFT-APPR-${crypto.randomUUID()}`;

  const ctxA: RequestContext = { userId: authorId, tenantId, branchId: null, role: 'school_admin', baseRole: 'school_admin', name: 'Author', email: 'a@test.local' };
  const ctxB: RequestContext = { userId: approverId, tenantId, branchId: null, role: 'school_admin', baseRole: 'school_admin', name: 'Approver', email: 'b@test.local' };

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Draft Test', slug: `draft-${tenantId}` });
    await db.insert(user).values([
      { id: authorId, tenantId, name: 'Author A', email: `a-${tenantId}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: approverId, tenantId, name: 'Approver B', email: `b-${tenantId}@test.local`, role: 'school_admin', userStatus: 'active' },
    ]);
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('full lifecycle: create → submit → self-approval blocked → second admin approves → applied', async () => {
    const draft = await createDraft(ctxA, {
      key: 'academic.allowOperations',
      proposedValue: false,
      title: 'Désactiver les opérations académiques',
      reason: 'Fin d\'année',
    });
    expect(draft.status).toBe('draft');
    expect(draft.currentValue).toBe(true); // registry default
    expect(draft.baseVersion).toBe(0);

    const submitted = await submitDraft(ctxA, draft.id);
    expect(submitted.status).toBe('submitted');

    // Maker cannot approve or reject own proposal.
    await expect(approveDraft(ctxA, draft.id)).rejects.toMatchObject({ status: 403, code: 'SELF_APPROVAL' });
    await expect(rejectDraft(ctxA, draft.id)).rejects.toMatchObject({ status: 403, code: 'SELF_APPROVAL' });

    const result = await approveDraft(ctxB, draft.id, 'OK');
    expect(result.applied).toBe(true);

    const applied = await getDraft(ctxA, draft.id);
    expect(applied.status).toBe('applied');
    expect(applied.approverId).toBe(approverId);

    const [approval] = await db.select().from(settingApprovals).where(eq(settingApprovals.draftId, draft.id));
    expect(approval?.decision).toBe('approved');
    expect(approval?.approverId).toBe(approverId);

    const [value] = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId),
      isNull(settingValues.branchId),
      eq(settingValues.key, 'academic.allowOperations'),
    ));
    expect(value?.value).toBe(false);
  });

  it('reject records the decision and leaves the value unchanged', async () => {
    // Establish an explicit baseline so the test is independent of siblings.
    await db.delete(settingValues).where(and(
      eq(settingValues.tenantId, tenantId),
      isNull(settingValues.branchId),
      eq(settingValues.key, 'academic.allowOperations'),
    ));
    await db.insert(settingValues).values({
      tenantId, key: 'academic.allowOperations', value: false, version: 1, updatedBy: authorId,
    });

    const draft = await createDraft(ctxA, {
      key: 'academic.allowOperations',
      proposedValue: true,
      title: 'Réactiver les opérations',
    });
    expect(draft.baseVersion).toBe(1);
    expect(draft.currentValue).toBe(false);
    await submitDraft(ctxA, draft.id);

    const rejected = await rejectDraft(ctxB, draft.id, 'Non justifié en cette période');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Non justifié en cette période');

    const [approval] = await db.select().from(settingApprovals).where(eq(settingApprovals.draftId, draft.id));
    expect(approval?.decision).toBe('rejected');

    const [value] = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId),
      isNull(settingValues.branchId),
      eq(settingValues.key, 'academic.allowOperations'),
    ));
    expect(value?.value).toBe(false);
    expect(value?.version).toBe(1);
  });

  it('author can edit then cancel a draft; cancelled drafts cannot be submitted', async () => {
    const draft = await createDraft(ctxA, {
      key: 'academic.allowOperations',
      proposedValue: false,
      title: 'Titre provisoire',
    });

    const renamed = await updateDraft(ctxA, draft.id, { title: 'Titre final' });
    expect(renamed.title).toBe('Titre final');

    const cancelled = await cancelDraft(ctxA, draft.id);
    expect(cancelled.status).toBe('cancelled');

    await expect(submitDraft(ctxA, draft.id)).rejects.toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
  });

  it('only the author can edit a draft', async () => {
    const draft = await createDraft(ctxA, {
      key: 'academic.allowOperations',
      proposedValue: false,
      title: 'Protégé',
    });
    await expect(updateDraft(ctxB, draft.id, { title: 'Intrusion' })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('a submitted draft cannot be edited', async () => {
    const draft = await createDraft(ctxA, {
      key: 'academic.allowOperations',
      proposedValue: false,
      title: 'Soumis',
    });
    await submitDraft(ctxA, draft.id);
    await expect(updateDraft(ctxA, draft.id, { title: 'Trop tard' })).rejects.toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
  });
});
