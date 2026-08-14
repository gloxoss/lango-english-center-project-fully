// Reception lookup — identity-minimized, tenant-scoped person search.
// Returns only: id, name, masked contact, person type, branch/class routing
// context, authorized-guardian relationship status. Never national ID, salary,
// bank details, medical information, credentials, internal notes, grades,
// finance balances or unrestricted contacts (receptionist-portal plan §3).
//
// Search rules mirror the guard narrow search: name >= 3, phone >= 6, exact
// matricule always. Results capped at 20. Enumeration resistance comes from the
// route-level rate limit + these minimum-length rules.
import { and, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { guardianStudents, guardians, user } from '@/models/Schema';
import type { LookupResult } from '../types';

function maskPhone(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 3)}****${value.slice(-2)}`;
}

function maskEmail(value: string | null): string | null {
  if (!value) return null;
  const at = value.indexOf('@');
  if (at <= 1) return '***@***';
  return `${value.slice(0, 2)}***${value.slice(at)}`;
}

export async function lookupPeople(context: RequestContext, q: string): Promise<LookupResult[]> {
  const tenantId = requireTenant(context);
  const term = `%${q}%`;

  const nameCond = q.length >= 3 ? ilike(user.name, term) : undefined;
  const phoneCond = q.length >= 6 && /^\d+$/.test(q) ? ilike(user.phone, term) : undefined;
  const matriculeCond = eq(user.matricule, q);
  const conds = [nameCond, phoneCond, matriculeCond].filter((c): c is ReturnType<typeof eq> => Boolean(c));
  if (conds.length === 0) return [];

  // Students: role student, active in tenant.
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      matricule: user.matricule,
      className: user.className,
      level: user.level,
      branchId: user.branchId,
    })
    .from(user)
    .where(and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      eq(user.userStatus, 'active'),
      or(...conds)!,
    ))
    .limit(20);

  // Authorized-guardian relationship status for each matched student: does an
  // active linked guardian carry pickup authority?
  const studentPickupFlags = new Map<string, boolean>();
  if (students.length > 0) {
    const links = await db
      .select({
        studentId: guardianStudents.studentId,
        hasPickupAuthority: guardianStudents.hasPickupAuthority,
      })
      .from(guardianStudents)
      .where(and(
        eq(guardianStudents.tenantId, tenantId),
        eq(guardianStudents.status, 'active'),
      ));
    for (const link of links) {
      if (link.hasPickupAuthority) studentPickupFlags.set(link.studentId, true);
    }
  }

  const studentResults: LookupResult[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    type: 'student',
    maskedPhone: maskPhone(s.phone),
    maskedEmail: maskEmail(s.email),
    matricule: s.matricule,
    className: s.className,
    level: s.level,
    branchId: s.branchId,
    hasPickupAuthority: studentPickupFlags.get(s.id) ?? false,
  }));

  // Guardians: canonical persons table (covers guardians without a login).
  const guardianConds = [nameCond, phoneCond].filter((c): c is ReturnType<typeof eq> => Boolean(c));
  const guardianResults: LookupResult[] = [];
  if (guardianConds.length > 0) {
    const guardiansRows = await db
      .select({
        id: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        phone: guardians.phone,
        email: guardians.email,
      })
      .from(guardians)
      .where(and(
        eq(guardians.tenantId, tenantId),
        or(
          ilike(guardians.firstName, term),
          ilike(guardians.lastName, term),
          ilike(guardians.phone, term),
        )!,
      ))
      .limit(20);

    const guardianIds = guardiansRows.map((g) => g.id);
    const linkedSet = new Map<string, boolean>();
    if (guardianIds.length > 0) {
      const links = await db
        .select({
          guardianId: guardianStudents.guardianId,
          hasPickupAuthority: guardianStudents.hasPickupAuthority,
        })
        .from(guardianStudents)
        .where(and(
          eq(guardianStudents.tenantId, tenantId),
          eq(guardianStudents.status, 'active'),
        ));
      for (const link of links) {
        linkedSet.set(link.guardianId, (linkedSet.get(link.guardianId) ?? false) || Boolean(link.hasPickupAuthority));
      }
    }

    for (const g of guardiansRows) {
      guardianResults.push({
        id: g.id,
        name: `${g.firstName} ${g.lastName}`.trim(),
        type: 'guardian',
        maskedPhone: maskPhone(g.phone),
        maskedEmail: maskEmail(g.email),
        isLinkedGuardian: linkedSet.has(g.id),
        hasPickupAuthority: linkedSet.get(g.id) ?? false,
      });
    }
  }

  // Parents with a login (role 'parent') are surfaced only if they are not
  // already covered by a guardians row. No extra PII beyond the same mask.
  const parentResults: LookupResult[] = [];
  const parentConds = q.length >= 3 ? [ilike(user.name, term)] : [];
  if (parentConds.length > 0) {
    const parentRows = await db
      .select({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        branchId: user.branchId,
      })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'parent'),
        eq(user.userStatus, 'active'),
        or(...parentConds)!,
      ))
      .limit(20);
    const guardianUserIds = new Set((await db
      .select({ userId: guardians.userId })
      .from(guardians)
      .where(eq(guardians.tenantId, tenantId))).map((r) => r.userId));

    for (const p of parentRows) {
      if (guardianUserIds.has(p.id)) continue; // already covered by guardians search
      parentResults.push({
        id: p.id,
        name: p.name,
        type: 'parent',
        maskedPhone: maskPhone(p.phone),
        maskedEmail: maskEmail(p.email),
        branchId: p.branchId,
      });
    }
  }

  // Students first, then guardians, then parent users — deterministic and
  // capped overall so a huge tenant can never dump the directory.
  const merged = [...studentResults, ...guardianResults, ...parentResults].slice(0, 20);
  if (merged.length === 0) {
    throw new ApiError(404, 'NO_MATCH', 'Aucune personne trouvée.');
  }
  return merged;
}
