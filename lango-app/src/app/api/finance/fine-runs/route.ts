import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { fineAssessments, finePolicies, invoiceEvents, invoices, user } from '@/models/Schema';

const runSchema = z.object({
  finePolicyId: z.string().uuid().optional(),
}).strict();

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

// POST /api/finance/fine-runs — deterministic fine assessment for overdue
// invoices against active fine policies (grace days respected; capped).
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    // Body is optional: an empty POST runs every active policy. Only a
    // non-JSON body is an error; a missing body means "all active".
    let body: z.infer<typeof runSchema> = {};
    try {
      body = await parseJson(request, runSchema);
    } catch (err) {
      if ((err as { code?: string }).code !== 'INVALID_JSON') throw err;
    }

    const today = new Date().toISOString().slice(0, 10);

    const policies = await db
      .select()
      .from(finePolicies)
      .where(and(
        eq(finePolicies.tenantId, tenantId),
        eq(finePolicies.status, 'active'),
        sql`${finePolicies.effectiveFrom} <= ${today}::date`,
        sql`(${finePolicies.effectiveTo} IS NULL OR ${finePolicies.effectiveTo} >= ${today}::date)`,
      ));

    const policy = body.finePolicyId ? policies.find(p => p.id === body.finePolicyId) ?? null : null;
    const active = body.finePolicyId ? (policy ? [policy] : []) : policies;
    if (body.finePolicyId && !policy) {
      return NextResponse.json({ success: false, message: 'Politique d\'amende active introuvable.' }, { status: 404 });
    }

    const overdue = await db
      .select({
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        studentId: invoices.studentId,
        dueDate: invoices.dueDate,
        netAmount: invoices.netAmount,
        paidAmount: invoices.paidAmount,
        className: user.classSectionId,
      })
      .from(invoices)
      .innerJoin(user, eq(invoices.studentId, user.id))
      .where(and(
        eq(invoices.tenantId, tenantId),
        ne(invoices.status, 'paid'),
        lt(invoices.dueDate, today),
      ));

    // Existing assessments per invoice+policy to keep runs idempotent.
    const existing = new Set<string>();
    if (overdue.length > 0) {
      const rows = await db
        .select({ invoiceId: fineAssessments.invoiceId, policyId: fineAssessments.finePolicyId })
        .from(fineAssessments)
        .where(and(
          eq(fineAssessments.tenantId, tenantId),
          inArray(fineAssessments.invoiceId, overdue.map(o => o.invoiceId)),
        ));
      for (const r of rows) existing.add(`${r.invoiceId}:${r.policyId}`);
    }

    const created: { invoiceId: string; finePolicyId: string; amount: number; studentId: string }[] = [];
    for (const inv of overdue) {
      for (const p of active) {
        if (p.scopeClassId && inv.className !== p.scopeClassId) continue;
        const key = `${inv.invoiceId}:${p.id}`;
        if (existing.has(key)) continue;

        const daysOverdue = Math.max(0, daysBetween(today, inv.dueDate) - p.graceDays);
        let amount = 0;
        if (p.formula === 'flat') amount = p.flatAmount;
        else if (p.formula === 'per_day') amount = p.perDayAmount * daysOverdue;
        else amount = p.flatAmount + p.perDayAmount * daysOverdue; // tiered: base + per-day
        if (p.maxAmount != null) amount = Math.min(amount, p.maxAmount);
        if (amount <= 0) continue;

        created.push({ invoiceId: inv.invoiceId, finePolicyId: p.id, amount, studentId: inv.studentId });
        existing.add(key);
      }
    }

    if (created.length > 0) {
      await db.insert(fineAssessments).values(created.map(c => ({
        tenantId,
        studentId: c.studentId,
        finePolicyId: c.finePolicyId,
        invoiceId: c.invoiceId,
        amount: c.amount,
        reason: 'Pénalité de retard automatique',
        status: 'assessed',
      })));
      await db.insert(invoiceEvents).values(created.map(c => ({
        tenantId,
        invoiceId: c.invoiceId,
        eventType: 'fine_assessed',
        payload: { finePolicyId: c.finePolicyId, amount: c.amount },
        actorUserId: context.userId,
      })));
    }

    const total = created.reduce((sum, c) => sum + c.amount, 0);
    recordAudit(context, 'create', 'fine_run', 'batch', { count: created.length, total });

    return NextResponse.json({
      success: true,
      data: { assessed: created.length, total, finePolicyId: active[0]?.id ?? null },
      message: `${created.length} amende(s) évaluée(s) pour un total de ${total.toFixed(2)} MAD.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
