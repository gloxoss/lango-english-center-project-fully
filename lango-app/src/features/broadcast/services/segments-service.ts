import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { communicationSegments, guardians, inquiries, user } from '@/models/Schema';
import type { communicationRecipientKind } from '../models/broadcast-schema';
import { ApiError } from '@/libs/api/errors';

export type RecipientKind = (typeof communicationRecipientKind.enumValues)[number];

export type SegmentRecipient = {
  recipientKind: RecipientKind;
  recipientId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type SegmentFilters = {
  status?: string | null;
  source?: string | null;
  interestLevel?: string | null;
  assignedToId?: string | null;
  tag?: string | null;
  role?: string | null;
  userStatus?: string | null;
  classSectionId?: string | null;
  branchId?: string | null;
  hasPhone?: boolean | null;
  hasEmail?: boolean | null;
  /** For student audiences: contact the guardian instead of the student. */
  contactByGuardian?: boolean | null;
};

export type SegmentDefinition = {
  kind: RecipientKind;
  filters?: SegmentFilters;
};

export const STAFF_ROLES = ['school_admin', 'teacher', 'accountant', 'receptionist', 'guard', 'librarian'];

const RECIPIENT_KINDS: RecipientKind[] = ['inquiry', 'student', 'guardian', 'staff', 'alumni', 'external'];

/** Pure validation of a segment definition (also used by the UI). */
export function parseSegmentDefinition(raw: unknown): SegmentDefinition {
  const d = (raw ?? {}) as Partial<SegmentDefinition>;
  if (!d.kind || !RECIPIENT_KINDS.includes(d.kind as RecipientKind)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Type de segment invalide.');
  }
  const f = d.filters ?? {};
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
  return {
    kind: d.kind as RecipientKind,
    filters: {
      status: str(f.status),
      source: str(f.source),
      interestLevel: str(f.interestLevel),
      assignedToId: str(f.assignedToId),
      tag: str(f.tag),
      role: str(f.role),
      userStatus: str(f.userStatus),
      classSectionId: str(f.classSectionId),
      branchId: str(f.branchId),
      hasPhone: bool(f.hasPhone),
      hasEmail: bool(f.hasEmail),
      contactByGuardian: bool(f.contactByGuardian),
    },
  };
}

function sqlNotNull(col: any) {
  return sql`${col} IS NOT NULL`;
}
function sqlIsNull(col: any) {
  return sql`${col} IS NULL`;
}

/**
 * Compute the live recipient list for a segment definition. Tenant-scoped.
 * Kind → source table:
 *   inquiry  → inquiries             student/staff/alumni → user (role-based)
 *   guardian → guardians
 */
export async function computeSegment(
  tenantId: string,
  definition: SegmentDefinition,
  opts: { limit?: number } = {},
): Promise<{ recipients: SegmentRecipient[]; total: number }> {
  const f = definition.filters ?? {};
  const limit = opts.limit;

  if (definition.kind === 'inquiry') {
    const conditions: any[] = [eq(inquiries.tenantId, tenantId)];
    if (f.status) conditions.push(eq(inquiries.status, f.status as any));
    if (f.source) conditions.push(eq(inquiries.source, f.source as any));
    if (f.interestLevel) conditions.push(eq(inquiries.interestLevel, f.interestLevel as any));
    if (f.assignedToId) conditions.push(eq(inquiries.assignedToId, f.assignedToId));
    if (f.tag) conditions.push(sql`${inquiries.tags} @> ARRAY[${f.tag}]::text[]`);
    if (f.hasPhone !== undefined) conditions.push(f.hasPhone ? sqlNotNull(inquiries.phone) : sqlIsNull(inquiries.phone));
    if (f.hasEmail !== undefined) conditions.push(f.hasEmail ? sqlNotNull(inquiries.email) : sqlIsNull(inquiries.email));
    const rows = await db
      .select({ id: inquiries.id, contactName: inquiries.contactName, phone: inquiries.phone, email: inquiries.email })
      .from(inquiries)
      .where(and(...conditions))
      .orderBy(inquiries.createdAt)
      .limit(limit ?? 1000);
    return {
      total: rows.length,
      recipients: rows.map((r) => ({
        recipientKind: 'inquiry',
        recipientId: r.id,
        name: r.contactName,
        phone: r.phone,
        email: r.email,
      })),
    };
  }

  if (definition.kind === 'student' || definition.kind === 'staff' || definition.kind === 'alumni') {
    const conditions: any[] = [eq(user.tenantId, tenantId)];
    if (definition.kind === 'student') conditions.push(eq(user.role, 'student'));
    else if (definition.kind === 'staff') conditions.push(inArray(user.role, STAFF_ROLES as any));
    else conditions.push(eq(user.role, 'alumni'));
    if (f.role && definition.kind === 'staff') conditions.push(eq(user.role, f.role as any));
    if (f.userStatus) conditions.push(eq(user.userStatus, f.userStatus as any));
    if (f.classSectionId) conditions.push(eq(user.classSectionId, f.classSectionId));
    if (f.branchId) conditions.push(eq(user.branchId, f.branchId));
    if (f.hasPhone !== undefined) conditions.push(f.hasPhone ? sqlNotNull(user.phone) : sqlIsNull(user.phone));
    if (f.hasEmail !== undefined) conditions.push(f.hasEmail ? sqlNotNull(user.email) : sqlIsNull(user.email));
    const contactByGuardian = f.contactByGuardian ?? false;
    const rows = await db
      .select({ id: user.id, name: user.name, phone: user.phone, email: user.email, guardianPhone: user.guardianPhone, guardianEmail: user.guardianEmail })
      .from(user)
      .where(and(...conditions))
      .limit(limit ?? 1000);
    return {
      total: rows.length,
      recipients: rows.map((r) => ({
        recipientKind: definition.kind as RecipientKind,
        recipientId: r.id,
        name: r.name,
        phone: contactByGuardian ? r.guardianPhone : r.phone,
        email: contactByGuardian ? r.guardianEmail : r.email,
      })),
    };
  }

  if (definition.kind === 'guardian') {
    const conditions: any[] = [eq(guardians.tenantId, tenantId)];
    if (f.hasPhone !== undefined) conditions.push(f.hasPhone ? sqlNotNull(guardians.phone) : sqlIsNull(guardians.phone));
    if (f.hasEmail !== undefined) conditions.push(f.hasEmail ? sqlNotNull(guardians.email) : sqlIsNull(guardians.email));
    const rows = await db
      .select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName, phone: guardians.phone, email: guardians.email })
      .from(guardians)
      .where(and(...conditions))
      .limit(limit ?? 1000);
    return {
      total: rows.length,
      recipients: rows.map((r) => ({
        recipientKind: 'guardian',
        recipientId: r.id,
        name: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
        phone: r.phone,
        email: r.email,
      })),
    };
  }

  return { recipients: [], total: 0 };
}

// ---------------------------------------------------------------------------
// Segment CRUD (definitions stored as jsonb, membership computed live)
// ---------------------------------------------------------------------------

export function segmentPublic(s: typeof communicationSegments.$inferSelect) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    branchId: s.branchId,
    name: s.name,
    description: s.description,
    definition: s.definition,
    memberCount: s.memberCount,
    lastComputedAt: s.lastComputedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export async function listSegments(tenantId: string) {
  const rows = await db
    .select()
    .from(communicationSegments)
    .where(eq(communicationSegments.tenantId, tenantId))
    .orderBy(communicationSegments.updatedAt);
  return rows.map(segmentPublic);
}

export async function getSegment(tenantId: string, id: string) {
  const [s] = await db
    .select()
    .from(communicationSegments)
    .where(and(eq(communicationSegments.id, id), eq(communicationSegments.tenantId, tenantId)))
    .limit(1);
  if (!s) throw new ApiError(404, 'NOT_FOUND', 'Segment introuvable.');
  return s;
}

export async function createSegment(tenantId: string, body: { name: string; description?: string; definition: unknown }, actorId: string | null) {
  if (!body.name?.trim()) throw new ApiError(422, 'VALIDATION_ERROR', 'Le nom du segment est requis.');
  const definition = parseSegmentDefinition(body.definition);
  const rows = await db
    .insert(communicationSegments)
    .values({
      tenantId,
      name: body.name.trim(),
      description: body.description ?? null,
      definition: definition as any,
      createdBy: actorId,
    })
    .onConflictDoNothing()
    .returning();
  const inserted = rows[0];
  if (!inserted) throw new ApiError(409, 'CONFLICT', 'Un segment portant ce nom existe déjà.');
  const count = await refreshSegmentCount(tenantId, inserted.id);
  return { ...segmentPublic(inserted), memberCount: count };
}

export async function updateSegment(tenantId: string, id: string, body: { name?: string; description?: string; definition?: unknown }) {
  await getSegment(tenantId, id);
  const set: Record<string, unknown> = {};
  if (body.name !== undefined) set.name = body.name.trim();
  if (body.description !== undefined) set.description = body.description;
  if (body.definition !== undefined) set.definition = parseSegmentDefinition(body.definition) as any;
  set.updatedAt = new Date().toISOString();
  const [updated] = await db
    .update(communicationSegments)
    .set(set as any)
    .where(and(eq(communicationSegments.id, id), eq(communicationSegments.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Segment introuvable.');
  const count = await refreshSegmentCount(tenantId, updated.id);
  return { ...segmentPublic(updated), memberCount: count };
}

export async function deleteSegment(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(communicationSegments)
    .where(and(eq(communicationSegments.id, id), eq(communicationSegments.tenantId, tenantId)))
    .returning({ id: communicationSegments.id });
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Segment introuvable.');
}

/** Recompute the live member count and store it on the segment row. */
export async function refreshSegmentCount(tenantId: string, id: string): Promise<number> {
  const s = await getSegment(tenantId, id);
  const { total } = await computeSegment(tenantId, parseSegmentDefinition(s.definition), { limit: 10000 });
  await db
    .update(communicationSegments)
    .set({ memberCount: total, lastComputedAt: new Date().toISOString() })
    .where(eq(communicationSegments.id, id));
  return total;
}

/** Live preview of a segment (no persistence). */
export async function previewSegment(tenantId: string, definition: unknown, opts: { limit?: number } = {}) {
  const parsed = parseSegmentDefinition(definition);
  const result = await computeSegment(tenantId, parsed, { limit: opts.limit ?? 50 });
  return { ...result, definition: parsed };
}

/** Name/phone/email search within one audience kind (segment picker). */
export async function searchRecipients(tenantId: string, kind: RecipientKind, q: string, limit = 20): Promise<SegmentRecipient[]> {
  const like = `%${q}%`;
  const sel = (rows: { id: string; name: string | null; phone: string | null; email: string | null }[]) =>
    rows.map((r) => ({ recipientKind: kind, recipientId: r.id, name: r.name, phone: r.phone, email: r.email }));

  if (kind === 'inquiry') {
    const rows = await db
      .select({ id: inquiries.id, contactName: inquiries.contactName, phone: inquiries.phone, email: inquiries.email })
      .from(inquiries)
      .where(and(eq(inquiries.tenantId, tenantId), or(ilike(inquiries.contactName, like), ilike(inquiries.phone, like), ilike(inquiries.email, like)) as any))
      .limit(limit);
    return rows.map((r) => ({ recipientKind: 'inquiry', recipientId: r.id, name: r.contactName, phone: r.phone, email: r.email }));
  }
  if (kind === 'student' || kind === 'staff' || kind === 'alumni') {
    const conditions: any[] = [eq(user.tenantId, tenantId), or(ilike(user.name, like), ilike(user.email, like)) as any];
    if (kind === 'student') conditions.push(eq(user.role, 'student'));
    else if (kind === 'staff') conditions.push(inArray(user.role, STAFF_ROLES as any));
    else conditions.push(eq(user.role, 'alumni'));
    const rows = await db.select({ id: user.id, name: user.name, phone: user.phone, email: user.email }).from(user).where(and(...conditions)).limit(limit);
    return sel(rows);
  }
  return [];
}
