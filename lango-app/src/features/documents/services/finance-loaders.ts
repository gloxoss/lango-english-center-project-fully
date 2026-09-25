import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { GET as getStatementResponse } from '@/app/api/finance/statements/route';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { brandingFileKey, readUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { receipts } from '@/features/finance/models/student-accounting-schema';
import { invoiceItems, invoices, payments, schoolSettings, tenants, user } from '@/models/Schema';
import type { DocumentModel, PreviewRequest } from '../contracts';

const money = (value: number | string) => `${Number(value).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

export async function loadSchoolBrand(tenantId: string) {
  const [[tenant], [settings]] = await Promise.all([
    db.select({ name: tenants.name, logo: tenants.logoUrl }).from(tenants).where(eq(tenants.id, tenantId)).limit(1),
    db.select().from(schoolSettings).where(eq(schoolSettings.tenantId, tenantId)).limit(1),
  ]);
  let logo: string | null = null;
  if (tenant?.logo) {
    try {
      const key = brandingFileKey(tenant.logo, 'logo');
      const bytes = await readUploadedFile(tenantId, key);
      if (bytes.length <= 2_000_000) {
        const mime = key.endsWith('.jpg') || key.endsWith('.jpeg') ? 'image/jpeg' : key.endsWith('.webp') ? 'image/webp' : 'image/png';
        logo = `data:${mime};base64,${bytes.toString('base64')}`;
      }
    } catch { /* The branding URL may refer to a removed upload. */ }
  }
  return {
    name: settings?.establishmentName || tenant?.name || '',
    address: settings?.address, city: settings?.city, phone: settings?.phone, email: settings?.email,
    logo, legal: [settings?.ice && `ICE ${settings.ice}`, settings?.rc && `RC ${settings.rc}`, settings?.taxId && `IF ${settings.taxId}`].filter(Boolean).join(' · '),
  };
}

async function requireStudent(tenantId: string, studentId: string, branchId?: string | null) {
  const [student] = await db.select({ id: user.id, name: user.name }).from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.id, studentId), branchId ? eq(user.branchId, branchId) : undefined)).limit(1);
  if (!student) throw new ApiError(404, 'NOT_FOUND', 'Document introuvable.');
  return student;
}

export async function loadFinanceDocument(request: Request, context: RequestContext, input: Extract<PreviewRequest, { kind: 'invoice' | 'receipt' | 'statement' }>, atIssue = false): Promise<DocumentModel> {
  const tenantId = context.tenantId;
  if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Établissement requis.');
  const schoolInfo = await loadSchoolBrand(tenantId);
  if (input.kind === 'invoice') {
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, input.sourceId))).limit(1);
    if (!invoice) throw new ApiError(404, 'NOT_FOUND', 'Facture introuvable.');
    const student = await requireStudent(tenantId, invoice.studentId, context.branchId);
    const items = await db.select().from(invoiceItems).where(and(eq(invoiceItems.tenantId, tenantId), eq(invoiceItems.invoiceId, invoice.id)));
    return {
      kind: 'invoice', title: 'Facture', reference: invoice.invoiceNumber, filename: `facture-${invoice.invoiceNumber}.pdf`,
      status: atIssue && invoice.status !== 'draft' ? 'Émise' : invoice.status, school: schoolInfo,
      details: [{ label: 'Élève', value: student.name }, { label: 'Date', value: invoice.issueDate }, { label: 'Échéance', value: invoice.dueDate }],
      columns: [{ key: 'description', label: 'Description' }, { key: 'amount', label: 'Montant', numeric: true }],
      rows: (items.length ? items : [{ description: invoice.note || 'Frais scolaires', amount: invoice.amount }]).map(item => ({ description: item.description, amount: money(item.amount) })),
      totals: [
        ...(invoice.discountAmount ? [{ label: 'Remise', value: `−${money(invoice.discountAmount)}` }] : []),
        { label: 'Total net', value: money(invoice.netAmount), strong: true },
        { label: 'Payé', value: money(atIssue ? 0 : invoice.paidAmount) },
        { label: 'Solde', value: money(atIssue ? invoice.netAmount : Number(invoice.netAmount) - Number(invoice.paidAmount)), strong: true },
      ], note: invoice.note,
    };
  }
  if (input.kind === 'receipt') {
    const [receipt] = await db.select().from(receipts).where(and(eq(receipts.tenantId, tenantId), eq(receipts.id, input.sourceId))).limit(1);
    if (!receipt) throw new ApiError(404, 'NOT_FOUND', 'Reçu introuvable.');
    const student = await requireStudent(tenantId, receipt.studentId, context.branchId);
    const [payment] = receipt.paymentId ? await db.select({ status: payments.status, method: payments.paymentMethod, reference: payments.referenceId })
      .from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.id, receipt.paymentId))).limit(1) : [];
    const allocations = Array.isArray(receipt.allocations) ? receipt.allocations as Array<{ invoiceNumber?: string; amount?: string }> : [];
    return {
      kind: 'receipt', title: 'Reçu de paiement', reference: receipt.receiptNumber, filename: `recu-${receipt.receiptNumber}.pdf`,
      status: atIssue ? 'Paiement enregistré' : payment?.status === 'reversed' ? 'Paiement annulé' : payment?.status === 'refunded' ? 'Paiement remboursé' : payment ? 'Paiement enregistré' : 'Statut historique non relié',
      school: schoolInfo, details: [
        { label: 'Élève', value: student.name }, { label: 'Date', value: receipt.paymentDate },
        { label: 'Mode', value: payment?.method ?? '' }, { label: 'Référence paiement', value: payment?.reference ?? '' },
      ],
      columns: [{ key: 'reference', label: 'Facture' }, { key: 'amount', label: 'Montant', numeric: true }],
      rows: allocations.map(item => ({ reference: item.invoiceNumber ?? '', amount: money(item.amount ?? 0) })),
      totals: [{ label: 'Montant reçu', value: money(receipt.amount), strong: true }],
    };
  }
  await requireStudent(tenantId, input.sourceId, context.branchId);
  const url = new URL('/api/finance/statements', request.url);
  url.searchParams.set('studentId', input.sourceId);
  if (input.startDate) url.searchParams.set('startDate', input.startDate);
  if (input.endDate) url.searchParams.set('endDate', input.endDate);
  const response = await getStatementResponse(new NextRequest(url, { headers: request.headers }));
  const body = await response.json() as { data?: {
    studentName: string; period: { startDate: string; endDate: string }; openingBalance: number; closingBalance: number;
    transactions: Array<{ date: string; description: string; reference: string; debit: number; credit: number; balance: number }>;
  } };
  if (!response.ok || !body.data) throw new ApiError(response.status, 'STATEMENT_FAILED', 'Relevé indisponible.');
  const statement = body.data;
  return {
    kind: 'statement', title: 'Relevé de compte', reference: `${statement.period.startDate} – ${statement.period.endDate}`,
    filename: `releve-${input.sourceId}-${statement.period.startDate}-${statement.period.endDate}.pdf`, school: schoolInfo,
    details: [{ label: 'Élève', value: statement.studentName }, { label: 'Période', value: `${statement.period.startDate} – ${statement.period.endDate}` }],
    columns: [{ key: 'date', label: 'Date' }, { key: 'description', label: 'Opération' }, { key: 'reference', label: 'Référence' }, { key: 'debit', label: 'Débit', numeric: true }, { key: 'credit', label: 'Crédit', numeric: true }, { key: 'balance', label: 'Solde', numeric: true }],
    rows: statement.transactions.map(row => ({ date: row.date, description: row.description, reference: row.reference, debit: row.debit ? money(row.debit) : '', credit: row.credit ? money(row.credit) : '', balance: money(row.balance) })),
    totals: [{ label: 'Solde initial', value: money(statement.openingBalance) }, { label: 'Solde final', value: money(statement.closingBalance), strong: true }],
  };
}
