import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';

const anonymizeSchoolSchema = z.object({
  schoolId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);

    const body = await parseJson(request, anonymizeSchoolSchema);

    const [targetSchool] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, body.schoolId))
      .limit(1);

    if (!targetSchool) {
      throw new ApiError(404, 'NOT_FOUND', 'Établissement introuvable.');
    }

    // Anonymize user PII across tenant
    await db
      .update(user)
      .set({
        name: 'Utilisateur Anonymisé',
        email: sql`'anon-' || ${user.id} || '@anonymized.local'`,
        phone: null,
        address: null,
        userStatus: 'inactive',
      })
      .where(eq(user.tenantId, body.schoolId));

    // Cancel tenant subscription and deactivate
    await db
      .update(tenants)
      .set({
        subscriptionStatus: 'cancelled',
        isActive: false,
      })
      .where(eq(tenants.id, body.schoolId));

    await recordAudit(context, 'update', 'tenant_anonymize', body.schoolId);

    return NextResponse.json({
      success: true,
      message: 'Établissement et données utilisateurs anonymisés avec succès.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
