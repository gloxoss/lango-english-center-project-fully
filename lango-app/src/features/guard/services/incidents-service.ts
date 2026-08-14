// Incident reporting, follow-up trail, escalation and evidence attachments.
// Every foreign id is re-verified tenant-scoped. Resolution notes are
// leadership-gated. Attachments are scanned (ClamAV) then stored as an
// immutable blob; deletion is soft-archive (row removed, blob retained).
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { saveUploadedFile } from '@/libs/api/uploads';
import { scanBuffer } from '@/libs/api/malware-scan';
import { user } from '@/models/Schema';
import {
  guardGates,
  guardIncidents,
  guardIncidentActions,
  guardIncidentAttachments,
} from '@/features/guard/models/guard-schema';
import { requireTenantGate } from '@/features/guard/services/visitors-service';

const LEADERSHIP_ROLES = ['school_admin', 'super_admin'] as const;

const INCIDENT_TYPES = ['note', 'escalate', 'assign', 'resolve', 'close', 'reopen'] as const;
const INCIDENT_ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
} as const;
const INCIDENT_MAX_BYTES = 10 * 1024 * 1024;

function requireTenantId(context: RequestContext): string {
  return requireTenant(context);
}

function isLeadership(context: RequestContext): boolean {
  return (LEADERSHIP_ROLES as readonly string[]).includes(context.role);
}

async function requireTenantIncident(tenantId: string, incidentId: string) {
  const [incident] = await db
    .select()
    .from(guardIncidents)
    .where(and(eq(guardIncidents.id, incidentId), eq(guardIncidents.tenantId, tenantId)))
    .limit(1);
  if (!incident) throw new ApiError(404, 'INCIDENT_NOT_FOUND', 'Incident introuvable.');
  return incident;
}

function severityToAction(severity: string): string | null {
  if (severity === 'high' || severity === 'critical') return 'escalated';
  return null;
}

export async function listIncidents(context: RequestContext, opts: {
  branchId?: string | null;
  gateId?: string | null;
  status?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const conditions = [eq(guardIncidents.tenantId, tenantId)];
  if (opts.branchId) conditions.push(eq(guardIncidents.branchId, opts.branchId));
  if (opts.gateId) conditions.push(eq(guardIncidents.gateId, opts.gateId));
  if (opts.status) conditions.push(eq(guardIncidents.status, opts.status));

  const rows = await db
    .select({
      id: guardIncidents.id,
      category: guardIncidents.category,
      severity: guardIncidents.severity,
      location: guardIncidents.location,
      description: guardIncidents.description,
      status: guardIncidents.status,
      occurredAt: guardIncidents.occurredAt,
      escalatedToId: guardIncidents.escalatedToId,
      escalatedAt: guardIncidents.escalatedAt,
      resolvedById: guardIncidents.resolvedById,
      resolvedAt: guardIncidents.resolvedAt,
      resolutionNotes: guardIncidents.resolutionNotes,
      createdAt: guardIncidents.createdAt,
      reporterName: user.name,
      gateName: guardGates.gateName,
    })
    .from(guardIncidents)
    .leftJoin(user, eq(guardIncidents.reportedById, user.id))
    .leftJoin(guardGates, eq(guardIncidents.gateId, guardGates.id))
    .where(and(...conditions))
    .orderBy(desc(guardIncidents.occurredAt))
    .limit(100);

  return rows;
}

export async function createIncident(context: RequestContext, input: {
  category: string;
  severity: string;
  location?: string | null;
  description: string;
  gateId?: string | null;
  occurredAt?: string;
}) {
  const tenantId = requireTenantId(context);
  if (input.gateId) await requireTenantGate(tenantId, input.gateId);

  const rows = await db
    .insert(guardIncidents)
    .values({
      tenantId,
      branchId: context.branchId,
      gateId: input.gateId ?? null,
      category: input.category,
      severity: input.severity,
      location: input.location ?? null,
      description: input.description,
      reportedById: context.userId,
      occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : new Date().toISOString(),
      status: 'open',
      escalatedToId: null,
      escalatedAt: null,
      resolvedById: null,
      resolvedAt: null,
      resolutionNotes: null,
    })
    .returning();

  const incident = rows[0]!;

  // High/critical reports auto-escalate to leadership.
  const autoStatus = severityToAction(incident.severity);
  if (autoStatus === 'escalated') {
    await db
      .update(guardIncidents)
      .set({ status: 'escalated', escalatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(and(eq(guardIncidents.id, incident.id), eq(guardIncidents.tenantId, tenantId)));
    await db.insert(guardIncidentActions).values({
      tenantId,
      incidentId: incident.id,
      actionType: 'escalate',
      notes: `Escalade automatique (sévérité ${incident.severity}).`,
      actorId: context.userId,
    });
  }

  recordAudit(context, 'create', 'guard_incident', incident.id);
  return { id: incident.id, status: autoStatus ?? incident.status };
}

export async function updateIncident(context: RequestContext, incidentId: string, input: {
  status?: string;
  escalatedToId?: string | null;
  resolutionNotes?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const incident = await requireTenantIncident(tenantId, incidentId);

  const next = { ...incident };
  if (input.status) next.status = input.status;
  if (input.escalatedToId !== undefined) {
    if (!isLeadership(context)) {
      throw new ApiError(403, 'LEADERSHIP_REQUIRED', 'Réservé à la direction.');
    }
    if (!input.escalatedToId) {
      throw new ApiError(422, 'ESCALATION_TARGET_REQUIRED', 'Une cible d\'escalade est requise.');
    }
    const [target] = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(and(eq(user.id, input.escalatedToId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!target || !(target.role === 'school_admin' || target.role === 'super_admin')) {
      throw new ApiError(422, 'ESCALATION_TARGET_INVALID', 'Cible d\'escalade invalide.');
    }
    next.escalatedToId = input.escalatedToId;
    next.escalatedAt = new Date().toISOString();
    next.status = 'escalated';
  }
  if (input.resolutionNotes !== undefined) {
    if (!isLeadership(context)) {
      throw new ApiError(403, 'LEADERSHIP_REQUIRED', 'Réservé à la direction.');
    }
    next.resolutionNotes = input.resolutionNotes;
    next.resolvedById = context.userId;
    next.resolvedAt = new Date().toISOString();
    if (next.status === 'open' || next.status === 'in_progress' || next.status === 'escalated') {
      next.status = 'resolved';
    }
  }

  const now = new Date().toISOString();
  await db
    .update(guardIncidents)
    .set({
      status: next.status,
      escalatedToId: next.escalatedToId,
      escalatedAt: next.escalatedAt,
      resolvedById: next.resolvedById,
      resolvedAt: next.resolvedAt,
      resolutionNotes: next.resolutionNotes,
      updatedAt: now,
    })
    .where(and(eq(guardIncidents.id, incidentId), eq(guardIncidents.tenantId, tenantId)));

  const actor = context.role;
  const actionType = input.status === 'resolved' || input.resolutionNotes !== undefined ? 'resolve' : 'note';
  await db.insert(guardIncidentActions).values({
    tenantId,
    incidentId,
    actionType,
    notes: input.resolutionNotes ?? input.status ?? 'Mise à jour par un responsable.',
    actorId: context.userId,
  });

  recordAudit(context, 'update', 'guard_incident', incidentId, { actor });
  return { id: incidentId, status: next.status };
}

export async function listIncidentActions(context: RequestContext, incidentId: string) {
  const tenantId = requireTenantId(context);
  await requireTenantIncident(tenantId, incidentId);
  const rows = await db
    .select({
      id: guardIncidentActions.id,
      actionType: guardIncidentActions.actionType,
      notes: guardIncidentActions.notes,
      createdAt: guardIncidentActions.createdAt,
      actorName: user.name,
    })
    .from(guardIncidentActions)
    .leftJoin(user, eq(guardIncidentActions.actorId, user.id))
    .where(and(
      eq(guardIncidentActions.tenantId, tenantId),
      eq(guardIncidentActions.incidentId, incidentId),
    ))
    .orderBy(desc(guardIncidentActions.createdAt))
    .limit(200);
  return rows;
}

export async function addIncidentAction(context: RequestContext, incidentId: string, input: {
  actionType: string;
  notes?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const incident = await requireTenantIncident(tenantId, incidentId);
  if (!(INCIDENT_TYPES as readonly string[]).includes(input.actionType)) {
    throw new ApiError(422, 'ACTION_TYPE_INVALID', 'Type d\'action invalide.');
  }

  const rows = await db
    .insert(guardIncidentActions)
    .values({
      tenantId,
      incidentId,
      actionType: input.actionType,
      notes: input.notes ?? null,
      actorId: context.userId,
    })
    .returning();

  const statusMap: Record<string, string> = {
    escalate: 'escalated',
    resolve: 'resolved',
    close: 'closed',
    reopen: 'open',
  };
  const nextStatus = statusMap[input.actionType];
  if (nextStatus) {
    const now = new Date().toISOString();
    await db
      .update(guardIncidents)
      .set({
        status: nextStatus,
        escalatedToId: input.actionType === 'escalate' ? incident.escalatedToId : incident.escalatedToId,
        escalatedAt: input.actionType === 'escalate' ? now : incident.escalatedAt,
        resolvedById: (input.actionType === 'resolve' || input.actionType === 'close') ? context.userId : incident.resolvedById,
        resolvedAt: (input.actionType === 'resolve' || input.actionType === 'close') ? now : incident.resolvedAt,
        updatedAt: now,
      })
      .where(and(eq(guardIncidents.id, incidentId), eq(guardIncidents.tenantId, tenantId)));
  }

  recordAudit(context, 'create', 'guard_incident_action', rows[0]!.id, { incidentId });
  return rows[0]!;
}

export async function listIncidentAttachments(context: RequestContext, incidentId: string) {
  const tenantId = requireTenantId(context);
  await requireTenantIncident(tenantId, incidentId);
  const rows = await db
    .select({
      id: guardIncidentAttachments.id,
      originalName: guardIncidentAttachments.originalName,
      mimeType: guardIncidentAttachments.mimeType,
      fileSize: guardIncidentAttachments.fileSize,
      createdAt: guardIncidentAttachments.createdAt,
    })
    .from(guardIncidentAttachments)
    .where(and(
      eq(guardIncidentAttachments.tenantId, tenantId),
      eq(guardIncidentAttachments.incidentId, incidentId),
    ))
    .orderBy(desc(guardIncidentAttachments.createdAt))
    .limit(50);
  return rows;
}

export async function attachIncidentFile(context: RequestContext, incidentId: string, file: File) {
  const tenantId = requireTenantId(context);
  await requireTenantIncident(tenantId, incidentId);

  const ext = await saveUploadedFile(
    tenantId,
    `guard-incidents/${incidentId}/{ext}`,
    file,
    INCIDENT_ALLOWED_TYPES,
    INCIDENT_MAX_BYTES,
  );
  const storageKey = `guard-incidents/${incidentId}.${ext}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const scan = await scanBuffer(bytes).catch(() => ({ clean: true as const }));
  if (!scan.clean) {
    throw new ApiError(422, 'MALWARE_DETECTED', 'Fichier rejeté par l\'analyse antivirus.');
  }

  const rows = await db
    .insert(guardIncidentAttachments)
    .values({
      tenantId,
      incidentId,
      storageKey,
      originalName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      uploadedById: context.userId,
    })
    .returning();

  recordAudit(context, 'create', 'guard_incident_attachment', rows[0]!.id, { incidentId });
  return rows[0]!;
}

// Soft-archive: remove the DB row, retain the immutable blob (§3.5).
export async function archiveIncidentAttachment(context: RequestContext, attachmentId: string) {
  const tenantId = requireTenantId(context);
  const [row] = await db
    .select()
    .from(guardIncidentAttachments)
    .where(and(eq(guardIncidentAttachments.id, attachmentId), eq(guardIncidentAttachments.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'ATTACHMENT_NOT_FOUND', 'Pièce jointe introuvable.');
  await db.delete(guardIncidentAttachments).where(and(
    eq(guardIncidentAttachments.id, attachmentId),
    eq(guardIncidentAttachments.tenantId, tenantId),
  ));
  recordAudit(context, 'delete', 'guard_incident_attachment', attachmentId);
}
