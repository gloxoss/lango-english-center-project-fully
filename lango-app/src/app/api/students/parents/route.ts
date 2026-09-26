import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, user, invoices, payments } from '@/models/Schema';
import { GuardianResolutionService } from '@/features/students/services/guardian-resolution-service';

const createGuardianSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  occupation: z.string().trim().max(255).optional().nullable(),
  preferredLanguage: z.string().trim().max(10).optional().nullable(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  relation: z.string().trim().max(50).optional().nullable(),
  linkStudentId: z.string().min(1).optional().nullable(),
  isPrimaryContact: z.boolean().optional(),
  isFinanciallyResponsible: z.boolean().optional(),
  canPickup: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  emergencyPriority: z.number().int().min(1).optional().nullable(),
}).strict();

const updateGuardianSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  occupation: z.string().trim().max(255).optional().nullable(),
  preferredLanguage: z.string().trim().max(10).optional().nullable(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  relation: z.string().trim().max(50).optional().nullable(),
}).strict();

type LinkedStudentSummary = {
  id: string;
  name: string;
  matricule?: string | null;
  relation: string;
  isPrimaryContact: boolean;
  canPickup: boolean;
  isFinanciallyResponsible: boolean;
  isEmergencyContact: boolean;
  emergencyPriority?: number | null;
  status: string;
};

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'receptionist', 'accountant', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guardians.read');
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || searchParams.get('q') || '';
    const pagination = parsePagination(searchParams);

    // Branch scoping: If user is branch-limited, only guardians having active students in context.branchId
    let branchGuardianIds: string[] | null = null;
    if (context.branchId) {
      const activeBranchLinks = await db
        .select({ guardianId: guardianStudents.guardianId })
        .from(guardianStudents)
        .innerJoin(user, eq(guardianStudents.studentId, user.id))
        .where(
          and(
            eq(guardianStudents.tenantId, tenantId),
            eq(guardianStudents.status, 'active'),
            eq(user.branchId, context.branchId),
          ),
        );
      branchGuardianIds = Array.from(new Set(activeBranchLinks.map(l => l.guardianId)));
      if (branchGuardianIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
      }
    }

    // Filters for guardians table
    const filters = [eq(guardians.tenantId, tenantId)];
    if (branchGuardianIds !== null) {
      filters.push(inArray(guardians.id, branchGuardianIds));
    }

    if (search) {
      const term = `%${search}%`;
      // Also search by student name or matricule
      const studentMatchLinks = await db
        .select({ guardianId: guardianStudents.guardianId })
        .from(guardianStudents)
        .innerJoin(user, eq(guardianStudents.studentId, user.id))
        .where(
          and(
            eq(guardianStudents.tenantId, tenantId),
            eq(guardianStudents.status, 'active'),
            context.branchId ? eq(user.branchId, context.branchId) : undefined,
            or(ilike(user.name, term), ilike(user.matricule, term)),
          ),
        );
      const studentMatchedGuardianIds = studentMatchLinks.map(l => l.guardianId);

      const searchConditions = [
        ilike(guardians.firstName, term),
        ilike(guardians.lastName, term),
        ilike(guardians.phone, term),
        ilike(guardians.email, term),
      ];

      if (studentMatchedGuardianIds.length > 0) {
        searchConditions.push(inArray(guardians.id, studentMatchedGuardianIds));
      }

      filters.push(or(...searchConditions)!);
    }

    const where = and(...filters);

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(guardians)
        .where(where)
        .orderBy(desc(guardians.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(guardians).where(where),
    ]);

    const total = totalRows[0]?.total ?? 0;
    const guardianIds = rows.map(r => r.id);

    // Batch load linked students within viewer's branch scope
    const linkedMap = new Map<string, LinkedStudentSummary[]>();
    if (guardianIds.length > 0) {
      const links = await db
        .select({
          guardianId: guardianStudents.guardianId,
          studentId: guardianStudents.studentId,
          studentName: user.name,
          studentMatricule: user.matricule,
          relation: guardianStudents.relationshipType,
          isPrimaryContact: guardianStudents.isPrimaryContact,
          canPickup: guardianStudents.canPickup,
          isFinanciallyResponsible: guardianStudents.isFinanciallyResponsible,
          isEmergencyContact: guardianStudents.isEmergencyContact,
          emergencyPriority: guardianStudents.emergencyPriority,
          status: guardianStudents.status,
        })
        .from(guardianStudents)
        .innerJoin(user, eq(guardianStudents.studentId, user.id))
        .where(
          and(
            eq(guardianStudents.tenantId, tenantId),
            inArray(guardianStudents.guardianId, guardianIds),
            eq(guardianStudents.status, 'active'),
            context.branchId ? eq(user.branchId, context.branchId) : undefined,
          ),
        );

      for (const link of links) {
        const list = linkedMap.get(link.guardianId) ?? [];
        list.push({
          id: link.studentId,
          name: link.studentName,
          matricule: link.studentMatricule,
          relation: link.relation,
          isPrimaryContact: link.isPrimaryContact,
          canPickup: link.canPickup,
          isFinanciallyResponsible: link.isFinanciallyResponsible,
          isEmergencyContact: link.isEmergencyContact,
          emergencyPriority: link.emergencyPriority,
          status: link.status,
        });
        linkedMap.set(link.guardianId, list);
      }
    }

    return NextResponse.json({
      success: true,
      data: rows.map((row) => {
        const studentLinks = linkedMap.get(row.id) ?? [];
        return {
          id: row.id,
          userId: row.userId,
          name: `${row.firstName} ${row.lastName}`.trim(),
          firstName: row.firstName,
          lastName: row.lastName,
          relation: row.defaultRelation ?? '',
          phone: row.phone ?? '',
          email: row.email ?? '',
          linkedStudents: studentLinks.map(s => s.name),
          linkedStudentDetails: studentLinks,
          address: row.address ?? '',
          occupation: row.occupation ?? '',
          emailOptIn: row.emailOptIn,
          smsOptIn: row.smsOptIn,
          preferredLanguage: row.preferredLanguage ?? '',
          portalAccess: row.userId !== null,
          isPrimaryContact: studentLinks.some(s => s.isPrimaryContact),
          isFinanciallyResponsible: studentLinks.some(s => s.isFinanciallyResponsible),
          canPickup: studentLinks.some(s => s.canPickup),
          isEmergencyContact: studentLinks.some(s => s.isEmergencyContact),
          schoolId: row.tenantId,
        };
      }),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guardians.manage');
    const body = await parseJson(request, createGuardianSchema);

    // If viewer is branch-limited, require linkStudentId belonging to their branch
    if (context.branchId && !body.linkStudentId) {
      throw new ApiError(
        403,
        'BRANCH_ANCHOR_REQUIRED',
        'En tant qu\'administrateur de succursale, vous devez associer le tuteur à un élève de votre établissement.',
      );
    }

    let targetStudent: { id: string; branchId: string | null } | null = null;
    if (body.linkStudentId) {
      const [st] = await db
        .select({ id: user.id, branchId: user.branchId })
        .from(user)
        .where(
          and(
            eq(user.id, body.linkStudentId),
            eq(user.tenantId, tenantId),
            inArray(user.role, ['student', 'alumni']),
          ),
        )
        .limit(1);

      if (!st) {
        throw new ApiError(404, 'STUDENT_NOT_FOUND', 'L\'élève spécifié n\'existe pas.');
      }
      assertBranchScope(context, st.branchId);
      targetStudent = st;
    }

    // Resolve existing or create new via centralized GuardianResolutionService
    const resolution = await GuardianResolutionService.resolveOrCreateGuardian(
      tenantId,
      {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        occupation: body.occupation,
        preferredLanguage: body.preferredLanguage,
        emailOptIn: body.emailOptIn ?? true,
        smsOptIn: body.smsOptIn ?? true,
        defaultRelation: body.relation || 'Parent',
      },
    );

    const guardianId = resolution.id;

    if (!resolution.isExisting) {
      recordAudit(context, 'create', 'guardian', guardianId, {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
      });
    }

    // Link student if provided
    if (targetStudent) {
      const today = new Date().toISOString().split('T')[0];
      const [existingLink] = await db
        .select()
        .from(guardianStudents)
        .where(
          and(
            eq(guardianStudents.tenantId, tenantId),
            eq(guardianStudents.guardianId, guardianId),
            eq(guardianStudents.studentId, targetStudent.id),
          ),
        )
        .limit(1);

      if (existingLink) {
        if (existingLink.status !== 'active') {
          await db
            .update(guardianStudents)
            .set({
              status: 'active',
              effectiveFrom: today,
              effectiveTo: null,
              relationshipType: body.relation || existingLink.relationshipType || 'Parent',
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
          });
        }
      } else {
        const [insertedLink] = await db
          .insert(guardianStudents)
          .values({
            tenantId,
            guardianId,
            studentId: targetStudent.id,
            relationshipType: body.relation || 'Parent',
            isPrimaryContact: body.isPrimaryContact ?? false,
            isFinanciallyResponsible: body.isFinanciallyResponsible ?? true,
            canPickup: body.canPickup ?? false,
            hasPickupAuthority: body.canPickup ?? false,
            isEmergencyContact: body.isEmergencyContact ?? false,
            emergencyPriority: body.emergencyPriority ?? null,
            status: 'active',
            effectiveFrom: today,
          })
          .returning();

        recordAudit(context, 'create', 'guardian_student', insertedLink!.id, {
          guardianId,
          studentId: targetStudent.id,
          relationshipType: body.relation || 'Parent',
        });
      }
    }

    const [guardianRow] = await db
      .select()
      .from(guardians)
      .where(and(eq(guardians.id, guardianId), eq(guardians.tenantId, tenantId)))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        id: guardianRow!.id,
        name: `${guardianRow!.firstName} ${guardianRow!.lastName}`.trim(),
        firstName: guardianRow!.firstName,
        lastName: guardianRow!.lastName,
        phone: guardianRow!.phone,
        email: guardianRow!.email,
        isExisting: resolution.isExisting,
      },
      message: resolution.isExisting
        ? 'Tuteur existant réutilisé et rattaché avec succès'
        : 'Tuteur créé avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guardians.manage');
    const body = await parseJson(request, updateGuardianSchema);

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
        ...(body.relation !== undefined && { defaultRelation: body.relation }),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(guardians.id, body.id), eq(guardians.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Tuteur non trouvé' }, { status: 404 });
    }

    recordAudit(context, 'update', 'guardian', body.id, {
      firstName: updated.firstName,
      lastName: updated.lastName,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Tuteur mis à jour avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guardians.manage');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    const [guardian] = await db
      .select({ id: guardians.id, userId: guardians.userId })
      .from(guardians)
      .where(and(eq(guardians.id, id), eq(guardians.tenantId, tenantId)))
      .limit(1);

    if (!guardian) {
      return NextResponse.json({ success: false, message: 'Tuteur introuvable' }, { status: 404 });
    }

    // P0 Delete Blocker Check:
    // Check for any active or historical student links
    const existingLinks = await db
      .select({ id: guardianStudents.id, status: guardianStudents.status })
      .from(guardianStudents)
      .where(and(eq(guardianStudents.guardianId, id), eq(guardianStudents.tenantId, tenantId)));

    const blockers: string[] = [];
    if (existingLinks.length > 0) {
      blockers.push(`${existingLinks.length} relation(s) élève(s) active(s) ou historique(s)`);
    }

    if (guardian.userId) {
      blockers.push('Compte utilisateur portail actif lié');
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'GUARDIAN_IN_USE',
          message:
            'Impossible de supprimer ce tuteur car il est référencé par des dossiers scolaires actifs ou archivés.',
          blockers,
        },
        { status: 409 },
      );
    }

    await db.delete(guardians).where(and(eq(guardians.id, id), eq(guardians.tenantId, tenantId)));
    recordAudit(context, 'delete', 'guardian', id);

    return NextResponse.json({
      success: true,
      message: 'Tuteur supprimé avec succès',
      id,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
