// Automation engine: birthday wishes for students/staff. A run is idempotent
// per (tenant, automation, runDate); recipients are dedup'd per
// (tenant, run, person, channel) so re-triggering the same day never
// double-sends. Consent/suppression is applied at snapshot time and re-checked
// at dispatch (outbox-worker). Student birthdays contact the guardian.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  communicationAutomationRecipients,
  communicationAutomationRuns,
  communicationAutomations,
  communicationConnections,
  user,
} from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';
import { STAFF_ROLES } from './segments-service';
import { checkConsent } from './consent-service';
import { getPublishedVersion } from './templates-service';
import { getProvider } from '../providers/provider';
import '../providers/test-provider';
import type { broadcastChannel } from '../models/broadcast-schema';

type Channel = (typeof broadcastChannel.enumValues)[number];

const KIND_TO_ROLE: Record<string, { role: string; recipientKind: string }> = {
  birthday_student: { role: 'student', recipientKind: 'student' },
  birthday_staff: { role: 'staff', recipientKind: 'staff' },
};

export function automationPublic(a: typeof communicationAutomations.$inferSelect) {
  return {
    id: a.id,
    tenantId: a.tenantId,
    branchId: a.branchId,
    name: a.name,
    kind: a.kind,
    channel: a.channel,
    connectionId: a.connectionId,
    templateId: a.templateId,
    audienceKind: a.audienceKind,
    timezone: a.timezone,
    sendTime: a.sendTime,
    quietHoursStart: a.quietHoursStart,
    quietHoursEnd: a.quietHoursEnd,
    approvalMode: a.approvalMode,
    isActive: a.isActive,
    nextRunAt: a.nextRunAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export type AutomationInput = {
  name: string;
  kind: string;
  channel: Channel;
  connectionId: string;
  templateId: string;
  timezone?: string;
  sendTime: string;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  approvalMode?: string;
  isActive?: boolean;
};

async function getAutomationRow(tenantId: string, id: string) {
  const [a] = await db
    .select()
    .from(communicationAutomations)
    .where(and(eq(communicationAutomations.id, id), eq(communicationAutomations.tenantId, tenantId)))
    .limit(1);
  if (!a) throw new ApiError(404, 'NOT_FOUND', 'Automation introuvable.');
  return a;
}

export async function listAutomations(tenantId: string) {
  const rows = await db
    .select()
    .from(communicationAutomations)
    .where(eq(communicationAutomations.tenantId, tenantId))
    .orderBy(asc(communicationAutomations.createdAt));
  return rows.map(automationPublic);
}

export async function getAutomation(tenantId: string, id: string) {
  return automationPublic(await getAutomationRow(tenantId, id));
}

export async function createAutomation(tenantId: string, body: AutomationInput, actorId: string | null) {
  if (!body.name?.trim()) throw new ApiError(422, 'VALIDATION_ERROR', 'Le nom de l\'automation est requis.');
  const kindInfo = KIND_TO_ROLE[body.kind];
  if (!kindInfo) throw new ApiError(422, 'VALIDATION_ERROR', 'Type d\'automation invalide.');
  if (!/^\d{2}:\d{2}$/.test(body.sendTime ?? '')) throw new ApiError(422, 'VALIDATION_ERROR', 'Heure d\'envoi invalide (HH:MM).');
  await assertAutomationConnection(tenantId, body.connectionId, body.channel);
  if (body.templateId) {
    const published = await getPublishedVersion(tenantId, body.templateId);
    if (!published) throw new ApiError(422, 'VALIDATION_ERROR', 'Le modèle sélectionné n\'a pas de version publiée.');
  }
  const [inserted] = await db
    .insert(communicationAutomations)
    .values({
      tenantId,
      name: body.name.trim(),
      kind: body.kind as any,
      channel: body.channel,
      connectionId: body.connectionId,
      templateId: body.templateId,
      audienceKind: kindInfo.role,
      timezone: body.timezone ?? 'Africa/Casablanca',
      sendTime: body.sendTime,
      quietHoursStart: body.quietHoursStart ?? null,
      quietHoursEnd: body.quietHoursEnd ?? null,
      approvalMode: body.approvalMode ?? 'auto',
      isActive: body.isActive ?? true,
      createdBy: actorId,
    })
    .returning();
  if (!inserted) throw new ApiError(500, 'INTERNAL', 'Création de l\'automation impossible.');
  return automationPublic(inserted);
}

export async function updateAutomation(tenantId: string, id: string, patch: Partial<AutomationInput>) {
  await getAutomationRow(tenantId, id);
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.channel !== undefined) set.channel = patch.channel;
  if (patch.connectionId !== undefined) set.connectionId = patch.connectionId;
  if (patch.templateId !== undefined) set.templateId = patch.templateId;
  if (patch.timezone !== undefined) set.timezone = patch.timezone;
  if (patch.sendTime !== undefined) set.sendTime = patch.sendTime;
  if (patch.quietHoursStart !== undefined) set.quietHoursStart = patch.quietHoursStart;
  if (patch.quietHoursEnd !== undefined) set.quietHoursEnd = patch.quietHoursEnd;
  if (patch.approvalMode !== undefined) set.approvalMode = patch.approvalMode;
  if (patch.isActive !== undefined) set.isActive = patch.isActive;
  set.updatedAt = new Date().toISOString();
  const [updated] = await db
    .update(communicationAutomations)
    .set(set as any)
    .where(and(eq(communicationAutomations.id, id), eq(communicationAutomations.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Automation introuvable.');
  return automationPublic(updated);
}

export async function toggleAutomation(tenantId: string, id: string) {
  const a = await getAutomationRow(tenantId, id);
  const [updated] = await db
    .update(communicationAutomations)
    .set({ isActive: !a.isActive, updatedAt: new Date().toISOString() })
    .where(and(eq(communicationAutomations.id, id), eq(communicationAutomations.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Automation introuvable.');
  return automationPublic(updated);
}

export async function deleteAutomation(tenantId: string, id: string) {
  await getAutomationRow(tenantId, id);
  await db
    .delete(communicationAutomations)
    .where(and(eq(communicationAutomations.id, id), eq(communicationAutomations.tenantId, tenantId)));
}

async function assertAutomationConnection(tenantId: string, connectionId: string, channel: Channel) {
  const [conn] = await db
    .select({ id: communicationConnections.id, channel: communicationConnections.channel, provider: communicationConnections.provider })
    .from(communicationConnections)
    .where(and(eq(communicationConnections.id, connectionId), eq(communicationConnections.tenantId, tenantId)))
    .limit(1);
  if (!conn) throw new ApiError(404, 'NOT_FOUND', 'Connexion introuvable.');
  if (conn.channel !== channel) throw new ApiError(422, 'VALIDATION_ERROR', 'La connexion ne correspond pas au canal.');
  if (!getProvider(conn.provider)) throw new ApiError(422, 'VALIDATION_ERROR', `Fournisseur « ${conn.provider} » inconnu.`);
}

// ---------------------------------------------------------------------------
// Run: compute birthday recipients for a given date (idempotent per day)
// ---------------------------------------------------------------------------

export type AutomationRunResult = {
  runId: string;
  alreadyRan: boolean;
  queuedCount: number;
  skippedCount: number;
  failedCount: number;
};

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthDay(yyyymmdd: string) {
  return { mm: yyyymmdd.slice(5, 7), dd: yyyymmdd.slice(8, 10) };
}

export async function runAutomation(tenantId: string, automationId: string, runDate?: string): Promise<AutomationRunResult> {
  const a = await getAutomationRow(tenantId, automationId);
  const date = runDate ?? todayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(422, 'VALIDATION_ERROR', 'Date invalide (YYYY-MM-DD).');

  const [run] = await db
    .insert(communicationAutomationRuns)
    .values({ tenantId, automationId, runDate: date, status: 'pending' })
    .onConflictDoNothing()
    .returning();

  if (!run) {
    const [existing] = await db
      .select()
      .from(communicationAutomationRuns)
      .where(and(
        eq(communicationAutomationRuns.tenantId, tenantId),
        eq(communicationAutomationRuns.automationId, automationId),
        eq(communicationAutomationRuns.runDate, date),
      ))
      .limit(1);
    return { runId: existing?.id ?? '', alreadyRan: true, queuedCount: 0, skippedCount: 0, failedCount: 0 };
  }

  const roleInfo = KIND_TO_ROLE[a.kind];
  if (!roleInfo) throw new ApiError(422, 'VALIDATION_ERROR', 'Type d\'automation invalide.');
  const { mm, dd } = monthDay(date);
  const roleFilter = roleInfo.role === 'staff' ? inArray(user.role, STAFF_ROLES as any) : eq(user.role, 'student');

  const persons = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(
      eq(user.tenantId, tenantId),
      eq(user.userStatus, 'active'),
      roleFilter,
      sql`to_char(${user.dateOfBirth}, 'MM-DD') = ${`${mm}-${dd}`}`,
    ));

  let queuedCount = 0;
  let skippedCount = 0;
  for (const p of persons) {
    const consent = await checkConsent(tenantId, roleInfo.recipientKind as any, p.id, a.channel);
    const status = consent.reason === 'ok' ? 'queued' : 'skipped';
    const inserted = await db
      .insert(communicationAutomationRecipients)
      .values({
        tenantId,
        runId: run.id,
        personId: p.id,
        channel: a.channel,
        status: status as any,
        skipReason: consent.reason === 'ok' ? null : consent.reason,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 1) {
      if (status === 'queued') queuedCount += 1;
      else skippedCount += 1;
    }
  }

  await db
    .update(communicationAutomationRuns)
    .set({
      status: 'completed',
      createdCount: persons.length,
      queuedCount,
      skippedCount,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    })
    .where(eq(communicationAutomationRuns.id, run.id));

  return { runId: run.id, alreadyRan: false, queuedCount, skippedCount, failedCount: 0 };
}

export async function listAutomationRuns(tenantId: string, automationId: string) {
  await getAutomationRow(tenantId, automationId);
  const rows = await db
    .select()
    .from(communicationAutomationRuns)
    .where(and(
      eq(communicationAutomationRuns.tenantId, tenantId),
      eq(communicationAutomationRuns.automationId, automationId),
    ))
    .orderBy(desc(communicationAutomationRuns.runDate));
  return rows.map((r) => ({
    id: r.id,
    runDate: r.runDate,
    status: r.status,
    createdCount: r.createdCount,
    queuedCount: r.queuedCount,
    skippedCount: r.skippedCount,
    failedCount: r.failedCount,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
  }));
}

export async function listAutomationRecipients(tenantId: string, runId: string) {
  const [run] = await db
    .select()
    .from(communicationAutomationRuns)
    .where(and(eq(communicationAutomationRuns.id, runId), eq(communicationAutomationRuns.tenantId, tenantId)))
    .limit(1);
  if (!run) throw new ApiError(404, 'NOT_FOUND', 'Exécution introuvable.');
  const rows = await db
    .select()
    .from(communicationAutomationRecipients)
    .where(and(
      eq(communicationAutomationRecipients.tenantId, tenantId),
      eq(communicationAutomationRecipients.runId, runId),
    ))
    .orderBy(asc(communicationAutomationRecipients.createdAt));
  return rows.map((r) => ({
    id: r.id,
    personId: r.personId,
    channel: r.channel,
    status: r.status,
    skipReason: r.skipReason,
    createdAt: r.createdAt,
  }));
}
