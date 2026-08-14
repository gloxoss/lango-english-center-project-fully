import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';

// GET /api/guardian/me/children/[relationshipId] — the relationship-scoped
// child summary. The relationshipId must resolve to an effective link for the
// authenticated guardian, otherwise 404 (no existence oracle). The projection
// is redacted: identity + placement + the rights the relationship grants.
type RouteParams = { params: Promise<{ relationshipId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;

    const auth = await requireRelationship(ctx, relationshipId);
    const tenantId = ctx.tenantId as string;

    const [student] = await db
      .select({
        id: user.id,
        name: user.name,
        matricule: user.matricule,
        className: user.className,
        level: user.level,
        email: user.email,
      })
      .from(user)
      .where(and(eq(user.id, auth.studentId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!student) {
      throw new ApiError(404, 'NOT_FOUND', 'Enfant introuvable.');
    }

    return NextResponse.json({
      success: true,
      data: {
        relationshipId: auth.relationshipId,
        studentId: auth.studentId,
        name: student.name,
        matricule: student.matricule,
        className: student.className,
        level: student.level,
        email: student.email,
        rights: auth.rights,
        isPrimaryContact: auth.isPrimaryContact,
        isEmergencyContact: auth.isEmergencyContact,
        canPickup: auth.canPickup,
        hasPickupAuthority: auth.hasPickupAuthority,
        isFinanciallyResponsible: auth.isFinanciallyResponsible,
        custodyRestriction: auth.custodyRestriction,
        sensitiveContactHidden: auth.sensitiveContactHidden,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
