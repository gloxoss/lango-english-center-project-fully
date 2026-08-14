import { and, eq, gt, ilike, isNull, lte, or } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { hasCapability } from '@/libs/api/permissions';
import { requireTenantId } from '@/libs/api/portal-scope';
import { guardianStudents, guardians, invoices, user } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Role- and scope-aware portal search (replaces the broad header search for
// non-admin roles). Deny-by-default: an entity type is only searched when the
// actor's role can read it, and relationship scopes narrow results further
// (parent → linked children only; student/alumni → self only).
// ---------------------------------------------------------------------------

export type PortalSearchResult = {
  students: Array<{ id: string; name: string; email: string; matricule: string | null }>;
  teachers: Array<{ id: string; name: string; email: string; matricule: string | null }>;
  invoices: Array<{ id: string; invoiceNumber: string; netAmount: number; status: string }>;
};

const STUDENT_FIELDS = {
  id: user.id,
  name: user.name,
  email: user.email,
  matricule: user.matricule,
} as const;

const TEACHER_FIELDS = {
  id: user.id,
  name: user.name,
  email: user.email,
  matricule: user.matricule,
} as const;

function matches(row: { name: string; email: string; matricule: string | null }, query: string): boolean {
  const q = query.toLowerCase();
  return (
    row.name.toLowerCase().includes(q) ||
    row.email.toLowerCase().includes(q) ||
    (row.matricule?.toLowerCase().includes(q) ?? false)
  );
}

export async function searchPortal(ctx: RequestContext, query: string): Promise<PortalSearchResult> {
  const tenantId = requireTenantId(ctx);
  const pattern = `%${query}%`;
  const result: PortalSearchResult = { students: [], teachers: [], invoices: [] };

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
          or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.matricule, pattern)),
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
          or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.matricule, pattern)),
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
          or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.matricule, pattern)),
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
      .where(and(eq(invoices.tenantId, tenantId), ilike(invoices.invoiceNumber, pattern)))
      .limit(5);
  }

  return result;
}
