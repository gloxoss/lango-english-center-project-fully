import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reportSchedules } from '@/addons/advanced-reporting/models/reporting-schema';
import { ScheduleService } from '@/addons/advanced-reporting/services/schedule-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const createScheduleSchema = z.object({
  reportKey: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(255).optional(),
  cronExpression: z.string().min(1).max(100),
  format: z.enum(['csv', 'xlsx', 'pdf']).optional(),
  parameters: z.record(z.string(), z.any()).optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    const schedules = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.tenantId, tenantId));

    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.schedule');

    const { reportKey, name, cronExpression, format, parameters } = await parseJson(request, createScheduleSchema);

    let nextRunAt: string;
    try {
      nextRunAt = ScheduleService.calculateNextRun(cronExpression).toISOString();
    } catch {
      throw new ApiError(422, 'INVALID_CRON', 'Expression cron invalide.');
    }

    const [newSchedule] = await db
      .insert(reportSchedules)
      .values({
        tenantId,
        reportKey,
        name: name || `Schedule ${reportKey}`,
        cronExpression,
        format: format || 'csv',
        parameters: parameters || {},
        createdById: context.userId,
        nextRunAt,
      })
      .returning();

    recordAudit(context, 'create', 'report_schedule', newSchedule!.id, { reportKey, cronExpression });

    return NextResponse.json({ success: true, data: newSchedule });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
