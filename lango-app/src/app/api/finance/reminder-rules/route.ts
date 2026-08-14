import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { financeReminderRules } from '@/models/Schema';

const ruleSchema = z.object({
  name: z.string().trim().min(1).max(255),
  timing: z.enum(['before', 'on', 'after']).optional(),
  daysRelative: z.number().int().optional(),
  cadenceDays: z.number().int().min(0).optional(),
  minBalance: z.number().min(0).optional(),
  maxPerStudent: z.number().int().min(1).optional(),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  locale: z.string().trim().min(2).max(10).optional(),
  escalationLevel: z.number().int().min(1).optional(),
  status: z.enum(['active', 'paused']).optional(),
}).strict();

// GET /api/finance/reminder-rules — reminder policies, tenant-scoped.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const rows = await db
      .select()
      .from(financeReminderRules)
      .where(eq(financeReminderRules.tenantId, tenantId))
      .orderBy(desc(financeReminderRules.updatedAt));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/finance/reminder-rules — create a reminder rule.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, ruleSchema);

    const [inserted] = await db
      .insert(financeReminderRules)
      .values({
        tenantId,
        name: body.name,
        timing: body.timing ?? 'after',
        daysRelative: body.daysRelative ?? 0,
        cadenceDays: body.cadenceDays ?? 0,
        minBalance: body.minBalance ?? 0,
        maxPerStudent: body.maxPerStudent ?? 3,
        quietStart: body.quietStart ?? null,
        quietEnd: body.quietEnd ?? null,
        locale: body.locale ?? 'fr',
        escalationLevel: body.escalationLevel ?? 1,
        status: body.status ?? 'active',
      })
      .returning();

    recordAudit(context, 'create', 'finance_reminder_rule', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: `Règle de rappel '${body.name}' créée.` });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// PUT /api/finance/reminder-rules — update a reminder rule (incl. pause).
export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, ruleSchema.extend({ id: z.string().uuid() }));

    const [row] = await db
      .select({ id: financeReminderRules.id })
      .from(financeReminderRules)
      .where(and(eq(financeReminderRules.id, body.id), eq(financeReminderRules.tenantId, tenantId)))
      .limit(1);
    if (!row) {
      return NextResponse.json({ success: false, message: 'Règle de rappel introuvable.' }, { status: 404 });
    }

    const [updated] = await db
      .update(financeReminderRules)
      .set({
        name: body.name,
        timing: body.timing,
        daysRelative: body.daysRelative,
        cadenceDays: body.cadenceDays,
        minBalance: body.minBalance,
        maxPerStudent: body.maxPerStudent,
        quietStart: body.quietStart ?? null,
        quietEnd: body.quietEnd ?? null,
        locale: body.locale,
        escalationLevel: body.escalationLevel,
        status: body.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(financeReminderRules.id, body.id))
      .returning();

    recordAudit(context, 'update', 'finance_reminder_rule', updated!.id);

    return NextResponse.json({ success: true, data: updated, message: 'Règle de rappel mise à jour.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
