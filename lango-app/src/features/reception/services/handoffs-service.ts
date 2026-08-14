// Reception handoffs/tasks — records intent, assignment, priority, deadline,
// acknowledgement, resolution and immutable status history. A handoff NEVER
// performs the destination module's privileged action (no voucher, no admission
// approve, no finance record) — it is a coordination intent only
// (receptionist-portal plan §5).
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { user } from '@/models/Schema';
import {
  receptionHandoffStatusHistory,
  receptionHandoffs,
} from '@/features/reception/models/reception-schema';
import { HANDOFF_TRANSITIONS, type ReceptionHandoffStatus } from '../types';
import { sendApprovedNotification } from './notifications-service';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function requireTenantId(context: RequestContext): string {
  if (!context.tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  return context.tenantId;
}

function branchScope(ctx: RequestContext) {
  return ctx.branchId ? [eq(receptionHandoffs.branchId, ctx.branchId)] : [];
}

export async function listHandoffs(context: RequestContext, opts: {
  status?: string | null;
  assignedToMe?: boolean;
  limit: number;
  offset: number;
}) {
  const tenantId = requireTenantId(context);
  const conditions: any[] = [eq(receptionHandoffs.tenantId, tenantId), ...branchScope(context)];
  if (opts.status) conditions.push(eq(receptionHandoffs.status, opts.status));
  if (opts.assignedToMe) conditions.push(eq(receptionHandoffs.assignedToId, context.userId));

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: receptionHandoffs.id,
        branchId: receptionHandoffs.branchId,
        category: receptionHandoffs.category,
        subjectType: receptionHandoffs.subjectType,
        subjectId: receptionHandoffs.subjectId,
        title: receptionHandoffs.title,
        description: receptionHandoffs.description,
        priority: receptionHandoffs.priority,
        assignedToId: receptionHandoffs.assignedToId,
        assignedToName: user.name,
        deadline: receptionHandoffs.deadline,
        status: receptionHandoffs.status,
        resolutionNotes: receptionHandoffs.resolutionNotes,
        acknowledgedById: receptionHandoffs.acknowledgedById,
        acknowledgedAt: receptionHandoffs.acknowledgedAt,
        resolvedById: receptionHandoffs.resolvedById,
        resolvedAt: receptionHandoffs.resolvedAt,
        createdById: receptionHandoffs.createdById,
        createdAt: receptionHandoffs.createdAt,
        updatedAt: receptionHandoffs.updatedAt,
      })
      .from(receptionHandoffs)
      .leftJoin(user, eq(receptionHandoffs.assignedToId, user.id))
      .where(and(...conditions))
      .orderBy(desc(receptionHandoffs.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: receptionHandoffs.id })
      .from(receptionHandoffs)
      .where(and(...conditions)),
  ]);

  return { data: rows, total: totalRows.length };
}

export async function createHandoff(context: RequestContext, input: {
  category: string;
  subjectType?: string | null;
  subjectId?: string | null;
  title: string;
  description?: string | null;
  priority?: string;
  assignedToId?: string | null;
  deadline?: string | null;
  idempotencyKey?: string | null;
}) {
  const tenantId = requireTenantId(context);

  // Assigned-to must be a real member of this tenant (never cross-tenant).
  let assigneePhone: string | null = null;
  if (input.assignedToId) {
    const [member] = await db
      .select({ id: user.id, name: user.name, phone: user.phone })
      .from(user)
      .where(and(eq(user.id, input.assignedToId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!member) throw new ApiError(422, 'ASSIGNEE_NOT_FOUND', 'La personne assignée est introuvable dans cet établissement.');
    assigneePhone = member.phone ?? null;
  }

  const now = new Date().toISOString();
  const inserted = await db
    .insert(receptionHandoffs)
    .values({
      tenantId,
      branchId: context.branchId,
      category: input.category,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'medium',
      assignedToId: input.assignedToId ?? null,
      deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
      status: 'open',
      idempotencyKey: input.idempotencyKey ?? null,
      createdById: context.userId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: receptionHandoffs.idempotencyKey,
      where: sql`idempotency_key IS NOT NULL`,
    })
    .returning();

  let handoff = inserted[0];
  let created = true;
  if (!handoff) {
    const [existing] = await db
      .select()
      .from(receptionHandoffs)
      .where(and(
        eq(receptionHandoffs.tenantId, tenantId),
        eq(receptionHandoffs.idempotencyKey, input.idempotencyKey!),
      ))
      .limit(1);
    if (!existing) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Clé d\'idempotence invalide.');
    handoff = existing;
    created = false;
  }

  if (created) {
    await db.insert(receptionHandoffStatusHistory).values({
      tenantId,
      handoffId: handoff.id,
      fromStatus: null,
      toStatus: 'open',
      changedById: context.userId,
      reason: 'Création de la tâche',
    });
    recordAudit(context, 'create', 'reception_handoff', handoff.id);
    if (handoff.assignedToId) {
      await sendApprovedNotification(context, {
        templateKey: 'handoff_assigned',
        recipientPhone: assigneePhone,
        data: { handoffTitle: handoff.title, priority: handoff.priority },
        actorId: context.userId,
      }).catch(() => undefined);
    }
  }

  return { handoff, created };
}

async function loadHandoff(tenantId: string, id: string, ctx: RequestContext) {
  const conditions = [eq(receptionHandoffs.id, id), eq(receptionHandoffs.tenantId, tenantId), ...branchScope(ctx)];
  const [row] = await db
    .select()
    .from(receptionHandoffs)
    .where(and(...conditions))
    .limit(1);
  if (!row) throw new ApiError(404, 'HANDOFF_NOT_FOUND', 'Tâche introuvable.');
  return row;
}

export async function getHandoff(context: RequestContext, id: string) {
  const tenantId = requireTenantId(context);
  return loadHandoff(tenantId, id, context);
}

export async function transitionHandoff(
  context: RequestContext,
  id: string,
  toStatus: ReceptionHandoffStatus,
  opts: { reason?: string | null; resolutionNotes?: string | null } = {},
) {
  const tenantId = requireTenantId(context);
  const result = await db.transaction(async (tx: Tx) => {
    const conditions = [eq(receptionHandoffs.id, id), eq(receptionHandoffs.tenantId, tenantId), ...branchScope(context)];
    const [row] = await tx
      .select()
      .from(receptionHandoffs)
      .where(and(...conditions))
      .for('update')
      .limit(1);
    if (!row) throw new ApiError(404, 'HANDOFF_NOT_FOUND', 'Tâche introuvable.');

    const fromStatus = row.status as ReceptionHandoffStatus;
    const allowed = HANDOFF_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ApiError(409, 'INVALID_TRANSITION', `Transition ${fromStatus} → ${toStatus} non autorisée.`);
    }

    const now = new Date().toISOString();
    const set: Record<string, unknown> = { status: toStatus, updatedAt: now };
    if (toStatus === 'acknowledged') {
      set.acknowledgedById = context.userId;
      set.acknowledgedAt = now;
    }
    if (toStatus === 'resolved') {
      set.resolvedById = context.userId;
      set.resolvedAt = now;
      if (opts.resolutionNotes) set.resolutionNotes = opts.resolutionNotes;
    }
    await tx.update(receptionHandoffs).set(set).where(eq(receptionHandoffs.id, id));
    await tx.insert(receptionHandoffStatusHistory).values({
      tenantId,
      handoffId: id,
      fromStatus,
      toStatus,
      changedById: context.userId,
      reason: opts.reason ?? opts.resolutionNotes ?? null,
    });
    return { id, fromStatus, toStatus };
  });

  recordAudit(context, 'update', 'reception_handoff', id, { from: result.fromStatus, to: result.toStatus });
  return result;
}

export async function listHandoffHistory(context: RequestContext, handoffId: string) {
  const tenantId = requireTenantId(context);
  return db
    .select({
      id: receptionHandoffStatusHistory.id,
      fromStatus: receptionHandoffStatusHistory.fromStatus,
      toStatus: receptionHandoffStatusHistory.toStatus,
      changedById: receptionHandoffStatusHistory.changedById,
      reason: receptionHandoffStatusHistory.reason,
      createdAt: receptionHandoffStatusHistory.createdAt,
    })
    .from(receptionHandoffStatusHistory)
    .where(and(
      eq(receptionHandoffStatusHistory.tenantId, tenantId),
      eq(receptionHandoffStatusHistory.handoffId, handoffId),
    ))
    .orderBy(asc(receptionHandoffStatusHistory.createdAt));
}
