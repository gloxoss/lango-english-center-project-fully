import type { NextRequest } from 'next/server';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, user } from '@/models/Schema';
import { GuardianResolutionService } from '@/features/students/services/guardian-resolution-service';

const updateGuardianSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  occupation: z.string().trim().max(255).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  defaultRelation: z.string().trim().max(50).optional().nullable(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  preferredLanguage: z.string().trim().max(10).optional().nullable(),
}).strict().refine(data => Object.keys(data).length > 0, {
  message: 'Au moins un champ doit être fourni.',
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'teacher', 'receptionist', 'accountant']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'guardians.read');

    const { id } = await params;

    const [guardian] = await db
      .select({
        id: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        phone: guardians.phone,
        email: guardians.email,
        address: guardians.address,
        occupation: guardians.occupation,
        defaultRelation: guardians.defaultRelation,
        userId: guardians.userId,
        emailOptIn: guardians.emailOptIn,
        smsOptIn: guardians.smsOptIn,
        preferredLanguage: guardians.preferredLanguage,
        createdAt: guardians.createdAt,
        updatedAt: guardians.updatedAt,
      })
      .from(guardians)
      .where(and(eq(guardians.id, id), eq(guardians.tenantId, tenantId)))
      .limit(1);

    if (!guardian) {
      throw new ApiError(404, 'GUARDIAN_NOT_FOUND', 'Tuteur introuvable.');
    }

    // Load linked students strictly within viewer's branch scope
    const linkedStudentRows = await db
      .select({
        linkId: guardianStudents.id,
        studentId: guardianStudents.studentId,
        studentName: user.name,
        studentMatricule: user.matricule,
        studentBranchId: user.branchId,
        relationshipType: guardianStudents.relationshipType,
        isPrimaryContact: guardianStudents.isPrimaryContact,
        isEmergencyContact: guardianStudents.isEmergencyContact,
        emergencyPriority: guardianStudents.emergencyPriority,
        canPickup: guardianStudents.canPickup,
        isFinanciallyResponsible: guardianStudents.isFinanciallyResponsible,
        status: guardianStudents.status,
        effectiveFrom: guardianStudents.effectiveFrom,
        effectiveTo: guardianStudents.effectiveTo,
      })
      .from(guardianStudents)
      .innerJoin(user, eq(guardianStudents.studentId, user.id))
      .where(
        and(
          eq(guardianStudents.guardianId, id),
          eq(guardianStudents.tenantId, tenantId),
          ctx.branchId ? eq(user.branchId, ctx.branchId) : undefined,
        ),
      )
      .orderBy(desc(guardianStudents.status), desc(guardianStudents.isPrimaryContact));

    // If viewer is branch-limited and has 0 visible links to this guardian, block or return empty students
    if (ctx.branchId && linkedStudentRows.length === 0) {
      throw new ApiError(403, 'FORBIDDEN', 'Aucun élève autorisé pour votre succursale n\'est lié à ce tuteur.');
    }

    // Co-guardians for authorized students
    const linkedStudents = await Promise.all(
      linkedStudentRows.map(async (row) => {
        const coGuardians = await db
          .select({
            guardianId: guardianStudents.guardianId,
            name: sql<string>`${guardians.firstName} || ' ' || ${guardians.lastName}`,
            relationshipType: guardianStudents.relationshipType,
            phone: guardians.phone,
          })
          .from(guardianStudents)
          .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
          .where(
            and(
              eq(guardianStudents.studentId, row.studentId),
              eq(guardianStudents.tenantId, tenantId),
              eq(guardianStudents.status, 'active'),
              ne(guardianStudents.guardianId, id),
            ),
          );

        return { ...row, coGuardians };
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        ...guardian,
        name: `${guardian.firstName} ${guardian.lastName}`.trim(),
        portalAccess: guardian.userId !== null,
        linkedStudents,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'receptionist']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'guardians.manage');

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
        ...(body.firstName && { firstName: body.firstName.trim() }),
        ...(body.lastName && { lastName: body.lastName.trim() }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(body.email !== undefined && {
          email: body.email ? GuardianResolutionService.normalizeEmail(body.email) : null,
        }),
        ...(body.address !== undefined && { address: body.address?.trim() || null }),
        ...(body.occupation !== undefined && { occupation: body.occupation?.trim() || null }),
        ...(body.emailOptIn !== undefined && { emailOptIn: body.emailOptIn }),
        ...(body.smsOptIn !== undefined && { smsOptIn: body.smsOptIn }),
        ...(body.preferredLanguage !== undefined && { preferredLanguage: body.preferredLanguage }),
        ...(body.defaultRelation !== undefined && { defaultRelation: body.defaultRelation }),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(guardians.id, id), eq(guardians.tenantId, tenantId)))
      .returning();

    recordAudit(ctx, 'update', 'guardian', id, {
      updatedFields: Object.keys(body),
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Informations du tuteur mises à jour',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
