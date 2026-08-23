import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { listPayslips } from '@/features/hr/services/payslips';
import { employeeProfiles, workforcePunchEvents } from '@/models/Schema';

// GET /api/hr/employees/[id]/payroll-attendance
// Admin-facing Finance/Attendance data for a single employee dossier (§17.3).
//
// Payslips and punch events are both keyed to the platform login account
// (user.id), while the dossier is keyed to employeeProfiles.id — so this
// resolves through the nullable employeeProfiles.userId. A "Sans compte"
// employee (no linked login) therefore reports `linked: false` and empty
// arrays, rather than silently showing zero rows that look like a data bug.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.employee.read');

    const [profile] = await db
      .select({ userId: employeeProfiles.userId })
      .from(employeeProfiles)
      .where(and(eq(employeeProfiles.id, id), eq(employeeProfiles.tenantId, tenantId)))
      .limit(1);

    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');
    }

    if (!profile.userId) {
      return NextResponse.json({ success: true, data: { linked: false, payslips: [], punches: [] } });
    }

    const [payslips, punches] = await Promise.all([
      listPayslips({ tenantId, userId: profile.userId }),
      db
        .select({
          id: workforcePunchEvents.id,
          punchType: workforcePunchEvents.punchType,
          scannedAt: workforcePunchEvents.scannedAt,
          notes: workforcePunchEvents.notes,
        })
        .from(workforcePunchEvents)
        .where(and(eq(workforcePunchEvents.tenantId, tenantId), eq(workforcePunchEvents.employeeId, profile.userId)))
        .orderBy(desc(workforcePunchEvents.scannedAt))
        .limit(100),
    ]);

    const sortedPayslips = payslips.sort((a, b) => (b.year - a.year) || (b.month - a.month));

    return NextResponse.json({ success: true, data: { linked: true, payslips: sortedPayslips, punches } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
