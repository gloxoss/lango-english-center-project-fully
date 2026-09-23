import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, fineAssessments, finePolicies, invoiceEvents, invoices, user } from '@/models/Schema';
import { casablancaTodayIso } from '@/libs/finance/today';

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

    const today = casablancaTodayIso();

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
        classId: classSections.classId,
        sectionId: user.classSectionId,
      })
      .from(invoices)
      .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
      .leftJoin(classSections, and(eq(user.classSectionId, classSections.id), eq(classSections.tenantId, tenantId)))
      .where(and(
        eq(invoices.tenantId, tenantId),
        inArray(invoices.status, ['pending', 'partial', 'overdue']),
        lt(invoices.dueDate, today),
        sql`${invoices.netAmount} > ${invoices.paidAmount}`,
        ...(context.branchId ? [eq(user.branchId, context.branchId)] : []),
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
        if (p.scopeClassId && inv.classId !== p.scopeClassId) continue;
        if (p.scopeSectionId && inv.sectionId !== p.scopeSectionId) continue;
        const key = `${inv.invoiceId}:${p.id}`;
        if (existing.has(key)) continue;

        const daysOverdue = Math.max(0, daysBetween(today, inv.dueDate) - p.graceDays);
        if (daysOverdue === 0) continue;
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

    const inserted = created.length > 0 ? await db.transaction(async (tx) => {
      // Serialize runs for this tenant. Recheck within the lock because the
      // preflight list can become stale while another run or payment commits.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`fine-run:${tenantId}`}))`);
      const currentInvoices = await tx.select({ id: invoices.id })
        .from(invoices)
        .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(invoices.tenantId, tenantId),
          inArray(invoices.id, created.map((c) => c.invoiceId)),
          inArray(invoices.status, ['pending', 'partial', 'overdue']),
          lt(invoices.dueDate, today),
          sql`${invoices.netAmount} > ${invoices.paidAmount}`,
          ...(context.branchId ? [eq(user.branchId, context.branchId)] : []),
        ))
        .for('update', { of: invoices });
      const currentIds = new Set(currentInvoices.map((row) => row.id));
      const already = await tx.select({ invoiceId: fineAssessments.invoiceId, policyId: fineAssessments.finePolicyId })
        .from(fineAssessments)
        .where(and(
          eq(fineAssessments.tenantId, tenantId),
          inArray(fineAssessments.invoiceId, created.map((c) => c.invoiceId)),
        ));
      const existingKeys = new Set(already.map((row) => `${row.invoiceId}:${row.policyId}`));
      const toInsert = created.filter((candidate) => currentIds.has(candidate.invoiceId)
        && !existingKeys.has(`${candidate.invoiceId}:${candidate.finePolicyId}`));
      if (toInsert.length === 0) return [];
      await tx.insert(fineAssessments).values(toInsert.map((candidate) => ({
        tenantId,
        studentId: candidate.studentId,
        finePolicyId: candidate.finePolicyId,
        invoiceId: candidate.invoiceId,
        amount: candidate.amount,
        reason: 'Pénalité de retard automatique',
        status: 'assessed',
      })));
      await tx.insert(invoiceEvents).values(toInsert.map((candidate) => ({
        tenantId,
        invoiceId: candidate.invoiceId,
        eventType: 'fine_assessed',
        payload: { finePolicyId: candidate.finePolicyId, amount: candidate.amount },
        actorUserId: context.userId,
      })));
      return toInsert;
    }) : [];

    const total = inserted.reduce((sum, c) => sum + c.amount, 0);
    recordAudit(context, 'create', 'fine_run', 'batch', { count: inserted.length, total });

    return NextResponse.json({
      success: true,
      data: { assessed: inserted.length, total, finePolicyId: active[0]?.id ?? null },
      message: `${inserted.length} amende(s) évaluée(s) pour un total de ${total.toFixed(2)} MAD.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
