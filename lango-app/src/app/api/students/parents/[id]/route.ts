import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, user } from '@/models/Schema';

const updateGuardianSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  occupation: z.string().trim().max(255).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  defaultRelation: z.string().trim().max(50).optional().nullable(),
}).strict().refine(data => Object.keys(data).length > 0, {
  message: 'Au moins un champ doit être fourni.',
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'students.read');

    const { id } = await params;

    const [guardian] = await db
      .select()
      .from(guardians)
      .where(and(eq(guardians.id, id), eq(guardians.tenantId, tenantId)))
      .limit(1);

    if (!guardian) {
      throw new ApiError(404, 'GUARDIAN_NOT_FOUND', 'Tuteur introuvable.');
    }

    // Load linked students with student name and profile info
    const linkedStudents = await db
      .select({
        linkId: guardianStudents.id,
        studentId: guardianStudents.studentId,
        studentName: user.name,
        studentMatricule: user.matricule,
        relationshipType: guardianStudents.relationshipType,
        isPrimaryContact: guardianStudents.isPrimaryContact,
        isEmergencyContact: guardianStudents.isEmergencyContact,
      })
      .from(guardianStudents)
      .innerJoin(user, eq(guardianStudents.studentId, user.id))
      .where(and(
        eq(guardianStudents.guardianId, id),
        eq(guardianStudents.tenantId, tenantId),
      ));

    return NextResponse.json({
      success: true,
      data: { ...guardian, linkedStudents },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'students.guardians.manage');

    const { id } = await params;
    const body = await parseJson(req, updateGuardianSchema);

    const [existing] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(and(eq(guardians.id, id), eq(guardians.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'GUARDIAN_NOT_FOUND', 'Tuteur introuvable.');
    }

    const [updated] = await db
      .update(guardians)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(guardians.id, id), eq(guardians.tenantId, tenantId)))
      .returning();

    recordAudit(ctx, 'update', 'guardian', id, { fields: Object.keys(body) });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
