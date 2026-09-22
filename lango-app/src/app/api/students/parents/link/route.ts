import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, user } from '@/models/Schema';

const linkGuardianStudentSchema = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().min(1),
  relationshipType: z.string().trim().max(100).optional(),
}).strict();

const updateGuardianStudentLinkSchema = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().min(1),
  emergencyPriority: z.number().int().nullable().optional(),
  canPickup: z.boolean().optional(),
  isPrimaryContact: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  relationshipType: z.string().trim().max(100).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.guardians.manage');
    const body = await parseJson(request, linkGuardianStudentSchema);

    // Verify guardian belongs to tenant
    const [guardianRow] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(and(eq(guardians.id, body.guardianId), eq(guardians.tenantId, tenantId)))
      .limit(1);

    if (!guardianRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Le tuteur indiqué n\'existe pas.');
    }

    // Verify student belongs to tenant and authorized branch
    const [studentRow] = await db
      .select({ id: user.id, name: user.name, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), inArray(user.role, ['student', 'alumni'])))
      .limit(1);

    if (!studentRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas.');
    }

    if (context.branchId && studentRow.branchId && studentRow.branchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès non autorisé pour cette succursale.');
    }

    // Check if link already exists
    const [existingLink] = await db
      .select({ id: guardianStudents.id })
      .from(guardianStudents)
      .where(
        and(
          eq(guardianStudents.tenantId, tenantId),
          eq(guardianStudents.guardianId, body.guardianId),
          eq(guardianStudents.studentId, body.studentId),
        ),
      )
      .limit(1);

    let resultId: string;
    if (existingLink) {
      resultId = existingLink.id;
    } else {
      // First guardian linked to this student becomes their primary contact by
      // default (nothing else in the app sets this yet) - it's what SMS-on-absence
      // and reminder features resolve against.
      const [anyExistingLink] = await db
        .select({ id: guardianStudents.id })
        .from(guardianStudents)
        .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, body.studentId)))
        .limit(1);

      const [inserted] = await db
        .insert(guardianStudents)
        .values({
          tenantId,
          guardianId: body.guardianId,
          studentId: body.studentId,
          relationshipType: body.relationshipType || 'Parent',
          isPrimaryContact: !anyExistingLink,
        })
        .returning();
      resultId = inserted!.id;
    }

    recordAudit(context, 'create', 'guardian_student', resultId);

    return NextResponse.json({
      success: true,
      data: {
        id: resultId,
        studentId: body.studentId,
        guardianId: body.guardianId,
        relationshipType: body.relationshipType || 'Parent',
      },
      message: 'Tuteur associé avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.guardians.manage');
    const body = await parseJson(request, updateGuardianStudentLinkSchema);

    // Verify student branch
    const [studentRow] = await db
      .select({ id: user.id, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), inArray(user.role, ['student', 'alumni'])))
      .limit(1);

    if (!studentRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas.');
    }

    if (context.branchId && studentRow.branchId && studentRow.branchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès non autorisé pour cette succursale.');
    }

    const [link] = await db
      .select({ id: guardianStudents.id })
      .from(guardianStudents)
      .where(and(
        eq(guardianStudents.tenantId, tenantId),
        eq(guardianStudents.guardianId, body.guardianId),
        eq(guardianStudents.studentId, body.studentId),
      ))
      .limit(1);

    if (!link) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Cette liaison tuteur-élève n\'existe pas.');
    }

    const patch: {
      emergencyPriority?: number | null;
      canPickup?: boolean;
      hasPickupAuthority?: boolean;
      isPrimaryContact?: boolean;
      isEmergencyContact?: boolean;
      relationshipType?: string;
    } = {};

    if (body.emergencyPriority !== undefined) {
      patch.emergencyPriority = body.emergencyPriority;
      if (body.emergencyPriority !== null && body.isEmergencyContact === undefined) {
        patch.isEmergencyContact = true;
      }
    }
    if (body.canPickup !== undefined) {
      patch.canPickup = body.canPickup;
      patch.hasPickupAuthority = body.canPickup;
    }
    if (body.isEmergencyContact !== undefined) {
      patch.isEmergencyContact = body.isEmergencyContact;
      if (!body.isEmergencyContact && body.emergencyPriority === undefined) {
        patch.emergencyPriority = null;
      }
    }
    if (body.isPrimaryContact !== undefined) {
      patch.isPrimaryContact = body.isPrimaryContact;
      if (body.isPrimaryContact) {
        // Guarantee single primary contact per student for this tenant
        await db.update(guardianStudents)
          .set({ isPrimaryContact: false })
          .where(and(
            eq(guardianStudents.tenantId, tenantId),
            eq(guardianStudents.studentId, body.studentId),
          ));
      }
    }
    if (body.relationshipType !== undefined) {
      patch.relationshipType = body.relationshipType;
    }

    await db.update(guardianStudents).set(patch).where(eq(guardianStudents.id, link.id));

    recordAudit(context, 'update', 'guardian_student', link.id, patch);

    return NextResponse.json({ success: true, message: 'Liaison mise à jour avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.guardians.manage');
    const { searchParams } = new URL(request.url);
    const guardianId = searchParams.get('guardianId');
    const studentId = searchParams.get('studentId');

    if (!guardianId || !studentId) {
      return NextResponse.json({ success: false, message: 'guardianId et studentId requis' }, { status: 400 });
    }

    // Branch authorization check
    const [studentRow] = await db
      .select({ id: user.id, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), inArray(user.role, ['student', 'alumni'])))
      .limit(1);

    if (!studentRow) {
      return NextResponse.json({ success: false, message: 'Élève introuvable' }, { status: 404 });
    }

    if (context.branchId && studentRow.branchId && studentRow.branchId !== context.branchId) {
      return NextResponse.json({ success: false, message: 'Accès non autorisé pour cette succursale.' }, { status: 403 });
    }

    await db
      .delete(guardianStudents)
      .where(
        and(
          eq(guardianStudents.tenantId, tenantId),
          eq(guardianStudents.guardianId, guardianId),
          eq(guardianStudents.studentId, studentId),
        ),
      );

    recordAudit(context, 'delete', 'guardian_student', `${guardianId}:${studentId}`);

    return NextResponse.json({
      success: true,
      message: 'Liaison supprimée avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
