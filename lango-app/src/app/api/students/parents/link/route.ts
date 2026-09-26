import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, user } from '@/models/Schema';

const linkGuardianStudentSchema = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().min(1),
  relationshipType: z.string().trim().max(100).optional(),
  isPrimaryContact: z.boolean().optional(),
  isFinanciallyResponsible: z.boolean().optional(),
  canPickup: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  emergencyPriority: z.number().int().min(1).optional().nullable(),
}).strict();

const updateGuardianStudentLinkSchema = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().min(1),
  emergencyPriority: z.number().int().min(1).nullable().optional(),
  canPickup: z.boolean().optional(),
  isPrimaryContact: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  isFinanciallyResponsible: z.boolean().optional(),
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

    assertBranchScope(context, studentRow.branchId);

    const today = new Date().toISOString().split('T')[0];

    // Check if link already exists
    const [existingLink] = await db
      .select()
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
      // Reactivate if inactive
      if (existingLink.status !== 'active') {
        await db
          .update(guardianStudents)
          .set({
            status: 'active',
            effectiveFrom: today,
            effectiveTo: null,
            relationshipType: body.relationshipType || existingLink.relationshipType || 'Parent',
            isPrimaryContact: body.isPrimaryContact ?? existingLink.isPrimaryContact,
            isFinanciallyResponsible: body.isFinanciallyResponsible ?? existingLink.isFinanciallyResponsible,
            canPickup: body.canPickup ?? existingLink.canPickup,
            hasPickupAuthority: body.canPickup ?? existingLink.canPickup,
            isEmergencyContact: body.isEmergencyContact ?? existingLink.isEmergencyContact,
            emergencyPriority: body.emergencyPriority ?? existingLink.emergencyPriority,
          })
          .where(eq(guardianStudents.id, existingLink.id));

        recordAudit(context, 'update', 'guardian_student', existingLink.id, {
          event: 'reactivated',
          studentId: body.studentId,
          guardianId: body.guardianId,
        });
      }
    } else {
      // Determine default primary contact if first link
      const [anyActiveLink] = await db
        .select({ id: guardianStudents.id })
        .from(guardianStudents)
        .where(
          and(
            eq(guardianStudents.tenantId, tenantId),
            eq(guardianStudents.studentId, body.studentId),
            eq(guardianStudents.status, 'active'),
          ),
        )
        .limit(1);

      const isPrimary = body.isPrimaryContact ?? !anyActiveLink;

      if (isPrimary) {
        // Demote previous primary if setting new primary
        await db
          .update(guardianStudents)
          .set({ isPrimaryContact: false })
          .where(
            and(
              eq(guardianStudents.tenantId, tenantId),
              eq(guardianStudents.studentId, body.studentId),
            ),
          );
      }

      const [inserted] = await db
        .insert(guardianStudents)
        .values({
          tenantId,
          guardianId: body.guardianId,
          studentId: body.studentId,
          relationshipType: body.relationshipType || 'Parent',
          isPrimaryContact: isPrimary,
          isFinanciallyResponsible: body.isFinanciallyResponsible ?? true,
          canPickup: body.canPickup ?? false,
          hasPickupAuthority: body.canPickup ?? false,
          isEmergencyContact: body.isEmergencyContact ?? false,
          emergencyPriority: body.emergencyPriority ?? null,
          status: 'active',
          effectiveFrom: today,
        })
        .returning();

      resultId = inserted!.id;

      recordAudit(context, 'create', 'guardian_student', resultId, {
        studentId: body.studentId,
        guardianId: body.guardianId,
        relationshipType: body.relationshipType || 'Parent',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: resultId,
        studentId: body.studentId,
        guardianId: body.guardianId,
        relationshipType: body.relationshipType || 'Parent',
      },
      message: 'Élève rattaché avec succès',
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

    assertBranchScope(context, studentRow.branchId);

    const [link] = await db
      .select()
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
      isFinanciallyResponsible?: boolean;
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
    if (body.isFinanciallyResponsible !== undefined) {
      patch.isFinanciallyResponsible = body.isFinanciallyResponsible;
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

    // Audit safety-sensitive changes
    recordAudit(context, 'update', 'guardian_student', link.id, {
      patch,
      guardianId: body.guardianId,
      studentId: body.studentId,
    });

    return NextResponse.json({ success: true, message: 'Liaison mise à jour avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Non-destructive relationship closure:
 * Marks link as inactive and sets effectiveTo = today.
 * Preserves audit history, historical reports, and does NOT delete the student or guardian.
 */
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

    const today = new Date().toISOString().split('T')[0];

    const [existingLink] = await db
      .select({ id: guardianStudents.id })
      .from(guardianStudents)
      .where(
        and(
          eq(guardianStudents.tenantId, tenantId),
          eq(guardianStudents.guardianId, guardianId),
          eq(guardianStudents.studentId, studentId),
        ),
      )
      .limit(1);

    if (!existingLink) {
      return NextResponse.json({ success: false, message: 'Liaison introuvable' }, { status: 404 });
    }

    await db
      .update(guardianStudents)
      .set({
        status: 'inactive',
        effectiveTo: today,
        isPrimaryContact: false,
        canPickup: false,
        hasPickupAuthority: false,
        isEmergencyContact: false,
      })
      .where(eq(guardianStudents.id, existingLink.id));

    recordAudit(context, 'update', 'guardian_student', existingLink.id, {
      event: 'unlinked',
      guardianId,
      studentId,
      status: 'inactive',
      effectiveTo: today,
    });

    return NextResponse.json({
      success: true,
      message: 'Liaison clôturée avec succès (lien archivé)',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
