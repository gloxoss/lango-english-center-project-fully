import { and, eq, inArray } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents, normalizeMoney } from '@/libs/finance/money';
import { postAccountingVoucher, reverseAccountingVoucher, type AccountingPostingLine } from './posting-service';
import { accountingDocumentEvents, accountingDocumentLines, accountingDocuments, chartOfAccounts } from '@/models/Schema';

export type CreateAccountingDocumentInput = {
  tenantId: string;
  actorId: string;
  documentType: 'deposit' | 'expense' | 'manual_journal';
  documentDate: string;
  reference?: string;
  counterparty?: string;
  description: string;
  lines: AccountingPostingLine[];
};

function validateDocumentLines(lines: AccountingPostingLine[]) {
  if (lines.length < 2) throw new ApiError(422, 'DOCUMENT_LINES_REQUIRED', 'La pièce doit contenir au moins deux lignes.');
  const normalized = lines.map((line) => {
    const debit = moneyToCents(line.debitAmount);
    const credit = moneyToCents(line.creditAmount);
    if ((debit > BigInt(0)) === (credit > BigInt(0))) throw new ApiError(422, 'INVALID_DOCUMENT_LINE', 'Chaque ligne doit avoir un seul côté positif.');
    return { ...line, debit, credit };
  });
  const debit = normalized.reduce((sum, line) => sum + line.debit, BigInt(0));
  const credit = normalized.reduce((sum, line) => sum + line.credit, BigInt(0));
  if (debit !== credit) throw new ApiError(422, 'UNBALANCED_DOCUMENT', 'La pièce doit être équilibrée.');
  return { normalized, total: centsToMoney(debit) };
}

export async function createAccountingDocument(input: CreateAccountingDocumentInput) {
  const { normalized, total } = validateDocumentLines(input.lines);
  return db.transaction(async (tx) => {
    const ids = [...new Set(normalized.map(line => line.accountId))];
    const accounts = await tx.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(
      eq(chartOfAccounts.tenantId, input.tenantId), eq(chartOfAccounts.isActive, true), inArray(chartOfAccounts.id, ids),
    ));
    if (accounts.length !== ids.length) throw new ApiError(422, 'INVALID_ACCOUNT', 'Une ligne référence un compte invalide.');
    const [document] = await tx.insert(accountingDocuments).values({
      tenantId: input.tenantId, documentType: input.documentType, status: 'draft', documentDate: input.documentDate,
      reference: input.reference?.trim() || null, counterparty: input.counterparty?.trim() || null,
      description: input.description, totalAmount: total, createdById: input.actorId,
    }).returning();
    if (!document) throw new ApiError(500, 'DOCUMENT_CREATE_FAILED', 'Impossible de créer la pièce comptable.');
    await tx.insert(accountingDocumentLines).values(normalized.map(line => ({
      tenantId: input.tenantId, documentId: document.id, accountId: line.accountId,
      debitAmount: normalizeMoney(line.debitAmount), creditAmount: normalizeMoney(line.creditAmount), memo: line.memo,
    })));
    await tx.insert(accountingDocumentEvents).values({ tenantId: input.tenantId, documentId: document.id, eventType: 'created', actorId: input.actorId });
    return document;
  });
}

async function transitionDocument(tenantId: string, documentId: string, actorId: string, from: string, to: string, reason?: string) {
  return db.transaction(async (tx) => {
    const [document] = await tx.select().from(accountingDocuments).where(and(
      eq(accountingDocuments.tenantId, tenantId), eq(accountingDocuments.id, documentId),
    )).for('update');
    if (!document) throw new ApiError(404, 'ACCOUNTING_DOCUMENT_NOT_FOUND', 'Pièce comptable introuvable.');
    if (document.status !== from) throw new ApiError(409, 'INVALID_DOCUMENT_STATE', `Transition impossible depuis ${document.status}.`);
    if (to === 'approved' && document.createdById === actorId) throw new ApiError(409, 'MAKER_CHECKER_REQUIRED', 'Le créateur ne peut pas approuver sa propre pièce.');
    const now = new Date().toISOString();
    const [updated] = await tx.update(accountingDocuments).set({
      status: to,
      updatedAt: now,
      ...(to === 'pending_approval' ? { submittedAt: now } : {}),
      ...(to === 'approved' ? { approvedAt: now, approvedById: actorId } : {}),
    }).where(and(eq(accountingDocuments.tenantId, tenantId), eq(accountingDocuments.id, documentId), eq(accountingDocuments.status, from))).returning();
    if (!updated) throw new ApiError(409, 'DOCUMENT_STATE_RACE', 'La pièce a été modifiée par une autre requête.');
    const eventType = to === 'pending_approval' ? 'submitted' : to;
    await tx.insert(accountingDocumentEvents).values({ tenantId, documentId, eventType, actorId, reason });
    return updated;
  });
}

export const submitAccountingDocument = (tenantId: string, id: string, actorId: string) => transitionDocument(tenantId, id, actorId, 'draft', 'pending_approval');
export const approveAccountingDocument = (tenantId: string, id: string, actorId: string) => transitionDocument(tenantId, id, actorId, 'pending_approval', 'approved');
export const rejectAccountingDocument = (tenantId: string, id: string, actorId: string, reason: string) => transitionDocument(tenantId, id, actorId, 'pending_approval', 'rejected', reason);

export async function postApprovedAccountingDocument(input: {
  tenantId: string; documentId: string; actorId: string; idempotencyKey: string; journalCode: string; voucherTypeCode: string;
}) {
  const [document] = await db.select().from(accountingDocuments).where(and(eq(accountingDocuments.tenantId, input.tenantId), eq(accountingDocuments.id, input.documentId)));
  if (!document) throw new ApiError(404, 'ACCOUNTING_DOCUMENT_NOT_FOUND', 'Pièce comptable introuvable.');
  if (document.status === 'posted' && document.journalEntryId) return { document, idempotent: true };
  if (document.status !== 'approved') throw new ApiError(409, 'DOCUMENT_NOT_APPROVED', 'La pièce doit être approuvée avant comptabilisation.');
  const lines = await db.select().from(accountingDocumentLines).where(and(eq(accountingDocumentLines.tenantId, input.tenantId), eq(accountingDocumentLines.documentId, input.documentId)));
  const posting = await postAccountingVoucher({
    tenantId: input.tenantId, actorId: input.actorId, entryDate: document.documentDate, description: document.description,
    sourceModule: `accounting_${document.documentType}`, sourceDocumentId: document.id, sourceVersion: document.sourceVersion,
    idempotencyKey: input.idempotencyKey, journalCode: input.journalCode, voucherTypeCode: input.voucherTypeCode,
    lines: lines.map(line => ({ accountId: line.accountId, debitAmount: line.debitAmount, creditAmount: line.creditAmount, memo: line.memo ?? undefined })),
  });
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const updated = await tx.update(accountingDocuments).set({ status: 'posted', journalEntryId: posting.entry.id, postedAt: now, updatedAt: now })
      .where(and(eq(accountingDocuments.tenantId, input.tenantId), eq(accountingDocuments.id, input.documentId), eq(accountingDocuments.status, 'approved'))).returning({ id: accountingDocuments.id });
    if (updated.length) await tx.insert(accountingDocumentEvents).values({ tenantId: input.tenantId, documentId: input.documentId, eventType: 'posted', actorId: input.actorId, metadata: { journalEntryId: posting.entry.id } });
  });
  return { documentId: input.documentId, journalEntry: posting.entry, idempotent: posting.idempotent };
}

export async function reversePostedAccountingDocument(input: {
  tenantId: string; documentId: string; actorId: string; entryDate: string; reason: string; idempotencyKey: string; journalCode: string; voucherTypeCode: string;
}) {
  const [document] = await db.select().from(accountingDocuments).where(and(eq(accountingDocuments.tenantId, input.tenantId), eq(accountingDocuments.id, input.documentId)));
  if (!document?.journalEntryId || document.status !== 'posted') throw new ApiError(409, 'DOCUMENT_NOT_POSTED', 'Seule une pièce comptabilisée peut être contrepassée.');
  const reversal = await reverseAccountingVoucher({
    tenantId: input.tenantId, actorId: input.actorId, originalEntryId: document.journalEntryId, entryDate: input.entryDate,
    description: `Contrepassation ${document.reference ?? document.id}: ${input.reason}`, sourceModule: 'accounting_reversal',
    sourceDocumentId: document.id, sourceVersion: document.sourceVersion + 1, idempotencyKey: input.idempotencyKey,
    journalCode: input.journalCode, voucherTypeCode: input.voucherTypeCode, eventReason: input.reason,
  });
  await db.transaction(async (tx) => {
    await tx.update(accountingDocuments).set({ status: 'reversed', updatedAt: new Date().toISOString() }).where(and(eq(accountingDocuments.tenantId, input.tenantId), eq(accountingDocuments.id, input.documentId), eq(accountingDocuments.status, 'posted')));
    await tx.insert(accountingDocumentEvents).values({ tenantId: input.tenantId, documentId: input.documentId, eventType: 'reversed', actorId: input.actorId, reason: input.reason, metadata: { reversalEntryId: reversal.entry.id } });
  });
  return reversal;
}
