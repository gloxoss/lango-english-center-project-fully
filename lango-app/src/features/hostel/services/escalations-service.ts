// Escalation service — idempotent safeguarding/supervision alerts. A second run
// creates no duplicates (unique (tenantId, idempotencyKey)); log-only in v1
// (no SMS provider). Triggered on roll-call close and on-demand via /run.
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { user } from '@/models/Schema';
import {
  hostelAllocations,
  hostelEscalations,
  hostelLeavePasses,
  hostelRollCallEntries,
  hostelRollCalls,
} from '@/features/hostel/models/hostel-schema';
import { firstRow } from '@/features/hostel/server/db-utils';
import { dateString } from '@/features/hostel/services/inventory-service';

export async function listEscalations(tenantId: string, opts?: {
  type?: string | null;
  status?: 'open' | 'acknowledged' | null;
  triggerDate?: string | null;
}) {
  const conds = [eq(hostelEscalations.tenantId, tenantId)];
  if (opts?.type) conds.push(eq(hostelEscalations.escalationType, opts.type));
  if (opts?.triggerDate) conds.push(eq(hostelEscalations.triggerDate, opts.triggerDate));
  if (opts?.status === 'acknowledged') conds.push(sql`${hostelEscalations.acknowledgedAt} IS NOT NULL`);
  if (opts?.status === 'open') conds.push(sql`${hostelEscalations.acknowledgedAt} IS NULL`);

  return db
    .select({
      id: hostelEscalations.id,
      allocationId: hostelEscalations.allocationId,
      escalationType: hostelEscalations.escalationType,
      triggerDate: hostelEscalations.triggerDate,
      tier: hostelEscalations.tier,
      recipientType: hostelEscalations.recipientType,
      channel: hostelEscalations.channel,
      acknowledgedAt: hostelEscalations.acknowledgedAt,
      acknowledgedById: hostelEscalations.acknowledgedById,
      closureReason: hostelEscalations.closureReason,
      idempotencyKey: hostelEscalations.idempotencyKey,
      createdAt: hostelEscalations.createdAt,
      studentId: hostelAllocations.studentId,
      studentName: user.name,
    })
    .from(hostelEscalations)
    .leftJoin(hostelAllocations, eq(hostelEscalations.allocationId, hostelAllocations.id))
    .leftJoin(user, eq(hostelAllocations.studentId, user.id))
    .where(and(...conds))
    .orderBy(desc(hostelEscalations.createdAt));
}

export async function acknowledgeEscalation(tenantId: string, actorId: string, escalationId: string, closureReason?: string | null) {
  const [escalation] = await db.select().from(hostelEscalations)
    .where(and(eq(hostelEscalations.id, escalationId), eq(hostelEscalations.tenantId, tenantId))).limit(1);
  if (!escalation) throw new ApiError(404, 'NOT_FOUND', 'Escalade introuvable.');
  if (escalation.acknowledgedAt) {
    throw new ApiError(409, 'ALREADY_ACKNOWLEDGED', 'Cette escalade est déjà prise en compte.');
  }
  return firstRow(await db.update(hostelEscalations)
    .set({
      acknowledgedAt: new Date().toISOString(),
      acknowledgedById: actorId,
      closureReason: closureReason ?? null,
    })
    .where(and(eq(hostelEscalations.id, escalationId), eq(hostelEscalations.tenantId, tenantId)))
    .returning());
}

async function insertEscalationIfAbsent(tenantId: string, escalation: {
  allocationId: string | null;
  escalationType: 'missing_rollcall' | 'overdue_return';
  triggerDate: string;
  tier: number;
  recipientType: string;
  channel: string;
  idempotencyKey: string;
}) {
  await db.insert(hostelEscalations).values({
    tenantId,
    allocationId: escalation.allocationId,
    escalationType: escalation.escalationType,
    triggerDate: escalation.triggerDate,
    tier: escalation.tier,
    recipientType: escalation.recipientType,
    channel: escalation.channel,
    idempotencyKey: escalation.idempotencyKey,
  }).onConflictDoNothing().catch(() => undefined);
}

/**
 * Idempotent escalation pass. Called on roll-call close and on-demand.
 * - missing_rollcall: every `missing` entry in a closed roll call today.
 * - overdue_return: approved leave passes whose expected return has passed.
 */
export async function runEscalations(tenantId: string, _actorId: string, opts?: { triggerDate?: string }) {
  const triggerDate = opts?.triggerDate ?? dateString();
  const created = { missing_rollcall: 0, overdue_return: 0 };

  // 1. Missing roll-call entries from closed registers on the trigger date.
  const closedRollCalls = await db.select({ id: hostelRollCalls.id }).from(hostelRollCalls)
    .where(and(
      eq(hostelRollCalls.tenantId, tenantId),
      eq(hostelRollCalls.callDate, triggerDate),
      eq(hostelRollCalls.status, 'closed'),
    ));
  if (closedRollCalls.length > 0) {
    const rollCallIds = closedRollCalls.map(r => r.id);
    const missing = await db
      .select({ allocationId: hostelRollCallEntries.allocationId })
      .from(hostelRollCallEntries)
      .where(and(
        eq(hostelRollCallEntries.tenantId, tenantId),
        inArray(hostelRollCallEntries.rollCallId, rollCallIds),
        eq(hostelRollCallEntries.status, 'missing'),
      ));
    for (const m of missing) {
      await insertEscalationIfAbsent(tenantId, {
        allocationId: m.allocationId,
        escalationType: 'missing_rollcall',
        triggerDate,
        tier: 1,
        recipientType: 'warden',
        channel: 'log',
        idempotencyKey: `missing_rollcall:${m.allocationId}:${triggerDate}`,
      });
      created.missing_rollcall += 1;
    }
  }

  // 2. Approved leave passes overdue for return.
  const now = new Date().toISOString();
  const overdue = await db.select({
      id: hostelLeavePasses.id,
      allocationId: hostelLeavePasses.allocationId,
      expectedReturnAt: hostelLeavePasses.expectedReturnAt,
    })
    .from(hostelLeavePasses)
    .where(and(
      eq(hostelLeavePasses.tenantId, tenantId),
      eq(hostelLeavePasses.status, 'approved'),
      lt(hostelLeavePasses.expectedReturnAt, now),
    ));
  for (const pass of overdue) {
    await insertEscalationIfAbsent(tenantId, {
      allocationId: pass.allocationId,
      escalationType: 'overdue_return',
      triggerDate: dateString(new Date(pass.expectedReturnAt)),
      tier: 3,
      recipientType: 'guardian',
      channel: 'log',
      idempotencyKey: `overdue_return:${pass.id}:${dateString(new Date(pass.expectedReturnAt))}`,
    });
    created.overdue_return += 1;
  }

  return created;
}
