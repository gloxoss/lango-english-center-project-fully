import type { RequestContext } from '@/libs/api/context';
import { and, eq, gt, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { hasCapability } from '@/libs/api/permissions';
import { requireTenantId } from '@/libs/api/portal-scope';
import { db } from '@/libs/DB';
import { branches, guardians, guardianStudents, invoices, user } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Role- and scope-aware portal search (replaces the broad header search for
// non-admin roles). Deny-by-default: an entity type is only searched when the
// actor's role can read it, and relationship scopes narrow results further
// (parent → linked children only; student/alumni → self only).
//
// Relevance (ENH-ADMIN-DASH-01): matching is accent- and case-insensitive and
// covers name, email and matricule. Results are tenant-scoped,
// capability-gated, and branch-scoped when the caller passes a branchId
// (validated server-side like the dashboard summary does).
// ---------------------------------------------------------------------------

export type PortalSearchResult = {
  students: Array<{ id: string; name: string; email: string; matricule: string | null; className: string | null; total: number }>;
  teachers: Array<{ id: string; name: string; email: string; matricule: string | null; className: string | null; total: number }>;
  invoices: Array<{ id: string; invoiceNumber: string; netAmount: number; status: string }>;
};

// Core-Postgres accent folding (no unaccent extension needed).
const FOLD_FROM = 'àáâãäçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ';
const FOLD_TO = 'aaaaaceeeeiiiinooooouuuuyyAAAAACEEEEIIIINOOOOOUUUUY';

const STUDENT_FIELDS = {
  id: user.id,
  name: user.name,
  email: user.email,
  matricule: user.matricule,
  className: sql<string | null>`(
    SELECT trim(concat(c2.name, ' ', s2.name))
    FROM class_sections cs2
    JOIN classes c2 ON c2.id = cs2.class_id
    JOIN sections s2 ON s2.id = cs2.section_id
    WHERE cs2.id = ${user.classSectionId}
  )`,
  total: sql<number>`count(*) over ()::int`,
} as const;

const TEACHER_FIELDS = {
  id: user.id,
  name: user.name,
  email: user.email,
  matricule: user.matricule,
  className: sql<string | null>`null`,
  total: sql<number>`count(*) over ()::int`,
} as const;

function matches(row: { name: string; email: string; matricule: string | null }, query: string): boolean {
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  const q = fold(query);
  return (
    fold(row.name).includes(q)
    || fold(row.email).includes(q)
    || (row.matricule ? fold(row.matricule).includes(q) : false)
  );
}

function searchConditions(query: string) {
  const pattern = `%${query}%`;
  const folded = query.toLowerCase();
  return or(
    sql`translate(lower(${user.name}), ${FOLD_FROM}, ${FOLD_TO}) like ${`%${folded}%`}`,
    ilike(user.name, pattern),
    ilike(user.email, pattern),
    ilike(user.matricule, pattern),
  );
}

export async function searchPortal(ctx: RequestContext, query: string, requestedBranchId?: string | null): Promise<PortalSearchResult> {
  const tenantId = requireTenantId(ctx);
  const result: PortalSearchResult = { students: [], teachers: [], invoices: [] };

  // Branch scope: the requested branch must be a real, active branch of THIS
  // tenant (unless the principal is pinned, in which case the pin wins).
  let effectiveBranchId: string | null = ctx.branchId ?? null;
  if (!effectiveBranchId && requestedBranchId) {
    const [branchRow] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, requestedBranchId), eq(branches.tenantId, tenantId), eq(branches.isActive, true)))
      .limit(1);
    if (!branchRow) {
      throw new ApiError(403, 'FORBIDDEN', 'Succursale introuvable ou non autorisée.');
    }
    effectiveBranchId = branchRow.id;
  }
  const branchCondition = effectiveBranchId ? eq(user.branchId, effectiveBranchId) : undefined;

  // Relationship-scoped: parents see only their linked children, never an
  // arbitrary student id from the same tenant.
  if (ctx.role === 'parent') {
    const now = new Date().toISOString();
    result.students = await db
      .select(STUDENT_FIELDS)
      .from(user)
      .innerJoin(guardianStudents, eq(guardianStudents.studentId, user.id))
      .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
      .where(
        and(
          eq(guardians.tenantId, tenantId),
          eq(guardians.userId, ctx.userId),
          eq(guardianStudents.tenantId, tenantId),
          eq(guardianStudents.status, 'active'),
          or(isNull(guardianStudents.effectiveFrom), lte(guardianStudents.effectiveFrom, now)),
          or(isNull(guardianStudents.effectiveTo), gt(guardianStudents.effectiveTo, now)),
          eq(user.tenantId, tenantId),
          eq(user.userStatus, 'active'),
          searchConditions(query),
        ),
      )
      .limit(5);
    return result;
  }

  // Self-scoped: students/alumni can only find themselves.
  if (ctx.role === 'student' || ctx.role === 'alumni') {
    const [selfRow] = await db
      .select(STUDENT_FIELDS)
      .from(user)
      .where(and(eq(user.id, ctx.userId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (selfRow && matches(selfRow, query)) {
      result.students = [selfRow];
    }
    return result;
  }

  // Staff / super_admin — capability-gated entity search.
  const [canStudents, canTeachers, canFinance] = await Promise.all([
    hasCapability(ctx.userId, tenantId, ctx.role, 'students.read'),
    hasCapability(ctx.userId, tenantId, ctx.role, 'teachers.read'),
    hasCapability(ctx.userId, tenantId, ctx.role, 'finance.read'),
  ]);

  if (canStudents) {
    result.students = await db
      .select(STUDENT_FIELDS)
      .from(user)
      .where(
        and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'student'),
          eq(user.userStatus, 'active'),
          branchCondition,
          searchConditions(query),
        ),
      )
      .limit(5);
  }

  if (canTeachers) {
    result.teachers = await db
      .select(TEACHER_FIELDS)
      .from(user)
      .where(
        and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'teacher'),
          branchCondition,
          searchConditions(query),
        ),
      )
      .limit(5);
  }

  if (canFinance) {
    result.invoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        netAmount: invoices.netAmount,
        status: invoices.status,
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        ilike(invoices.invoiceNumber, `%${query}%`),
        effectiveBranchId
          ? sql`exists (select 1 from "user" u2 where u2.id = ${invoices.studentId} and u2.branch_id = ${effectiveBranchId})`
          : undefined,
      ))
      .limit(5);
  }

  return result;
}
