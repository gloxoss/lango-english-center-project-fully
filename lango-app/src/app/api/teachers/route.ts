import type { TeacherStatus } from '@/features/teachers/server/teacher-service';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  checkHardDelete,
  createTeacher,
  currentAssignmentBlockers,
  getTeacherDetail,
  hardDeleteTeacher,
  listTeachers,
  resolveTeacherScope,

  transitionTeacherStatus,
  updateTeacher,
} from '@/features/teachers/server/teacher-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, teacherCreateSchema, teacherUpdateSchema } from '@/libs/api/validation';
import { toDbStatus } from '@/models/userMapping';

// Teacher directory API. All business logic lives in
// src/features/teachers/server/teacher-service.ts; this file is the HTTP edge:
// role + capability gates, Zod parsing, audit, response envelope.
//
// The list response carries a redacted projection (no salary, RIB, CNSS,
// national id, address or DOB) plus institution-wide KPI summary computed
// server-side, independent of the current page/filters.

const teacherCreateBodySchema = teacherCreateSchema.extend({
  branchId: z.string().uuid().nullable().optional(),
});

const teacherUpdateBodySchema = teacherUpdateSchema.extend({
  branchId: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.read');

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const id = searchParams.get('id');
    if (id) {
      // Detail honours the same selected scope as the list: a teacher outside
      // the selected campus is a 404, never a silent scope escape.
      const scope = await resolveTeacherScope(context, tenantId, branchId);
      const detail = await getTeacherDetail(context, tenantId, id, scope.effectiveBranchId);
      if (!detail) {
        return NextResponse.json({ success: false, message: 'Enseignant non trouvé' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail, scope });
    }

    const pagination = parsePagination(searchParams);
    const rawStatus = searchParams.get('status');
    const result = await listTeachers(context, tenantId, {
      search: searchParams.get('search'),
      status: rawStatus && rawStatus !== 'all' ? toDbStatus(rawStatus) : 'all',
      subjectId: searchParams.get('subjectId'),
      classSectionId: searchParams.get('classSectionId'),
      branchId,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      summary: result.summary,
      scope: result.scope,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.create');
    const body = await parseJson(request, teacherCreateBodySchema);

    const { teacher, provisioning, linkedEmployeeProfileId } = await createTeacher(context, tenantId, body);
    recordAudit(context, 'create', 'teacher', teacher.id, {
      branchId: teacher.branchId,
      employeeId: teacher.employeeId,
      invitation: provisioning.deliveryStatus,
      linkedEmployeeProfileId,
    });

    return NextResponse.json({
      success: true,
      data: teacher,
      provisioning,
      message: provisioning.tokenCreated
        ? 'Enseignant créé — lien d\'activation généré et SMS mis en file d\'attente.'
        : 'Enseignant créé — aucun téléphone fourni, aucun lien d\'activation généré.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  let parsedId: string | null = null;
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.update');
    const body = await parseJson(request, teacherUpdateBodySchema);

    // workloadHours is a deprecated stopgap column and deliberately not
    // editable from the directory (planned workload comes from the timetable).
    const { id, status, branchId, fullName, workloadHours: _ignoredWorkloadHours, ...fields } = body;
    parsedId = id;

    let transition: Awaited<ReturnType<typeof transitionTeacherStatus>> | null = null;
    if (status) {
      transition = await transitionTeacherStatus(context, tenantId, id, status as TeacherStatus);
      recordAudit(context, 'update', 'teacher_status', id, {
        status,
        closedClassAssignments: transition.closedClassAssignments,
      });
    }

    const teacher = await updateTeacher(context, tenantId, id, {
      ...(fullName !== undefined ? { name: fullName } : {}),
      ...fields,
      ...(branchId !== undefined ? { branchId } : {}),
    });
    recordAudit(context, 'update', 'teacher', id, { fields: Object.keys(fields) });

    return NextResponse.json({
      success: true,
      data: teacher,
      statusChange: transition
        ? { status, closedClassAssignments: transition.closedClassAssignments }
        : null,
      message: 'Enseignant mis à jour avec succès',
    });
  } catch (error) {
    // Surface exactly which current assignments block a campus change, so the
    // UI (and the operator) can act instead of guessing.
    if (error instanceof ApiError && error.code === 'TEACHER_BRANCH_TRANSFER_REQUIRED' && parsedId) {
      try {
        const context = await requireRequestContext(request, ['school_admin']);
        const tenantId = requireTenant(context);
        const blockers = await currentAssignmentBlockers(tenantId, parsedId);
        return NextResponse.json(
          { success: false, error: { code: error.code, message: error.message }, blockers },
          { status: 409 },
        );
      } catch {
        // fall through to the generic envelope
      }
    }
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.delete');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    // Pre-check dependencies so the caller gets an actionable 409 with the
    // reason instead of a raw FK error. Hard delete stays allowed only for a
    // clean record created by mistake.
    const check = await checkHardDelete(context, tenantId, id);
    if (!check.canHardDelete) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CANNOT_HARD_DELETE',
            message: 'Cet enseignant possède un historique académique ou RH : désactivez-le ou archivez-le au lieu de le supprimer.',
          },
          dependencies: check.dependencies,
        },
        { status: 409 },
      );
    }

    await hardDeleteTeacher(context, tenantId, id);
    recordAudit(context, 'delete', 'teacher', id);

    return NextResponse.json({
      success: true,
      message: 'Enseignant supprimé avec succès',
      id,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
