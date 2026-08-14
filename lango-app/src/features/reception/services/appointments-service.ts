// Reception appointments — tenant + branch scoped lifecycle with immutable
// status history. Concurrency is FOR UPDATE row locks (the status guard makes
// a second transition a 409, never a double transition); the version column is
// bumped every transition so the UI can do optimistic-concurrency checks.
// Idempotent create via the partial-unique idempotency_key (replay-safe).
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { user } from '@/models/Schema';
import {
  receptionAppointmentStatusHistory,
  receptionAppointments,
} from '@/features/reception/models/reception-schema';
import { APPOINTMENT_TRANSITIONS, type ReceptionAppointmentStatus } from '../types';
import { sendApprovedNotification } from './notifications-service';

const RECEPTION_HOST_ROLES = ['school_admin', 'teacher', 'accountant', 'receptionist', 'guard', 'librarian'] as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function requireTenantId(context: RequestContext): string {
  if (!context.tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  return context.tenantId;
}

function branchScope(ctx: RequestContext) {
  return ctx.branchId ? [eq(receptionAppointments.branchId, ctx.branchId)] : [];
}

// Narrow staff projection for the host picker — id, name, role only. Never
// contact details, salary or account data.
export async function listStaff(context: RequestContext) {
  const tenantId = requireTenantId(context);
  return db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(and(
      eq(user.tenantId, tenantId),
      eq(user.userStatus, 'active'),
      inArray(user.role, [...RECEPTION_HOST_ROLES]),
    ))
    .orderBy(asc(user.name));
}

export async function listAppointments(context: RequestContext, opts: {
  date?: string | null;
  status?: string | null;
  limit: number;
  offset: number;
}) {
  const tenantId = requireTenantId(context);
  const conditions: any[] = [eq(receptionAppointments.tenantId, tenantId), ...branchScope(context)];
  if (opts.status) conditions.push(eq(receptionAppointments.status, opts.status));
  if (opts.date) {
    // Tenant-local date comparison: stored timestamps are compared by their
    // date part, matching the portal-home aggregation style.
    conditions.push(sql`${receptionAppointments.startAt}::date = ${opts.date}::date`);
  }

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: receptionAppointments.id,
        branchId: receptionAppointments.branchId,
        guestType: receptionAppointments.guestType,
        guestName: receptionAppointments.guestName,
        guestPhone: receptionAppointments.guestPhone,
        purpose: receptionAppointments.purpose,
        hostId: receptionAppointments.hostId,
        hostName: receptionAppointments.hostName,
        startAt: receptionAppointments.startAt,
        endAt: receptionAppointments.endAt,
        status: receptionAppointments.status,
        notes: receptionAppointments.notes,
        version: receptionAppointments.version,
        createdAt: receptionAppointments.createdAt,
        updatedAt: receptionAppointments.updatedAt,
      })
      .from(receptionAppointments)
      .where(and(...conditions))
      .orderBy(asc(receptionAppointments.startAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: receptionAppointments.id })
      .from(receptionAppointments)
      .where(and(...conditions)),
  ]);

  return { data: rows, total: totalRows.length };
}

async function loadAppointment(tenantId: string, id: string, ctx: RequestContext) {
  const conditions = [eq(receptionAppointments.id, id), eq(receptionAppointments.tenantId, tenantId), ...branchScope(ctx)];
  const [row] = await db
    .select()
    .from(receptionAppointments)
    .where(and(...conditions))
    .limit(1);
  if (!row) throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');
  return row;
}

export async function getAppointment(context: RequestContext, id: string) {
  const tenantId = requireTenantId(context);
  return loadAppointment(tenantId, id, context);
}

async function requireTenantHost(tenantId: string, hostId: string) {
  const [host] = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(and(eq(user.id, hostId), eq(user.tenantId, tenantId)))
    .limit(1);
  if (!host || !(RECEPTION_HOST_ROLES as readonly string[]).includes(host.role as (typeof RECEPTION_HOST_ROLES)[number])) {
    throw new ApiError(422, 'HOST_NOT_ALLOWED', 'L\'hôte doit être un membre du personnel de l\'établissement.');
  }
  return host;
}

export async function createAppointment(context: RequestContext, input: {
  guestType?: string;
  guestName: string;
  guestPhone?: string | null;
  purpose: string;
  hostId: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
  idempotencyKey?: string | null;
  notificationTemplate?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const host = await requireTenantHost(tenantId, input.hostId);

  if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
    throw new ApiError(422, 'INVALID_WINDOW', 'La fin doit être postérieure au début.');
  }

  const now = new Date().toISOString();
  const values = {
    tenantId,
    branchId: context.branchId,
    guestType: input.guestType ?? 'parent',
    guestName: input.guestName,
    guestPhone: input.guestPhone ?? null,
    purpose: input.purpose,
    hostId: input.hostId,
    hostName: host.name,
    startAt: new Date(input.startAt).toISOString(),
    endAt: new Date(input.endAt).toISOString(),
    notes: input.notes ?? null,
    version: 0,
    idempotencyKey: input.idempotencyKey ?? null,
    createdById: context.userId,
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await db
    .insert(receptionAppointments)
    .values(values)
    .onConflictDoNothing({
      target: receptionAppointments.idempotencyKey,
      where: sql`idempotency_key IS NOT NULL`,
    })
    .returning();

  let appointment = inserted[0];
  let created = true;
  if (!appointment) {
    // Replay of a previous create with the same key — return the existing row.
    const [existing] = await db
      .select()
      .from(receptionAppointments)
      .where(and(
        eq(receptionAppointments.tenantId, tenantId),
        eq(receptionAppointments.idempotencyKey, input.idempotencyKey!),
      ))
      .limit(1);
    if (!existing) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Clé d\'idempotence invalide.');
    appointment = existing;
    created = false;
  }

  if (created) {
    await db.insert(receptionAppointmentStatusHistory).values({
      tenantId,
      appointmentId: appointment.id,
      fromStatus: null,
      toStatus: 'scheduled',
      changedById: context.userId,
      reason: 'Création du rendez-vous',
    });
    recordAudit(context, 'create', 'reception_appointment', appointment.id);
  }

  // Approved-template notification (log-only), never free-form text.
  if (created) {
    const date = new Date(appointment.startAt).toLocaleDateString('fr-FR');
    const time = new Date(appointment.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    await sendApprovedNotification(context, {
      templateKey: input.notificationTemplate ?? 'appointment_scheduled',
      recipientPhone: appointment.guestPhone,
      data: { date, time, purpose: appointment.purpose },
      actorId: context.userId,
    }).catch((err) => console.error('Reception notification failed', { err }));
  }

  return { appointment, created };
}

// FOR UPDATE + status-guard transition. Exactly one transition wins; a replay
// or invalid next status is a 409, never a double transition. The immutable
// history row is written inside the same transaction.
export async function transitionAppointment(
  context: RequestContext,
  id: string,
  toStatus: ReceptionAppointmentStatus,
  reason?: string | null,
) {
  const tenantId = requireTenantId(context);
  const result = await db.transaction(async (tx: Tx) => {
    const conditions = [eq(receptionAppointments.id, id), eq(receptionAppointments.tenantId, tenantId), ...branchScope(context)];
    const [row] = await tx
      .select()
      .from(receptionAppointments)
      .where(and(...conditions))
      .for('update')
      .limit(1);
    if (!row) throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');

    const fromStatus = row.status as ReceptionAppointmentStatus;
    const allowed = APPOINTMENT_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ApiError(409, 'INVALID_TRANSITION', `Transition ${fromStatus} → ${toStatus} non autorisée.`);
    }

    const now = new Date().toISOString();
    await tx
      .update(receptionAppointments)
      .set({ status: toStatus, version: row.version + 1, updatedAt: now })
      .where(eq(receptionAppointments.id, id));
    await tx.insert(receptionAppointmentStatusHistory).values({
      tenantId,
      appointmentId: id,
      fromStatus,
      toStatus,
      changedById: context.userId,
      reason: reason ?? null,
    });
    return { id, fromStatus, toStatus, version: row.version + 1 };
  });

  recordAudit(context, 'update', 'reception_appointment', id, { from: result.fromStatus, to: result.toStatus });

  // Approved-template cancellation notice (log-only).
  if (result.toStatus === 'cancelled') {
    const [row] = await db
      .select({ startAt: receptionAppointments.startAt, purpose: receptionAppointments.purpose, guestPhone: receptionAppointments.guestPhone })
      .from(receptionAppointments)
      .where(and(eq(receptionAppointments.id, id), eq(receptionAppointments.tenantId, tenantId)))
      .limit(1);
    if (row) {
      const date = new Date(row.startAt).toLocaleDateString('fr-FR');
      await sendApprovedNotification(context, {
        templateKey: 'appointment_cancelled',
        recipientPhone: row.guestPhone,
        data: { date, purpose: row.purpose },
        actorId: context.userId,
      }).catch(() => undefined);
    }
  }

  return result;
}

export async function rescheduleAppointment(context: RequestContext, id: string, input: {
  startAt: string;
  endAt: string;
  reason?: string | null;
}) {
  const tenantId = requireTenantId(context);
  if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
    throw new ApiError(422, 'INVALID_WINDOW', 'La fin doit être postérieure au début.');
  }

  const result = await db.transaction(async (tx: Tx) => {
    const conditions = [eq(receptionAppointments.id, id), eq(receptionAppointments.tenantId, tenantId), ...branchScope(context)];
    const [row] = await tx
      .select()
      .from(receptionAppointments)
      .where(and(...conditions))
      .for('update')
      .limit(1);
    if (!row) throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');
    if (row.status !== 'scheduled') {
      throw new ApiError(409, 'NOT_SCHEDULED', 'Seul un rendez-vous planifié peut être reprogrammé.');
    }
    const now = new Date().toISOString();
    await tx
      .update(receptionAppointments)
      .set({
        startAt: new Date(input.startAt).toISOString(),
        endAt: new Date(input.endAt).toISOString(),
        version: row.version + 1,
        updatedAt: now,
      })
      .where(eq(receptionAppointments.id, id));
    await tx.insert(receptionAppointmentStatusHistory).values({
      tenantId,
      appointmentId: id,
      fromStatus: 'scheduled',
      toStatus: 'scheduled',
      changedById: context.userId,
      reason: input.reason ?? 'Reprogrammation',
    });
    return { id, version: row.version + 1 };
  });

  recordAudit(context, 'update', 'reception_appointment', id, { action: 'reschedule' });
  return result;
}

export async function listAppointmentHistory(context: RequestContext, appointmentId: string) {
  const tenantId = requireTenantId(context);
  return db
    .select({
      id: receptionAppointmentStatusHistory.id,
      fromStatus: receptionAppointmentStatusHistory.fromStatus,
      toStatus: receptionAppointmentStatusHistory.toStatus,
      changedById: receptionAppointmentStatusHistory.changedById,
      reason: receptionAppointmentStatusHistory.reason,
      createdAt: receptionAppointmentStatusHistory.createdAt,
    })
    .from(receptionAppointmentStatusHistory)
    .where(and(
      eq(receptionAppointmentStatusHistory.tenantId, tenantId),
      eq(receptionAppointmentStatusHistory.appointmentId, appointmentId),
    ))
    .orderBy(asc(receptionAppointmentStatusHistory.createdAt));
}
