import { and, desc, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { db } from '@/libs/DB';
import { getDefinition, getEffectiveValue, setSettingValue } from '@/libs/settings/registry';
import { settingApprovals, settingDrafts } from '@/features/settings/models/settings-schema';

// ---------------------------------------------------------------------------
// Maker/checker review workflow for setting changes.
//
// Lifecycle: draft → submitted → (approved → applied | rejected), plus
// draft → cancelled. The approver can never be the author (403 SELF_APPROVAL).
// Approving records a settingApprovals row, then immediately applies the value
// with expectedVersion = baseVersion so a concurrent edit surfaces as a 409.
// ---------------------------------------------------------------------------

export type DraftStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'applied' | 'cancelled';

export const ALLOWED_TRANSITIONS: Record<DraftStatus, DraftStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected'],
  approved: ['applied'],
  rejected: [],
  applied: [],
  cancelled: [],
};

export function assertTransition(from: DraftStatus, to: DraftStatus, action: string): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new ApiError(409, 'INVALID_TRANSITION',
      `Impossible de passer ce brouillon de « ${from} » à « ${to} » (action: ${action}).`);
  }
}

export async function listDrafts(
  context: RequestContext,
  status?: DraftStatus,
): Promise<typeof settingDrafts.$inferSelect[]> {
  const tenantId = requireTenant(context);
  return db
    .select()
    .from(settingDrafts)
    .where(and(
      eq(settingDrafts.tenantId, tenantId),
      status ? eq(settingDrafts.status, status) : undefined,
    ))
    .orderBy(desc(settingDrafts.createdAt));
}

export async function getDraft(
  context: RequestContext,
  id: string,
): Promise<typeof settingDrafts.$inferSelect> {
  const tenantId = requireTenant(context);
  const [draft] = await db
    .select()
    .from(settingDrafts)
    .where(and(eq(settingDrafts.tenantId, tenantId), eq(settingDrafts.id, id)))
    .limit(1);
  if (!draft) throw new ApiError(404, 'NOT_FOUND', 'Proposition introuvable.');
  return draft;
}

export type CreateDraftInput = {
  key: string;
  proposedValue: unknown;
  title: string;
  reason?: string;
  branchId?: string | null;
};

export async function createDraft(context: RequestContext, input: CreateDraftInput) {
  const tenantId = requireTenant(context);
  const def = getDefinition(input.key);

  const parsed = def.valueSchema.safeParse(input.proposedValue);
  if (!parsed.success) {
    const msg = parsed.error.issues.slice(0, 3).map(i => `${i.path.join('.') || 'valeur'}: ${i.message}`).join('; ');
    throw new ApiError(422, 'VALIDATION_ERROR', msg);
  }

  const branchId = input.branchId ?? context.branchId ?? null;
  if (branchId && def.scope !== 'branch') {
    throw new ApiError(400, 'SCOPE_ERROR', `Le paramètre "${input.key}" ne peut pas être surchargé au niveau filiale.`);
  }

  const current = await getEffectiveValue(tenantId, branchId, input.key);

  const [draft] = await db.insert(settingDrafts).values({
    tenantId,
    key: input.key,
    branchId,
    title: input.title,
    reason: input.reason ?? null,
    proposedValue: parsed.data as never,
    currentValue: current.value as never,
    baseVersion: current.version,
    status: 'draft',
    authorId: context.userId,
  }).returning();

  recordAudit(context, 'create', 'settings_draft', draft!.id, {
    key: input.key,
    branchId,
    title: input.title,
  });
  return draft!;
}

export async function updateDraft(
  context: RequestContext,
  id: string,
  patch: { title?: string; reason?: string; proposedValue?: unknown },
) {
  const draft = await getDraft(context, id);
  if (draft.status !== 'draft') {
    throw new ApiError(409, 'INVALID_TRANSITION', 'Seul un brouillon non soumis peut être modifié.');
  }
  if (draft.authorId !== context.userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Seul l\'auteur peut modifier ce brouillon.');
  }

  const next: Record<string, unknown> = {};
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.reason !== undefined) next.reason = patch.reason;
  if (patch.proposedValue !== undefined) {
    const def = getDefinition(draft.key);
    const parsed = def.valueSchema.safeParse(patch.proposedValue);
    if (!parsed.success) {
      const msg = parsed.error.issues.slice(0, 3).map(i => `${i.path.join('.') || 'valeur'}: ${i.message}`).join('; ');
      throw new ApiError(422, 'VALIDATION_ERROR', msg);
    }
    next.proposedValue = parsed.data;
  }

  const [updated] = await db.update(settingDrafts)
    .set({ ...next, updatedAt: new Date().toISOString() })
    .where(eq(settingDrafts.id, draft.id))
    .returning();
  return updated!;
}

export async function submitDraft(context: RequestContext, id: string) {
  const draft = await getDraft(context, id);
  assertTransition(draft.status as DraftStatus, 'submitted', 'submit');
  if (draft.authorId !== context.userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Seul l\'auteur peut soumettre ce brouillon.');
  }
  const [updated] = await db.update(settingDrafts)
    .set({ status: 'submitted', updatedAt: new Date().toISOString() })
    .where(eq(settingDrafts.id, draft.id))
    .returning();
  recordAudit(context, 'update', 'settings_draft', draft.id, { key: draft.key, action: 'submit' });
  return updated!;
}

export async function cancelDraft(context: RequestContext, id: string) {
  const draft = await getDraft(context, id);
  assertTransition(draft.status as DraftStatus, 'cancelled', 'cancel');
  if (draft.authorId !== context.userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Seul l\'auteur peut annuler ce brouillon.');
  }
  const [updated] = await db.update(settingDrafts)
    .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
    .where(eq(settingDrafts.id, draft.id))
    .returning();
  recordAudit(context, 'update', 'settings_draft', draft.id, { key: draft.key, action: 'cancel' });
  return updated!;
}

async function applyApprovedDraft(context: RequestContext, draft: typeof settingDrafts.$inferSelect) {
  const version = await setSettingValue(
    draft.tenantId,
    draft.branchId,
    draft.key,
    draft.proposedValue,
    context,
    `Approbation de la proposition « ${draft.title} »`,
    draft.baseVersion,
  );
  await db.update(settingDrafts)
    .set({ status: 'applied', appliedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(settingDrafts.id, draft.id));
  return version;
}

export async function approveDraft(context: RequestContext, id: string, comment?: string) {
  const draft = await getDraft(context, id);
  assertTransition(draft.status as DraftStatus, 'approved', 'approve');
  if (draft.authorId === context.userId) {
    throw new ApiError(403, 'SELF_APPROVAL', 'Un auteur ne peut pas approuver sa propre proposition (séparation des tâches).');
  }

  await db.transaction(async (tx) => {
    await tx.insert(settingApprovals).values({
      tenantId: draft.tenantId,
      draftId: draft.id,
      decision: 'approved',
      approverId: context.userId,
      comment: comment ?? null,
    });
    await tx.update(settingDrafts)
      .set({
        status: 'approved',
        approverId: context.userId,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(settingDrafts.id, draft.id));
  });

  recordAudit(context, 'update', 'settings_draft', draft.id, { key: draft.key, action: 'approve' });

  // Apply immediately with the base version as the CAS guard. On a 409 the
  // draft stays 'approved' and can be re-applied after the conflict is resolved.
  try {
    const version = await applyApprovedDraft(context, draft);
    return { draft: await getDraft(context, id), version, applied: true };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
      return { draft: await getDraft(context, id), applied: false, conflict: true };
    }
    throw err;
  }
}

export async function rejectDraft(context: RequestContext, id: string, reason?: string) {
  const draft = await getDraft(context, id);
  assertTransition(draft.status as DraftStatus, 'rejected', 'reject');
  if (draft.authorId === context.userId) {
    throw new ApiError(403, 'SELF_APPROVAL', 'Un auteur ne peut pas rejeter sa propre proposition (séparation des tâches).');
  }

  await db.transaction(async (tx) => {
    await tx.insert(settingApprovals).values({
      tenantId: draft.tenantId,
      draftId: draft.id,
      decision: 'rejected',
      approverId: context.userId,
      comment: reason ?? null,
    });
    await tx.update(settingDrafts)
      .set({
        status: 'rejected',
        approverId: context.userId,
        rejectionReason: reason ?? null,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(settingDrafts.id, draft.id));
  });

  recordAudit(context, 'update', 'settings_draft', draft.id, { key: draft.key, action: 'reject' });
  return getDraft(context, id);
}

export async function retryApplyDraft(context: RequestContext, id: string) {
  const draft = await getDraft(context, id);
  assertTransition(draft.status as DraftStatus, 'applied', 'apply');
  if (draft.status !== 'approved') {
    throw new ApiError(409, 'INVALID_TRANSITION', 'Seule une proposition approuvée peut être appliquée.');
  }
  const version = await applyApprovedDraft(context, draft);
  return { draft: await getDraft(context, id), version };
}
