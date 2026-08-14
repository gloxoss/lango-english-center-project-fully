import { and, arrayContains, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { applicants, inquiryFollowUps, inquiries, user } from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';

export const INQUIRY_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_SOURCES = ['walk_in', 'phone', 'web', 'referral', 'facebook_ads', 'google_ads'] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export const INQUIRY_INTEREST_LEVELS = ['low', 'medium', 'high'] as const;
export type InquiryInterestLevel = (typeof INQUIRY_INTEREST_LEVELS)[number];

export const INQUIRY_FOLLOW_UP_TYPES = ['call', 'email', 'meeting', 'note'] as const;
export type InquiryFollowUpType = (typeof INQUIRY_FOLLOW_UP_TYPES)[number];

// Valid forward transitions. 'converted' is terminal and only reachable via the
// convert endpoint (which creates the applicant in the admissions workflow).
// 'lost' may be reopened back to 'new'.
export const INQUIRY_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  new: ['contacted', 'qualified', 'lost'],
  contacted: ['new', 'qualified', 'lost'],
  qualified: ['contacted', 'lost'],
  converted: [],
  lost: ['new'],
};

export type InquiryListFilters = {
  tenantId: string;
  search?: string;
  status?: InquiryStatus;
  source?: InquirySource;
  assignedToId?: string;
  tag?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'contactName' | 'interestLevel';
  sortDir?: 'asc' | 'desc';
  limit: number;
  offset: number;
};

const INTEREST_ORDER = sql`CASE ${inquiries.interestLevel} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END`;

export async function assertInquiryExists(tenantId: string, id: string): Promise<{ id: string }> {
  const [row] = await db
    .select({ id: inquiries.id })
    .from(inquiries)
    .where(and(eq(inquiries.id, id), eq(inquiries.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Prospect introuvable.');
  }
  return row;
}

export async function getPipelineCounts(tenantId: string): Promise<Record<InquiryStatus, number>> {
  const rows = await db
    .select({ status: inquiries.status, count: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(eq(inquiries.tenantId, tenantId))
    .groupBy(inquiries.status);

  const counts: Record<InquiryStatus, number> = { new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };
  for (const r of rows) {
    const status = r.status as InquiryStatus;
    if (status in counts) counts[status] = r.count;
  }
  return counts;
}

export async function listInquiries(filters: InquiryListFilters): Promise<{ data: typeof inquiries.$inferSelect[]; total: number }> {
  const conditions = [eq(inquiries.tenantId, filters.tenantId)];
  if (filters.status) conditions.push(eq(inquiries.status, filters.status as any));
  if (filters.source) conditions.push(eq(inquiries.source, filters.source as any));
  if (filters.assignedToId) conditions.push(eq(inquiries.assignedToId, filters.assignedToId));
  if (filters.tag) conditions.push(arrayContains(inquiries.tags, [filters.tag]));
  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions.push(
      or(ilike(inquiries.contactName, q), ilike(inquiries.phone, q), ilike(inquiries.email, q)) as any,
    );
  }

  const where = and(...conditions);
  const orderColumn =
    filters.sortBy === 'contactName'
      ? inquiries.contactName
      : filters.sortBy === 'updatedAt'
        ? inquiries.updatedAt
        : inquiries.createdAt;
  const order = filters.sortDir === 'asc' ? asc(orderColumn) : desc(orderColumn);
  const orderByClauses = filters.sortBy === 'interestLevel' ? [INTEREST_ORDER, order] : [order];

  const [data, totalRows] = await Promise.all([
    db
      .select()
      .from(inquiries)
      .where(where)
      .orderBy(...orderByClauses)
      .limit(filters.limit)
      .offset(filters.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(inquiries).where(where),
  ]);

  return { data, total: totalRows[0]?.count ?? 0 };
}

export async function getInquiry(tenantId: string, id: string) {
  const [row] = await db
    .select({
      id: inquiries.id,
      tenantId: inquiries.tenantId,
      contactName: inquiries.contactName,
      phone: inquiries.phone,
      email: inquiries.email,
      source: inquiries.source,
      interestLevel: inquiries.interestLevel,
      status: inquiries.status,
      assignedToId: inquiries.assignedToId,
      notes: inquiries.notes,
      tags: inquiries.tags,
      convertedApplicantId: inquiries.convertedApplicantId,
      createdAt: inquiries.createdAt,
      updatedAt: inquiries.updatedAt,
      assignedToName: user.name,
    })
    .from(inquiries)
    .leftJoin(user, eq(user.id, inquiries.assignedToId))
    .where(and(eq(inquiries.id, id), eq(inquiries.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Prospect introuvable.');
  }
  const { assignedToName, assignedToId, ...rest } = row;
  return { ...rest, assignedTo: assignedToId ? { id: assignedToId, name: assignedToName ?? null } : null };
}

export type CreateInquiryInput = {
  contactName: string;
  phone?: string;
  email?: string;
  source: InquirySource;
  interestLevel?: InquiryInterestLevel;
  notes?: string;
  assignedToId?: string;
  tags?: string[];
};

export async function createInquiry(tenantId: string, body: CreateInquiryInput) {
  const [inserted] = await db
    .insert(inquiries)
    .values({
      tenantId,
      contactName: body.contactName,
      phone: body.phone ?? null,
      email: body.email ?? null,
      source: body.source as any,
      interestLevel: body.interestLevel as any ?? 'medium',
      notes: body.notes ?? null,
      assignedToId: body.assignedToId ?? null,
      tags: body.tags ?? [],
      status: 'new',
    })
    .returning();
  if (!inserted) {
    throw new ApiError(500, 'INTERNAL', 'Création du prospect impossible.');
  }
  return inserted;
}

export type UpdateInquiryInput = {
  status?: InquiryStatus;
  contactName?: string;
  phone?: string | null;
  email?: string | null;
  source?: InquirySource;
  interestLevel?: InquiryInterestLevel;
  assignedToId?: string | null;
  notes?: string | null;
  tags?: string[];
};

export async function updateInquiry(tenantId: string, id: string, body: UpdateInquiryInput) {
  const [existing] = await db
    .select({ status: inquiries.status })
    .from(inquiries)
    .where(and(eq(inquiries.id, id), eq(inquiries.tenantId, tenantId)))
    .limit(1);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Prospect introuvable.');
  }
  if (body.status && body.status !== existing.status) {
    if (body.status === 'converted') {
      throw new ApiError(422, 'USE_CONVERT_ENDPOINT', 'La conversion passe par l\'endpoint de conversion vers le workflow d\'admission.');
    }
    const allowed = INQUIRY_TRANSITIONS[existing.status as InquiryStatus] ?? [];
    if (!allowed.includes(body.status)) {
      throw new ApiError(422, 'INVALID_TRANSITION', `Transition ${existing.status} → ${body.status} non autorisée.`);
    }
  }

  const [updated] = await db
    .update(inquiries)
    .set({
      ...(body.status !== undefined && { status: body.status as any }),
      ...(body.contactName !== undefined && { contactName: body.contactName }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.source !== undefined && { source: body.source as any }),
      ...(body.interestLevel !== undefined && { interestLevel: body.interestLevel as any }),
      ...(body.assignedToId !== undefined && { assignedToId: body.assignedToId }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.tags !== undefined && { tags: body.tags }),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(inquiries.id, id), eq(inquiries.tenantId, tenantId)))
    .returning();

  return updated;
}

export async function deleteInquiry(tenantId: string, id: string): Promise<void> {
  const [row] = await db
    .select({ id: inquiries.id, convertedApplicantId: inquiries.convertedApplicantId })
    .from(inquiries)
    .where(and(eq(inquiries.id, id), eq(inquiries.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Prospect introuvable.');
  }
  if (row.convertedApplicantId) {
    throw new ApiError(422, 'CONVERTED_CANNOT_DELETE', 'Un prospect converti en candidat ne peut pas être supprimé.');
  }
  await db.delete(inquiries).where(and(eq(inquiries.id, id), eq(inquiries.tenantId, tenantId)));
}

export async function listFollowUps(tenantId: string, inquiryId: string) {
  await assertInquiryExists(tenantId, inquiryId);
  return db
    .select({
      id: inquiryFollowUps.id,
      type: inquiryFollowUps.type,
      notes: inquiryFollowUps.notes,
      scheduledFor: inquiryFollowUps.scheduledFor,
      completedAt: inquiryFollowUps.completedAt,
      createdById: inquiryFollowUps.createdById,
      createdAt: inquiryFollowUps.createdAt,
      createdByName: user.name,
    })
    .from(inquiryFollowUps)
    .leftJoin(user, eq(user.id, inquiryFollowUps.createdById))
    .where(and(eq(inquiryFollowUps.tenantId, tenantId), eq(inquiryFollowUps.inquiryId, inquiryId)))
    .orderBy(desc(inquiryFollowUps.createdAt));
}

export type AddFollowUpInput = {
  type: InquiryFollowUpType;
  notes: string;
  scheduledFor?: string | null;
};

export async function addFollowUp(tenantId: string, inquiryId: string, body: AddFollowUpInput, actorId: string) {
  await assertInquiryExists(tenantId, inquiryId);
  const [inserted] = await db
    .insert(inquiryFollowUps)
    .values({
      tenantId,
      inquiryId,
      type: body.type as any,
      notes: body.notes,
      scheduledFor: body.scheduledFor ?? null,
      createdById: actorId,
    })
    .returning();
  if (!inserted) {
    throw new ApiError(500, 'INTERNAL', 'Enregistrement du suivi impossible.');
  }
  return inserted;
}

/**
 * Find other inquiries in the same tenant that look like the given one
 * (matching phone OR email). Used by the UI for duplicate detection + safe merge.
 */
export async function findDuplicateCandidates(
  tenantId: string,
  opts: { phone?: string | null; email?: string | null; excludeId?: string },
) {
  if (!opts.phone && !opts.email) {
    return [];
  }
  const clauses: any[] = [];
  if (opts.phone) clauses.push(eq(inquiries.phone, opts.phone));
  if (opts.email) clauses.push(eq(inquiries.email, opts.email));

  const conditions: any[] = [eq(inquiries.tenantId, tenantId)];
  if (opts.excludeId) conditions.push(ne(inquiries.id, opts.excludeId));
  conditions.push(or(...clauses) as any);

  return db
    .select({
      id: inquiries.id,
      contactName: inquiries.contactName,
      phone: inquiries.phone,
      email: inquiries.email,
      source: inquiries.source,
      status: inquiries.status,
      interestLevel: inquiries.interestLevel,
      createdAt: inquiries.createdAt,
      assignedToId: inquiries.assignedToId,
    })
    .from(inquiries)
    .where(and(...conditions))
    .orderBy(desc(inquiries.createdAt))
    .limit(10);
}

/**
 * Merge secondary inquiries into a primary one inside a single transaction:
 * re-point follow-ups, union tags, append notes, then delete the secondaries.
 * Refuses to merge converted inquiries (their applicant link must stay intact).
 */
export async function mergeInquiries(
  context: RequestContext,
  primaryId: string,
  secondaryIds: string[],
) {
  const tenantId = requireTenant(context);
  const uniqueSecondary = [...new Set(secondaryIds)].filter((s) => s !== primaryId);
  if (uniqueSecondary.length === 0) {
    throw new ApiError(422, 'NO_SECONDARY', 'Aucune fiche à fusionner.');
  }

  await db.transaction(async (tx) => {
    const [primary] = await tx
      .select()
      .from(inquiries)
      .where(and(eq(inquiries.id, primaryId), eq(inquiries.tenantId, tenantId)))
      .limit(1);
    if (!primary) {
      throw new ApiError(404, 'NOT_FOUND', 'Fiche principale introuvable.');
    }

    const secondaries = await tx
      .select()
      .from(inquiries)
      .where(and(eq(inquiries.tenantId, tenantId), inArray(inquiries.id, uniqueSecondary)))
      .limit(uniqueSecondary.length);

    if (secondaries.length !== uniqueSecondary.length) {
      throw new ApiError(404, 'NOT_FOUND', 'Certaines fiches à fusionner sont introuvables.');
    }
    if (primary.convertedApplicantId || secondaries.some((s) => s.convertedApplicantId)) {
      throw new ApiError(422, 'CONVERTED_CANNOT_MERGE', 'Une fiche déjà convertie ne peut pas être fusionnée.');
    }

    await tx
      .update(inquiryFollowUps)
      .set({ inquiryId: primaryId })
      .where(and(eq(inquiryFollowUps.tenantId, tenantId), inArray(inquiryFollowUps.inquiryId, uniqueSecondary)));

    const mergedTags = [...new Set([...(primary.tags ?? []), ...secondaries.flatMap((s) => s.tags ?? [])])];
    const mergedNotes = [primary.notes, ...secondaries.map((s) => s.notes).filter((n): n is string => Boolean(n))]
      .filter((n): n is string => Boolean(n))
      .join('\n---\n');

    await tx
      .update(inquiries)
      .set({ tags: mergedTags, notes: mergedNotes || null, updatedAt: new Date().toISOString() })
      .where(and(eq(inquiries.id, primaryId), eq(inquiries.tenantId, tenantId)));

    await tx.delete(inquiries).where(
      and(eq(inquiries.tenantId, tenantId), inArray(inquiries.id, uniqueSecondary)),
    );
  });

  recordAudit(context, 'update', 'inquiry_merge', primaryId, { secondaryIds: uniqueSecondary });
  return getInquiry(tenantId, primaryId);
}

/**
 * Convert an inquiry into an admissions applicant. Idempotent guard: an already
 * converted inquiry returns 422 ALREADY_CONVERTED. Shared by the admissions
 * convert route so the pipeline and the admissions UI behave identically.
 */
export async function convertInquiryToApplicant(context: RequestContext, inquiryId: string) {
  const tenantId = requireTenant(context);

  const [inquiry] = await db
    .select()
    .from(inquiries)
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.tenantId, tenantId)))
    .limit(1);
  if (!inquiry) {
    throw new ApiError(404, 'NOT_FOUND', 'Prospect introuvable.');
  }
  if (inquiry.status === 'converted' && inquiry.convertedApplicantId) {
    throw new ApiError(422, 'ALREADY_CONVERTED', 'Ce prospect a déjà été converti en candidat.');
  }

  const nameParts = inquiry.contactName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Candidat';
  const lastName = nameParts.slice(1).join(' ') || 'Prospect';

  const [newApplicant] = await db
    .insert(applicants)
    .values({
      tenantId,
      firstName,
      lastName,
      email: inquiry.email || `prospect-${inquiry.id.slice(0, 8)}@lango.local`,
      phone: inquiry.phone || '0600000000',
      status: 'applied',
    })
    .returning();

  await db
    .update(inquiries)
    .set({ status: 'converted', convertedApplicantId: newApplicant?.id, updatedAt: new Date().toISOString() })
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.tenantId, tenantId)));

  recordAudit(context, 'create', 'applicant_conversion', newApplicant!.id);

  return { inquiryId: inquiry.id, applicant: newApplicant };
}
