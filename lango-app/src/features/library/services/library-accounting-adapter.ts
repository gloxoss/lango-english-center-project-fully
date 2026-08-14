// Library charge → Accounting posting contract (WA6).
//
// The library owns the operational charge (library_charges row); Accounting owns
// the journal entry. This adapter resolves the two account mappings (member
// receivable + charge-reason revenue) and posts a balanced voucher through
// `postAccountingVoucher`. A missing mapping never suspends: the charge is left
// open and an accounting adapter exception is queued (blocked), which the
// accounting UI surfaces as actionable. Posting is idempotent by
// (tenant, sourceModule, sourceDocumentId, sourceVersion).
import { and, eq, isNull } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { accountingAdapterExceptions, accountingSourceMappings, libraryCharges, libraryMembers } from '@/models/Schema';
import { postAccountingVoucher, type AccountingPostingLine } from '@/features/accounting/services/posting-service';

export const LIBRARY_CHARGE_MODULE = 'library_charge';

export type AdapterPrincipal = { tenantId: string; userId: string };
export type LibraryPostingRef = { journalCode: string; voucherTypeCode: string };

async function resolveLibraryAccount(tenantId: string, keyType: string, key: string | null): Promise<string | null> {
  const rows = await db.select({ accountId: accountingSourceMappings.accountId })
    .from(accountingSourceMappings)
    .where(and(
      eq(accountingSourceMappings.tenantId, tenantId),
      eq(accountingSourceMappings.sourceModule, LIBRARY_CHARGE_MODULE),
      eq(accountingSourceMappings.sourceKeyType, keyType),
      key === null ? isNull(accountingSourceMappings.sourceKey) : eq(accountingSourceMappings.sourceKey, key),
    ))
    .limit(1);
  return rows[0]?.accountId ?? null;
}

// Exact key first, then the module default (sourceKey NULL) — mirrors the
// student accounting adapter.
async function resolveLibraryAccountWithDefault(tenantId: string, keyType: string, key: string | null): Promise<string | null> {
  if (key !== null) {
    const exact = await resolveLibraryAccount(tenantId, keyType, key);
    if (exact) return exact;
  }
  return resolveLibraryAccount(tenantId, keyType, null);
}

async function insertException(principal: AdapterPrincipal, input: {
  sourceModule: string; sourceDocumentType: string; sourceDocumentId: string; version: number; reason: string; detail: string; payload: Record<string, unknown>;
}) {
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

async function resolveOpenException(principal: AdapterPrincipal, sourceDocumentId: string, note: string) {
  await db.update(accountingAdapterExceptions).set({
    status: 'resolved',
    resolvedBy: principal.userId,
    resolvedAt: new Date().toISOString(),
    resolutionNote: note,
  }).where(and(
    eq(accountingAdapterExceptions.tenantId, principal.tenantId),
    eq(accountingAdapterExceptions.sourceModule, LIBRARY_CHARGE_MODULE),
    eq(accountingAdapterExceptions.sourceDocumentId, sourceDocumentId),
    eq(accountingAdapterExceptions.status, 'open'),
  ));
}

export async function postLibraryCharge(principal: AdapterPrincipal, chargeId: string, posting: LibraryPostingRef) {
  const [charge] = await db.select().from(libraryCharges).where(and(
    eq(libraryCharges.tenantId, principal.tenantId),
    eq(libraryCharges.id, chargeId),
  )).limit(1);
  if (!charge) throw new ApiError(404, 'LIBRARY_CHARGE_NOT_FOUND', 'Frais de bibliothèque introuvable.');
  if (charge.state !== 'open') throw new ApiError(409, 'CHARGE_NOT_OPEN', 'Seuls les frais ouverts peuvent être comptabilisés.');

  const [member] = await db.select({ id: libraryMembers.id }).from(libraryMembers).where(and(
    eq(libraryMembers.id, charge.memberId),
    eq(libraryMembers.tenantId, principal.tenantId),
  )).limit(1);
  if (!member) throw new ApiError(422, 'INVALID_REFERENCE', 'Adhérent introuvable.');

  const receivableId = await resolveLibraryAccountWithDefault(principal.tenantId, 'library_member', charge.memberId);
  const revenueId = await resolveLibraryAccountWithDefault(principal.tenantId, 'library_charge_reason', charge.reason);

  const missing = !receivableId ? 'MAPPING_MEMBER_RECEIVABLE_MISSING' : !revenueId ? 'MAPPING_CHARGE_REASON_MISSING' : null;
  if (missing) {
    const exception = await insertException(principal, {
      sourceModule: LIBRARY_CHARGE_MODULE,
      sourceDocumentType: 'charge',
      sourceDocumentId: chargeId,
      version: 1,
      reason: missing,
      detail: `Frais de bibliothèque ${charge.reason} (${charge.amount}) — mapping comptable incomplet.`,
      payload: {
        chargeId,
        amount: String(charge.amount),
        reason: charge.reason,
        missing: missing === 'MAPPING_MEMBER_RECEIVABLE_MISSING' ? 'member' : `charge_reason:${charge.reason}`,
      },
    });
    return { blocked: true as const, reason: missing, exceptionId: exception?.id ?? null };
  }

  const memo = `Frais de bibliothèque ${charge.reason}`;
  const lines: AccountingPostingLine[] = [
    { accountId: receivableId as string, debitAmount: String(charge.amount), creditAmount: '0', memo },
    { accountId: revenueId as string, debitAmount: '0', creditAmount: String(charge.amount), memo },
  ];

  const result = await postAccountingVoucher({
    tenantId: principal.tenantId,
    actorId: principal.userId,
    entryDate: charge.createdAt.slice(0, 10),
    description: `Bibliothèque — frais ${charge.reason}`,
    sourceModule: LIBRARY_CHARGE_MODULE,
    sourceDocumentId: chargeId,
    sourceVersion: 1,
    idempotencyKey: `${LIBRARY_CHARGE_MODULE}:${principal.tenantId}:${chargeId}`,
    journalCode: posting.journalCode,
    voucherTypeCode: posting.voucherTypeCode,
    lines,
  });
  await resolveOpenException(principal, chargeId, `Comptabilisée ${result.entry.entryNumber}`);
  return { ...result, blocked: false as const };
}
