// Identity verification OUTCOME recorder. Stores only method + outcome (+
// optional short note). Never stores document images or raw copies — the
// subject is re-verified in-tenant, then the result is logged
// (receptionist-portal plan §6). Verifications are append-only.
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { guardians, user } from '@/models/Schema';
import { receptionIdentityVerifications } from '@/features/reception/models/reception-schema';
import { guardVisits } from '@/features/guard/models/guard-schema';

export async function recordVerification(context: RequestContext, input: {
  subjectType: 'student' | 'guardian' | 'visitor';
  subjectId: string;
  method: string;
  outcome: string;
  notes?: string | null;
}) {
  const tenantId = requireTenant(context);

  // Re-verify the subject belongs to this tenant — a cross-tenant id yields 404
  // (safe foreign-ID behavior: never a clue about the subject's existence).
  if (input.subjectType === 'student') {
    const [s] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, input.subjectId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);
    if (!s) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Élève introuvable.');
  } else if (input.subjectType === 'guardian') {
    const [g] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(and(eq(guardians.id, input.subjectId), eq(guardians.tenantId, tenantId)))
      .limit(1);
    if (!g) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Parent introuvable.');
  } else {
    const [v] = await db
      .select({ id: guardVisits.id })
      .from(guardVisits)
      .where(and(eq(guardVisits.id, input.subjectId), eq(guardVisits.tenantId, tenantId)))
      .limit(1);
    if (!v) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Visite introuvable.');
  }

  const [row] = await db
    .insert(receptionIdentityVerifications)
    .values({
      tenantId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      method: input.method,
      outcome: input.outcome,
      notes: input.notes ?? null,
      verifierId: context.userId,
    })
    .returning();
  if (!row) throw new ApiError(500, 'INTERNAL', 'Enregistrement de la vérification impossible.');

  recordAudit(context, 'create', 'reception_identity_verification', row.id, {
    subjectType: input.subjectType,
    outcome: input.outcome,
    method: input.method,
  });
  return row;
}
