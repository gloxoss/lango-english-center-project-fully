import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { MONTH_NAMES_FR } from '@/libs/i18n/months';
import { payrollPeriods, payrollRunLines, payslips, user } from '@/models/Schema';

export type ListPayslipsParams = {
  tenantId: string;
  /** Restrict to one user's payslips. Undefined = all users (HR admin view). */
  userId?: string;
};

export async function listPayslips({ tenantId, userId }: ListPayslipsParams) {
  return db
    .select({
      id: payslips.id,
      periodId: payslips.periodId,
      userId: payslips.userId,
      issuedAt: payslips.issuedAt,
      employeeName: user.name,
      year: payrollPeriods.year,
      month: payrollPeriods.month,
      grossSalary: payrollRunLines.grossSalary,
      netSalary: payrollRunLines.netSalary,
      cnssEmployee: payrollRunLines.cnssEmployee,
      amoEmployee: payrollRunLines.amoEmployee,
      irTax: payrollRunLines.irTax,
    })
    .from(payslips)
    .innerJoin(user, eq(payslips.userId, user.id))
    .innerJoin(payrollPeriods, eq(payslips.periodId, payrollPeriods.id))
    .innerJoin(payrollRunLines, eq(payslips.runLineId, payrollRunLines.id))
    .where(
      and(
        eq(payslips.tenantId, tenantId),
        isNotNull(payslips.issuedAt),
        inArray(payrollPeriods.status, ['locked', 'approved', 'posted', 'paid', 'closed']),
        userId ? eq(payslips.userId, userId) : undefined,
      ),
    );
}

type PayslipRow = {
  id: string;
  userId: string;
  pdfStorageKey: string | null;
  issuedAt: string | null;
  employeeName: string;
  employeeEmail: string;
  year: number | null;
  month: number | null;
  grossSalary: string;
  netSalary: string;
  cnssEmployee: string;
  amoEmployee: string;
  irTax: string;
  cnssEmployer: string;
  amoEmployer: string;
  totalEmployerCost: string;
  snapshot: unknown;
};

export async function getPayslip(tenantId: string, payslipId: string, userId?: string): Promise<PayslipRow | null> {
  const [row] = await db
    .select({
      id: payslips.id,
      userId: payslips.userId,
      pdfStorageKey: payslips.pdfStorageKey,
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
    .where(
      and(
        eq(payslips.id, payslipId),
        eq(payslips.tenantId, tenantId),
        isNotNull(payslips.issuedAt),
        inArray(payrollPeriods.status, ['locked', 'approved', 'posted', 'paid', 'closed']),
        userId ? eq(payslips.userId, userId) : undefined,
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Render a payslip as a printable HTML bulletin. Shared by the admin
 * `[id]/pdf` route and the employee self-service download route so both always
 * show the same layout.
 */
export function renderPayslipHtml(row: Pick<PayslipRow, 'employeeName' | 'employeeEmail' | 'issuedAt' | 'year' | 'month' | 'grossSalary' | 'cnssEmployee' | 'amoEmployee' | 'irTax' | 'netSalary' | 'cnssEmployer' | 'amoEmployer' | 'totalEmployerCost'>): string {
  const monthLabel = `${MONTH_NAMES_FR[(row.month ?? 1) - 1]} ${row.year}`;
  const escapeHtml = (value: unknown) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

  return `<!DOCTYPE html>
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
    <tr><td>Nom</td><td>${escapeHtml(row.employeeName)}</td></tr>
    <tr><td>Email</td><td>${escapeHtml(row.employeeEmail)}</td></tr>
    <tr><td>Date d'émission</td><td>${escapeHtml(row.issuedAt)}</td></tr>
  </table>
  <table style="margin-top:20px">
    <tr><th>Rubrique</th><th>Montant (DH)</th></tr>
    <tr><td>Salaire Brut</td><td>${Number(row.grossSalary).toFixed(2)}</td></tr>
    <tr><td>CNSS Salarié</td><td>−${Number(row.cnssEmployee).toFixed(2)}</td></tr>
    <tr><td>AMO Salarié</td><td>−${Number(row.amoEmployee).toFixed(2)}</td></tr>
    <tr><td>IR (Impôt sur le revenu)</td><td>−${Number(row.irTax).toFixed(2)}</td></tr>
    <tr class="net-row"><td>Salaire Net à Payer</td><td>${Number(row.netSalary).toFixed(2)}</td></tr>
  </table>
  <table style="margin-top:20px">
    <tr><th colspan="2">Charges Patronales</th></tr>
    <tr><td>CNSS Patronal</td><td>${Number(row.cnssEmployer).toFixed(2)}</td></tr>
    <tr><td>AMO Patronal</td><td>${Number(row.amoEmployer).toFixed(2)}</td></tr>
    <tr class="total-row"><td>Coût Total Employeur</td><td>${Number(row.totalEmployerCost).toFixed(2)}</td></tr>
  </table>
  <p class="footer">Document généré automatiquement par SchoolOS — Confidentiel</p>
</body>
</html>`;
}
