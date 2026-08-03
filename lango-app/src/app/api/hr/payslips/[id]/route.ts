import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { MONTH_NAMES_FR } from '@/libs/i18n/months';
import { db } from '@/libs/DB';
import { payrollPeriods, payrollRunLines, payslips, user } from '@/models/Schema';

// GET /api/hr/payslips/[id] — Fetch single payslip (with auth guard)
// GET /api/hr/payslips/[id]/pdf — Render bulletin de paie as HTML

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    const { id } = await params;

    const [row] = await db
      .select({
        id: payslips.id,
        userId: payslips.userId,
        issuedAt: payslips.issuedAt,
        employeeName: user.name,
        employeeEmail: user.email,
        year: payrollPeriods.year,
        month: payrollPeriods.month,
        grossSalary: payrollRunLines.grossSalary,
        netSalary: payrollRunLines.netSalary,
        cnssEmployee: payrollRunLines.cnssEmployee,
        amoEmployee: payrollRunLines.amoEmployee,
        irTax: payrollRunLines.irTax,
        cnssEmployer: payrollRunLines.cnssEmployer,
        amoEmployer: payrollRunLines.amoEmployer,
        totalEmployerCost: payrollRunLines.totalEmployerCost,
        snapshot: payrollRunLines.calculationSnapshot,
      })
      .from(payslips)
      .innerJoin(user, eq(payslips.userId, user.id))
      .innerJoin(payrollPeriods, eq(payslips.periodId, payrollPeriods.id))
      .innerJoin(payrollRunLines, eq(payslips.runLineId, payrollRunLines.id))
      .where(and(eq(payslips.id, id), eq(payslips.tenantId, tenantId)))
      .limit(1);

    if (!row) {
      throw new ApiError(404, 'NOT_FOUND', 'Bulletin de paie introuvable.');
    }

    // Ownership check: non-HR staff can only view their own payslip
    const isHrAdmin = ['school_admin', 'accountant'].includes(ctx.role);
    if (!isHrAdmin && row.userId !== ctx.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès non autorisé à ce bulletin de paie.');
    }

    // Check if request wants HTML (pdf view)
    const url = new URL(request.url);
    if (url.pathname.endsWith('/pdf')) {
      const monthLabel = `${MONTH_NAMES_FR[(row.month ?? 1) - 1]} ${row.year}`;

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bulletin de Paie — ${monthLabel}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; color: #333; }
    h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #1e293b; color: #fff; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .total-row td { font-weight: bold; background: #f8fafc; }
    .net-row td { font-weight: bold; background: #0f172a; color: #fff; font-size: 14px; }
    .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>Bulletin de Paie</h1>
  <p class="subtitle">${monthLabel}</p>
  <table>
    <tr><th colspan="2">Employé</th></tr>
    <tr><td>Nom</td><td>${row.employeeName}</td></tr>
    <tr><td>Email</td><td>${row.employeeEmail}</td></tr>
    <tr><td>Date d'émission</td><td>${row.issuedAt}</td></tr>
  </table>
  <table style="margin-top:20px">
    <tr><th>Rubrique</th><th>Montant (DH)</th></tr>
    <tr><td>Salaire Brut</td><td>${Number(row.grossSalary).toFixed(2)}</td></tr>
    <tr><td>CNSS Salarié (4.48%)</td><td>−${Number(row.cnssEmployee).toFixed(2)}</td></tr>
    <tr><td>AMO Salarié (2.26%)</td><td>−${Number(row.amoEmployee).toFixed(2)}</td></tr>
    <tr><td>IR (Impôt sur le revenu)</td><td>−${Number(row.irTax).toFixed(2)}</td></tr>
    <tr class="net-row"><td>Salaire Net à Payer</td><td>${Number(row.netSalary).toFixed(2)}</td></tr>
  </table>
  <table style="margin-top:20px">
    <tr><th colspan="2">Charges Patronales</th></tr>
    <tr><td>CNSS Patronal (8.98%)</td><td>${Number(row.cnssEmployer).toFixed(2)}</td></tr>
    <tr><td>AMO Patronal (3.26%)</td><td>${Number(row.amoEmployer).toFixed(2)}</td></tr>
    <tr class="total-row"><td>Coût Total Employeur</td><td>${Number(row.totalEmployerCost).toFixed(2)}</td></tr>
  </table>
  <p class="footer">Document généré automatiquement par SchoolOS — Confidentiel</p>
</body>
</html>`;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
