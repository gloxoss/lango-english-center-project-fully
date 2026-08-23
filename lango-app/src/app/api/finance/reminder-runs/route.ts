import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { financeReminderRuns } from '@/models/Schema';
import { requireActiveReminderRule, runFinanceReminderRule } from '@/libs/services/finance-reminders';

const runSchema = z.object({
  ruleId: z.string().uuid(),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

// GET /api/finance/reminder-runs — past reminder runs, tenant-scoped.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const rows = await db
      .select()
      .from(financeReminderRuns)
      .where(eq(financeReminderRuns.tenantId, tenantId))
      .orderBy(desc(financeReminderRuns.startedAt));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/finance/reminder-runs — run a reminder rule: snapshot the eligible
// overdue invoices, dispatch through the Broadcast pipeline (campaigns →
// deliveries via the outbox worker) and record delivery evidence.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, runSchema);
    const today = body.asOfDate ?? new Date().toISOString().slice(0, 10);

    const rule = await requireActiveReminderRule(tenantId, body.ruleId);
    const completed = await runFinanceReminderRule(tenantId, rule, context.userId, today);

    recordAudit(context, 'create', 'finance_reminder_run', completed.id, { recipients: completed.recipientsCount, sent: completed.sentCount });

    const results = (completed.results ?? {}) as { quietHoursSkipped?: boolean };
    const message = results.quietHoursSkipped
      ? 'Rappels différés (heures calmes en vigueur).'
      : `${completed.sentCount}/${completed.recipientsCount} rappel(s) envoyé(s).`;

    return NextResponse.json({ success: true, data: completed, message });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
