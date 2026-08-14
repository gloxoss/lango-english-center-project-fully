// Emergency procedures, contacts, activation, acknowledgement. Activation is
// leadership-only and snapshots the active procedures at that instant (evidence,
// not a live join). Acknowledgement is idempotent per guard via the unique
// (activationId, acknowledgedById) index.
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { user } from '@/models/Schema';
import {
  guardEmergencyProcedures,
  guardEmergencyContacts,
  guardEmergencyActivations,
  guardEmergencyAcknowledgements,
} from '@/features/guard/models/guard-schema';

function requireTenantId(context: RequestContext): string {
  return requireTenant(context);
}

export async function listEmergencyProcedures(context: RequestContext) {
  const tenantId = requireTenantId(context);
  const branchId = context.branchId;

  const procedures = await db
    .select({
      id: guardEmergencyProcedures.id,
      branchId: guardEmergencyProcedures.branchId,
      title: guardEmergencyProcedures.title,
      body: guardEmergencyProcedures.body,
      version: guardEmergencyProcedures.version,
      updatedAt: guardEmergencyProcedures.updatedAt,
    })
    .from(guardEmergencyProcedures)
    .where(and(
      eq(guardEmergencyProcedures.tenantId, tenantId),
      eq(guardEmergencyProcedures.isActive, true),
      branchId ? eq(guardEmergencyProcedures.branchId, branchId) : undefined,
    ))
    .orderBy(asc(guardEmergencyProcedures.title))
    .limit(100);

  const contacts = await db
    .select({
      id: guardEmergencyContacts.id,
      branchId: guardEmergencyContacts.branchId,
      name: guardEmergencyContacts.name,
      role: guardEmergencyContacts.role,
      phone: guardEmergencyContacts.phone,
      priority: guardEmergencyContacts.priority,
    })
    .from(guardEmergencyContacts)
    .where(and(
      eq(guardEmergencyContacts.tenantId, tenantId),
      eq(guardEmergencyContacts.isActive, true),
      branchId ? eq(guardEmergencyContacts.branchId, branchId) : undefined,
    ))
    .orderBy(asc(guardEmergencyContacts.priority))
    .limit(100);

  return { procedures, contacts };
}

export async function getActiveEmergency(context: RequestContext) {
  const tenantId = requireTenantId(context);
  const [activation] = await db
    .select()
    .from(guardEmergencyActivations)
    .where(and(
      eq(guardEmergencyActivations.tenantId, tenantId),
      eq(guardEmergencyActivations.status, 'active'),
    ))
    .orderBy(desc(guardEmergencyActivations.activatedAt))
    .limit(1);

  if (!activation) return { active: false, activation: null };

  const [ack] = await db
    .select({ id: guardEmergencyAcknowledgements.id })
    .from(guardEmergencyAcknowledgements)
    .where(and(
      eq(guardEmergencyAcknowledgements.tenantId, tenantId),
      eq(guardEmergencyAcknowledgements.activationId, activation.id),
      eq(guardEmergencyAcknowledgements.acknowledgedById, context.userId),
    ))
    .limit(1);

  return {
    active: true,
    activation: {
      id: activation.id,
      activatedAt: activation.activatedAt,
      status: activation.status,
      procedureSnapshot: activation.procedureSnapshot,
    },
    acknowledged: ack !== undefined,
  };
}

export async function activateEmergency(context: RequestContext, input: { reason?: string | null }) {
  const tenantId = requireTenantId(context);

  const procedures = await db
    .select({
      id: guardEmergencyProcedures.id,
      title: guardEmergencyProcedures.title,
      body: guardEmergencyProcedures.body,
      version: guardEmergencyProcedures.version,
      branchId: guardEmergencyProcedures.branchId,
    })
    .from(guardEmergencyProcedures)
    .where(and(
      eq(guardEmergencyProcedures.tenantId, tenantId),
      eq(guardEmergencyProcedures.isActive, true),
    ));

  const rows = await db
    .insert(guardEmergencyActivations)
    .values({
      tenantId,
      activatedById: context.userId,
      procedureSnapshot: procedures,
      status: 'active',
      reason: input.reason ?? null,
    })
    .returning();

  recordAudit(context, 'create', 'guard_emergency_activation', rows[0]!.id, {
    reason: input.reason ?? null,
  });
  return rows[0]!;
}

export async function acknowledgeEmergency(context: RequestContext, activationId: string, input: {
  deviceId?: string | null;
  kioskSessionId?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const [activation] = await db
    .select({ id: guardEmergencyActivations.id })
    .from(guardEmergencyActivations)
    .where(and(
      eq(guardEmergencyActivations.id, activationId),
      eq(guardEmergencyActivations.tenantId, tenantId),
      eq(guardEmergencyActivations.status, 'active'),
    ))
    .limit(1);
  if (!activation) throw new ApiError(404, 'EMERGENCY_NOT_ACTIVE', 'Aucune urgence active.');

  await db
    .insert(guardEmergencyAcknowledgements)
    .values({
      tenantId,
      activationId,
      acknowledgedById: context.userId,
      deviceId: input.deviceId ?? null,
      kioskSessionId: input.kioskSessionId ?? null,
    })
    .onConflictDoNothing({ target: [guardEmergencyAcknowledgements.activationId, guardEmergencyAcknowledgements.acknowledgedById] });

  recordAudit(context, 'create', 'guard_emergency_acknowledgement', activationId);
  return { acknowledged: true, activationId };
}

export async function endEmergency(context: RequestContext, activationId: string, input: { reason?: string | null }) {
  const tenantId = requireTenantId(context);
  const [activation] = await db
    .select()
    .from(guardEmergencyActivations)
    .where(and(
      eq(guardEmergencyActivations.id, activationId),
      eq(guardEmergencyActivations.tenantId, tenantId),
    ))
    .limit(1);
  if (!activation) throw new ApiError(404, 'EMERGENCY_NOT_FOUND', 'Activation introuvable.');
  if (activation.status !== 'active') {
    throw new ApiError(409, 'EMERGENCY_ALREADY_ENDED', 'L\'urgence est déjà terminée.');
  }

  const now = new Date().toISOString();
  await db
    .update(guardEmergencyActivations)
    .set({ status: 'ended', endedById: context.userId, endedAt: now, reason: input.reason ?? activation.reason })
    .where(and(eq(guardEmergencyActivations.id, activationId), eq(guardEmergencyActivations.tenantId, tenantId)));

  recordAudit(context, 'update', 'guard_emergency_activation', activationId, {
    reason: input.reason ?? null,
  });
  return { id: activationId, status: 'ended' };
}
