import { NextResponse } from 'next/server';
import { listTeachersForExport } from '@/features/teachers/server/teacher-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { toDbStatus } from '@/models/userMapping';

// Server-side directory export. Scope is exactly the current directory filters
// within the caller's authorized branch scope, and the projection is the safe
// directory one: no salary, banking, CNSS/AMO or national identity data.

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.read');

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get('status');
    const filters = {
      search: searchParams.get('search'),
      status: rawStatus && rawStatus !== 'all' ? toDbStatus(rawStatus) : 'all',
      subjectId: searchParams.get('subjectId'),
      classSectionId: searchParams.get('classSectionId'),
      branchId: searchParams.get('branchId'),
    };

    // Same scope resolution as the list — export can never widen the view.
    const { items, scope } = await listTeachersForExport(context, tenantId, filters);

    const header = [
      'Matricule',
      'Nom',
      'Campus',
      'Specialisation',
      'Matieres',
      'Classes',
      'Telephone',
      'Email',
      'Statut',
      'Charge planifiee (h/semaine)',
      'Dossier manquant',
    ];

    const lines = [header.map(csvCell).join(',')];
    for (const item of items) {
      lines.push([
        item.employeeId,
        item.name,
        item.branchName ?? '',
        item.specialization,
        item.subjects.map(subject => subject.name).join(' | '),
        item.classes.map(classItem => classItem.label).join(' | '),
        item.phone,
        item.email,
        item.status,
        item.weeklyScheduledHours === null ? '' : String(item.weeklyScheduledHours),
        item.dossier.missingItems.join(' | '),
      ].map(csvCell).join(','));
    }

    recordAudit(context, 'export', 'teacher_directory', 'export', {
      filters,
      count: items.length,
      effectiveBranchId: scope.effectiveBranchId,
      allBranches: scope.allBranches,
    });

    const filename = `enseignants-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(`\uFEFF${lines.join('\n')}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
