import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import {
  accountingAdapterExceptions,
  accountingJournalLinks,
  accountingPostingRequests,
  accountingSourceMappings,
  chartOfAccounts,
  invoiceItems,
  invoices,
  journalEntries,
  payments,
} from '@/models/Schema';
import { postAccountingVoucher, type AccountingPostingLine } from '@/features/accounting/services/posting-service';

export type AdapterPrincipal = { tenantId: string; userId: string };
export type StudentDocumentType = 'invoice' | 'payment';
export type AdapterPostingRef = { journalCode: string; voucherTypeCode: string };
export type MappingInput = { sourceModule: string; sourceKeyType: string; sourceKey: string | null; accountId: string };

export const STUDENT_INVOICE_MODULE = 'student_invoice';
export const STUDENT_PAYMENT_MODULE = 'student_payment';
const STUDENT_MODULES = [STUDENT_INVOICE_MODULE, STUDENT_PAYMENT_MODULE];
const KEY_TYPES = ['fee_category', 'payment_method', 'student'] as const;

// ----- account mapping resolution (exact key, then the module default) -----

async function resolveStudentAccount(tenantId: string, module: string, keyType: string, key: string | null): Promise<string | null> {
  const rows = await db.select({ accountId: accountingSourceMappings.accountId })
    .from(accountingSourceMappings)
    .where(and(
      eq(accountingSourceMappings.tenantId, tenantId),
      eq(accountingSourceMappings.sourceModule, module),
      eq(accountingSourceMappings.sourceKeyType, keyType),
      key === null ? isNull(accountingSourceMappings.sourceKey) : eq(accountingSourceMappings.sourceKey, key),
    ))
    .limit(1);
  return rows[0]?.accountId ?? null;
}

async function resolveStudentAccountWithDefault(tenantId: string, module: string, keyType: string, key: string | null): Promise<string | null> {
  if (key !== null) {
    const exact = await resolveStudentAccount(tenantId, module, keyType, key);
    if (exact) return exact;
  }
  return resolveStudentAccount(tenantId, module, keyType, null);
}

// Exact largest-remainder allocation: splits netCents across item amounts so the
// returned credits always sum exactly to netCents (survives per-invoice discounts).
function allocateNetAcrossItems(netCents: bigint, itemCents: bigint[]): bigint[] {
  const totalItems = itemCents.reduce((sum, value) => sum + value, BigInt(0));
  if (totalItems <= BigInt(0)) return [];
  const scaled = itemCents.map(value => ({
    base: (value * netCents) / totalItems,
    rem: (value * netCents) % totalItems,
  }));
  const result = scaled.map(entry => entry.base);
  let remaining = netCents - result.reduce((sum, value) => sum + value, BigInt(0));
  const order = scaled.map((entry, index) => ({ index, rem: entry.rem }))
    .sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : 0));
  for (const { index } of order) {
    if (remaining <= BigInt(0)) break;
    result[index] = (result[index] ?? BigInt(0)) + BigInt(1);
    remaining -= BigInt(1);
  }
  return result;
}

// ----- exception queue (never suspense: unmapped => blocked, never guessed) -----

type ExceptionInput = {
  sourceModule: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  version: number;
  reason: string;
  detail: string;
  payload: Record<string, unknown>;
};

async function insertException(principal: AdapterPrincipal, input: ExceptionInput) {
  const [row] = await db.insert(accountingAdapterExceptions).values({
    tenantId: principal.tenantId,
    sourceModule: input.sourceModule,
    sourceDocumentType: input.sourceDocumentType,
    sourceDocumentId: input.sourceDocumentId,
    version: input.version,
    reason: input.reason,
    detail: input.detail,
    payload: input.payload,
    status: 'open',
    createdBy: principal.userId,
  }).onConflictDoNothing().returning();
  return row;
}

async function resolveOpenException(principal: AdapterPrincipal, sourceModule: string, sourceDocumentId: string, note: string) {
  await db.update(accountingAdapterExceptions).set({
    status: 'resolved',
    resolvedBy: principal.userId,
    resolvedAt: new Date().toISOString(),
    resolutionNote: note,
  }).where(and(
    eq(accountingAdapterExceptions.tenantId, principal.tenantId),
    eq(accountingAdapterExceptions.sourceModule, sourceModule),
    eq(accountingAdapterExceptions.sourceDocumentId, sourceDocumentId),
    eq(accountingAdapterExceptions.status, 'open'),
  ));
}

// ----- posting adapter -----

export async function postStudentInvoice(principal: AdapterPrincipal, invoiceId: string, posting: AdapterPostingRef) {
  const [invoice] = await db.select().from(invoices).where(and(
    eq(invoices.tenantId, principal.tenantId),
    eq(invoices.id, invoiceId),
  ));
  if (!invoice) throw new ApiError(404, 'STUDENT_INVOICE_NOT_FOUND', 'Facture introuvable.');
  if (invoice.status === 'cancelled') {
    throw new ApiError(409, 'STUDENT_INVOICE_CANCELLED', 'Une facture annulée ne peut pas être comptabilisée.');
  }
  const items = await db.select().from(invoiceItems).where(and(
    eq(invoiceItems.tenantId, principal.tenantId),
    eq(invoiceItems.invoiceId, invoiceId),
  )).orderBy(invoiceItems.amount);

  const receivableId = await resolveStudentAccountWithDefault(principal.tenantId, STUDENT_INVOICE_MODULE, 'student', invoice.studentId);

  const categoryRows: { accountId: string; itemCents: bigint; label: string }[] = [];
  for (const item of items) {
    if (!item.feeCategoryId) continue;
    const revenueId = await resolveStudentAccountWithDefault(principal.tenantId, STUDENT_INVOICE_MODULE, 'fee_category', item.feeCategoryId);
    categoryRows.push({ accountId: revenueId ?? '', itemCents: moneyToCents(String(item.amount)), label: item.description || 'Frais' });
  }
  if (categoryRows.length === 0) {
    const revenueId = await resolveStudentAccountWithDefault(principal.tenantId, STUDENT_INVOICE_MODULE, 'fee_category', null);
    if (revenueId) categoryRows.push({ accountId: revenueId, itemCents: moneyToCents(String(invoice.netAmount)), label: 'Frais' });
  }

  const missingCategory = categoryRows.find(row => row.accountId === '')?.label ?? null;
  const missing = !receivableId ? 'MAPPING_RECEIVABLE_MISSING' : missingCategory ? 'MAPPING_FEE_CATEGORY_MISSING' : null;
  if (missing) {
    const exception = await insertException(principal, {
      sourceModule: STUDENT_INVOICE_MODULE,
      sourceDocumentType: 'invoice',
      sourceDocumentId: invoiceId,
      version: 1,
      reason: missing,
      detail: `Facture ${invoice.invoiceNumber} (étudiant ${invoice.studentId}) — mapping comptable incomplet.`,
      payload: {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        netAmount: String(invoice.netAmount),
        missing: missing === 'MAPPING_RECEIVABLE_MISSING' ? 'receivable' : `fee_category:${missingCategory}`,
      },
    });
    return { blocked: true as const, reason: missing, exceptionId: exception?.id ?? null };
  }

  const netCents = moneyToCents(String(invoice.netAmount));
  const credits = allocateNetAcrossItems(netCents, categoryRows.map(row => row.itemCents));
  const lines: AccountingPostingLine[] = [
    { accountId: receivableId as string, debitAmount: centsToMoney(netCents), creditAmount: '0', memo: `Facture ${invoice.invoiceNumber}` },
    ...categoryRows.map((row, index) => ({
      accountId: row.accountId, debitAmount: '0', creditAmount: centsToMoney(credits[index] ?? BigInt(0)), memo: row.label,
    })),
  ];

  const result = await postAccountingVoucher({
    tenantId: principal.tenantId,
    actorId: principal.userId,
    entryDate: invoice.issueDate,
    description: `Scolarité — facture ${invoice.invoiceNumber}`,
    sourceModule: STUDENT_INVOICE_MODULE,
    sourceDocumentId: invoiceId,
    sourceVersion: 1,
    idempotencyKey: `${STUDENT_INVOICE_MODULE}:${principal.tenantId}:${invoiceId}`,
    journalCode: posting.journalCode,
    voucherTypeCode: posting.voucherTypeCode,
    lines,
  });
  await resolveOpenException(principal, STUDENT_INVOICE_MODULE, invoiceId, `Comptabilisée ${result.entry.entryNumber}`);
  return { ...result, blocked: false as const };
}

export async function postStudentPayment(principal: AdapterPrincipal, paymentId: string, posting: AdapterPostingRef) {
  const [payment] = await db.select().from(payments).where(and(
    eq(payments.tenantId, principal.tenantId),
    eq(payments.id, paymentId),
  ));
  if (!payment) throw new ApiError(404, 'STUDENT_PAYMENT_NOT_FOUND', 'Paiement introuvable.');
  const [invoice] = await db.select({
    studentId: invoices.studentId,
    invoiceNumber: invoices.invoiceNumber,
  }).from(invoices).where(and(
    eq(invoices.tenantId, principal.tenantId),
    eq(invoices.id, payment.invoiceId),
  ));

  const bankId = await resolveStudentAccountWithDefault(principal.tenantId, STUDENT_PAYMENT_MODULE, 'payment_method', payment.paymentMethod);
  const receivableId = await resolveStudentAccountWithDefault(principal.tenantId, STUDENT_PAYMENT_MODULE, 'student', invoice?.studentId ?? null);
  const missing = !bankId ? 'MAPPING_PAYMENT_METHOD_MISSING' : !receivableId ? 'MAPPING_RECEIVABLE_MISSING' : null;
  if (missing) {
    const exception = await insertException(principal, {
      sourceModule: STUDENT_PAYMENT_MODULE,
      sourceDocumentType: 'payment',
      sourceDocumentId: paymentId,
      version: 1,
      reason: missing,
      detail: `Règlement ${payment.referenceId ?? paymentId} (${payment.paymentMethod}) — mapping comptable incomplet.`,
      payload: {
        paymentId,
        invoiceId: payment.invoiceId,
        amount: String(payment.amount),
        paymentMethod: payment.paymentMethod,
        missing: missing === 'MAPPING_RECEIVABLE_MISSING' ? 'receivable' : `payment_method:${payment.paymentMethod}`,
      },
    });
    return { blocked: true as const, reason: missing, exceptionId: exception?.id ?? null };
  }

  const amountCents = moneyToCents(String(payment.amount));
  const lines: AccountingPostingLine[] = [
    { accountId: bankId as string, debitAmount: centsToMoney(amountCents), creditAmount: '0', memo: `Règlement ${payment.referenceId ?? '—'}` },
    { accountId: receivableId as string, debitAmount: '0', creditAmount: centsToMoney(amountCents), memo: `Facture ${invoice?.invoiceNumber ?? payment.invoiceId}` },
  ];

  const result = await postAccountingVoucher({
    tenantId: principal.tenantId,
    actorId: principal.userId,
    entryDate: payment.paymentDate.slice(0, 10),
    description: `Scolarité — règlement ${payment.referenceId ?? paymentId}`,
    sourceModule: STUDENT_PAYMENT_MODULE,
    sourceDocumentId: paymentId,
    sourceVersion: 1,
    idempotencyKey: `${STUDENT_PAYMENT_MODULE}:${principal.tenantId}:${paymentId}`,
    journalCode: posting.journalCode,
    voucherTypeCode: posting.voucherTypeCode,
    lines,
  });
  await resolveOpenException(principal, STUDENT_PAYMENT_MODULE, paymentId, `Comptabilisé ${result.entry.entryNumber}`);
  return { ...result, blocked: false as const };
}

// ----- mapping management -----

export async function listSourceMappings(principal: AdapterPrincipal, sourceModule?: string) {
  return db.select().from(accountingSourceMappings).where(and(
    eq(accountingSourceMappings.tenantId, principal.tenantId),
    sourceModule ? eq(accountingSourceMappings.sourceModule, sourceModule) : undefined,
  )).orderBy(accountingSourceMappings.sourceModule, accountingSourceMappings.sourceKeyType);
}

export async function upsertSourceMapping(principal: AdapterPrincipal, input: MappingInput) {
  if (!STUDENT_MODULES.includes(input.sourceModule)) {
    throw new ApiError(422, 'INVALID_SOURCE_MODULE', 'Module source comptable inconnu.');
  }
  if (!(KEY_TYPES as readonly string[]).includes(input.sourceKeyType)) {
    throw new ApiError(422, 'INVALID_SOURCE_KEY_TYPE', 'Type de clé de mapping inconnu.');
  }
  const isDefault = input.sourceKey === null;
  const [account] = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(
    eq(chartOfAccounts.tenantId, principal.tenantId),
    eq(chartOfAccounts.id, input.accountId),
    eq(chartOfAccounts.isActive, true),
  ));
  if (!account) throw new ApiError(422, 'INVALID_ACCOUNT', 'Le compte cible est inactif ou appartient à un autre établissement.');

  const base = {
    tenantId: principal.tenantId,
    sourceModule: input.sourceModule,
    sourceKeyType: input.sourceKeyType,
    sourceKey: input.sourceKey,
    accountId: input.accountId,
    updatedBy: principal.userId,
    updatedAt: new Date().toISOString(),
  };

  if (isDefault) {
    return db.transaction(async (tx) => {
      await tx.delete(accountingSourceMappings).where(and(
        eq(accountingSourceMappings.tenantId, principal.tenantId),
        eq(accountingSourceMappings.sourceModule, input.sourceModule),
        eq(accountingSourceMappings.sourceKeyType, input.sourceKeyType),
        isNull(accountingSourceMappings.sourceKey),
      ));
      const [row] = await tx.insert(accountingSourceMappings).values({
        ...base,
        createdBy: principal.userId,
        createdAt: new Date().toISOString(),
      }).returning();
      if (!row) throw new ApiError(500, 'MAPPING_INSERT_FAILED', 'Impossible d’enregistrer le mapping par défaut.');
      return row;
    });
  }

  const [row] = await db.insert(accountingSourceMappings).values({
    ...base,
    createdBy: principal.userId,
    createdAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: [accountingSourceMappings.tenantId, accountingSourceMappings.sourceModule, accountingSourceMappings.sourceKeyType, accountingSourceMappings.sourceKey],
    set: { accountId: input.accountId, updatedBy: principal.userId, updatedAt: new Date().toISOString() },
  }).returning();
  return row as NonNullable<typeof row>;
}

export async function deleteSourceMapping(principal: AdapterPrincipal, id: string) {
  const [row] = await db.select({ id: accountingSourceMappings.id }).from(accountingSourceMappings).where(and(
    eq(accountingSourceMappings.tenantId, principal.tenantId),
    eq(accountingSourceMappings.id, id),
  ));
  if (!row) throw new ApiError(404, 'MAPPING_NOT_FOUND', 'Mapping introuvable.');
  await db.delete(accountingSourceMappings).where(and(
    eq(accountingSourceMappings.tenantId, principal.tenantId),
    eq(accountingSourceMappings.id, id),
  ));
  return { deleted: true };
}

// ----- exception queue -----

export async function listAdapterExceptions(principal: AdapterPrincipal, status?: string) {
  return db.select().from(accountingAdapterExceptions).where(and(
    eq(accountingAdapterExceptions.tenantId, principal.tenantId),
    status ? eq(accountingAdapterExceptions.status, status) : undefined,
  )).orderBy(sql`${accountingAdapterExceptions.createdAt} desc`).limit(200);
}

export async function resolveAdapterException(principal: AdapterPrincipal, exceptionId: string, action: 'resolve' | 'dismiss', note?: string) {
  const [row] = await db.select().from(accountingAdapterExceptions).where(and(
    eq(accountingAdapterExceptions.tenantId, principal.tenantId),
    eq(accountingAdapterExceptions.id, exceptionId),
  ));
  if (!row) throw new ApiError(404, 'ADAPTER_EXCEPTION_NOT_FOUND', 'Exception introuvable.');
  if (row.status !== 'open') throw new ApiError(409, 'ADAPTER_EXCEPTION_NOT_OPEN', 'Seule une exception ouverte peut être traitée.');
  const next = action === 'dismiss' ? 'dismissed' : 'resolved';
  await db.update(accountingAdapterExceptions).set({
    status: next,
    resolvedBy: principal.userId,
    resolvedAt: new Date().toISOString(),
    resolutionNote: note?.trim() || null,
  }).where(eq(accountingAdapterExceptions.id, exceptionId));
  return { id: exceptionId, status: next };
}

// ----- source-to-ledger reconciliation report -----

export async function studentLedgerReconciliation(principal: AdapterPrincipal) {
  const posted = await db.select({
    sourceModule: accountingPostingRequests.sourceModule,
    sourceDocumentId: accountingPostingRequests.sourceDocumentId,
    entryNumber: journalEntries.entryNumber,
    entryDate: journalEntries.entryDate,
  }).from(accountingPostingRequests)
    .innerJoin(accountingJournalLinks, and(
      eq(accountingJournalLinks.tenantId, accountingPostingRequests.tenantId),
      eq(accountingJournalLinks.postingRequestId, accountingPostingRequests.id),
    ))
    .innerJoin(journalEntries, and(
      eq(journalEntries.tenantId, accountingPostingRequests.tenantId),
      eq(journalEntries.id, accountingJournalLinks.journalEntryId),
    ))
    .where(and(
      eq(accountingPostingRequests.tenantId, principal.tenantId),
      inArray(accountingPostingRequests.sourceModule, STUDENT_MODULES),
    ));

  const exceptions = await db.select().from(accountingAdapterExceptions).where(and(
    eq(accountingAdapterExceptions.tenantId, principal.tenantId),
    eq(accountingAdapterExceptions.status, 'open'),
  ));

  const postedByKey = new Map<string, (typeof posted)[number]>();
  for (const row of posted) postedByKey.set(`${row.sourceModule}:${row.sourceDocumentId}`, row);
  const blockedByKey = new Map<string, (typeof exceptions)[number]>();
  for (const row of exceptions) blockedByKey.set(`${row.sourceModule}:${row.sourceDocumentId}`, row);

  const invoiceRows = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    netAmount: invoices.netAmount,
    issueDate: invoices.issueDate,
  }).from(invoices).where(eq(invoices.tenantId, principal.tenantId));
  const paymentRows = await db.select({
    id: payments.id,
    invoiceId: payments.invoiceId,
    amount: payments.amount,
    paymentDate: payments.paymentDate,
    referenceId: payments.referenceId,
  }).from(payments).where(eq(payments.tenantId, principal.tenantId));

  const rows: {
    sourceModule: string;
    documentType: string;
    documentId: string;
    number: string;
    amount: string;
    state: 'posted' | 'blocked' | 'pending';
    entryNumber: string | null;
    reason: string | null;
  }[] = [];
  let sourceTotal = BigInt(0);
  let postedTotal = BigInt(0);
  let blockedTotal = BigInt(0);
  let pendingTotal = BigInt(0);

  for (const inv of invoiceRows) {
    const key = `${STUDENT_INVOICE_MODULE}:${inv.id}`;
    const cents = moneyToCents(String(inv.netAmount));
    sourceTotal += cents;
    const entry = postedByKey.get(key);
    const blocked = blockedByKey.get(key);
    const state = entry ? 'posted' : blocked ? 'blocked' : 'pending';
    if (entry) postedTotal += cents;
    else if (blocked) blockedTotal += cents;
    else pendingTotal += cents;
    rows.push({
      sourceModule: STUDENT_INVOICE_MODULE,
      documentType: 'invoice',
      documentId: inv.id,
      number: inv.invoiceNumber,
      amount: centsToMoney(cents),
      state,
      entryNumber: entry?.entryNumber ?? null,
      reason: blocked?.reason ?? null,
    });
  }

  for (const pay of paymentRows) {
    const key = `${STUDENT_PAYMENT_MODULE}:${pay.id}`;
    const cents = moneyToCents(String(pay.amount));
    sourceTotal += cents;
    const entry = postedByKey.get(key);
    const blocked = blockedByKey.get(key);
    const state = entry ? 'posted' : blocked ? 'blocked' : 'pending';
    if (entry) postedTotal += cents;
    else if (blocked) blockedTotal += cents;
    else pendingTotal += cents;
    rows.push({
      sourceModule: STUDENT_PAYMENT_MODULE,
      documentType: 'payment',
      documentId: pay.id,
      number: pay.referenceId ?? pay.id,
      amount: centsToMoney(cents),
      state,
      entryNumber: entry?.entryNumber ?? null,
      reason: blocked?.reason ?? null,
    });
  }

  return {
    rows,
    summary: {
      sourceTotal: centsToMoney(sourceTotal),
      postedTotal: centsToMoney(postedTotal),
      blockedTotal: centsToMoney(blockedTotal),
      pendingTotal: centsToMoney(pendingTotal),
      drift: centsToMoney(sourceTotal - postedTotal),
    },
    counts: {
      posted: rows.filter(row => row.state === 'posted').length,
      blocked: rows.filter(row => row.state === 'blocked').length,
      pending: rows.filter(row => row.state === 'pending').length,
    },
  };
}
