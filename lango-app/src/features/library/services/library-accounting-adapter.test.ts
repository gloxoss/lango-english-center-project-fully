import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { moneyToCents } from '@/libs/finance/money';
import {
  accountingAdapterExceptions,
  accountingJournalLinks,
  accountingJournals,
  accountingNumberingSeries,
  accountingPostingRequests,
  accountingSourceMappings,
  accountingVoucherEvents,
  accountingVoucherTypes,
  branches,
  chartOfAccounts,
  fiscalPeriods,
  journalEntries,
  journalEntryLines,
  libraryCharges,
  libraryLoanPolicies,
  tenants,
  user,
} from '@/models/Schema';
import { createMember } from './library-service';
import { LIBRARY_CHARGE_MODULE, postLibraryCharge } from './library-accounting-adapter';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('library charge → accounting posting contract', () => {
  const suffix = randomUUID().slice(0, 8);
  const today = new Date().toISOString().slice(0, 10);
  let tenantId = '';
  let branchId = '';
  let adminId = '';
  let memberId = '';
  let chargeId = '';
  let receivableAcc = '';
  let revenueAcc = '';

  // Accounting tables use ON DELETE RESTRICT tenant FKs, so a tenant cannot be
  // removed until its accounting rows are deleted in reverse dependency order.
  // The ledger hardening migrations add BEFORE UPDATE/DELETE immutability guards
  // (posted entries/lines, voucher events, succeeded posting requests) plus the
  // DEFERRED balance triggers. All must be disabled before the deletes, and the
  // re-enable must run in a SEPARATE transaction: Postgres refuses ALTER TABLE
  // on a table with pending deferred trigger events within the same transaction.
  const ACCOUNTING_DISABLED_TRIGGERS = [
    ['accounting_voucher_events', 'accounting_voucher_events_immutable_trigger'],
    ['accounting_posting_requests', 'accounting_posting_requests_immutable_trigger'],
    ['journal_entries', 'prevent_journal_entry_delete'],
    ['journal_entries', 'journal_header_balance_trigger'],
    ['journal_entry_lines', 'prevent_journal_line_mutation'],
    ['journal_entry_lines', 'journal_lines_balance_trigger'],
  ] as const;

  async function setAccountingTriggers(mode: 'DISABLE' | 'ENABLE') {
    await db.transaction(async (tx) => {
      for (const [table, trigger] of ACCOUNTING_DISABLED_TRIGGERS) {
        await tx.execute(sql`ALTER TABLE ${sql.identifier(table)} ${sql.raw(mode)} TRIGGER ${sql.identifier(trigger)}`);
      }
    });
  }

  async function cleanupAccounting(target: string) {
    await setAccountingTriggers('DISABLE');
    try {
      await db.transaction(async (tx) => {
        await tx.delete(accountingVoucherEvents).where(eq(accountingVoucherEvents.tenantId, target));
        await tx.delete(accountingJournalLinks).where(eq(accountingJournalLinks.tenantId, target));
        await tx.delete(accountingNumberingSeries).where(eq(accountingNumberingSeries.tenantId, target));
        await tx.delete(journalEntryLines).where(eq(journalEntryLines.tenantId, target));
        await tx.delete(accountingPostingRequests).where(eq(accountingPostingRequests.tenantId, target));
        await tx.delete(journalEntries).where(eq(journalEntries.tenantId, target));
        await tx.delete(accountingAdapterExceptions).where(eq(accountingAdapterExceptions.tenantId, target));
        await tx.delete(accountingSourceMappings).where(eq(accountingSourceMappings.tenantId, target));
        await tx.delete(accountingVoucherTypes).where(eq(accountingVoucherTypes.tenantId, target));
        await tx.delete(accountingJournals).where(eq(accountingJournals.tenantId, target));
        await tx.delete(chartOfAccounts).where(eq(chartOfAccounts.tenantId, target));
        await tx.delete(fiscalPeriods).where(eq(fiscalPeriods.tenantId, target));
      });
    } finally {
      await setAccountingTriggers('ENABLE');
    }
  }

  async function seedAccounting() {
    const [receivable] = await db.insert(chartOfAccounts).values({ tenantId, code: `REC-${suffix}`, name: 'Créances bibliothèque', accountType: 'asset' }).returning();
    receivableAcc = receivable!.id;
    const [revenue] = await db.insert(chartOfAccounts).values({ tenantId, code: `REV-${suffix}`, name: 'Produits amende', accountType: 'revenue' }).returning();
    revenueAcc = revenue!.id;
    await db.insert(fiscalPeriods).values({ tenantId, name: `FP-${suffix}`, startDate: '2026-01-01', endDate: '2026-12-31', status: 'open' });
    const [journal] = await db.insert(accountingJournals).values({ tenantId, code: 'GJ', name: 'Journal général', journalType: 'general', isActive: true }).returning();
    await db.insert(accountingVoucherTypes).values({ tenantId, journalId: journal!.id, code: 'CHG', name: 'Frais bibliothèque', sourceModule: LIBRARY_CHARGE_MODULE, isActive: true });
  }

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `ACC Test ${suffix}`, slug: `acc-test-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `ACC${suffix}` }).returning();
    branchId = branch!.id;
    adminId = `acc-admin-${suffix}`;
    await db.insert(user).values([
      { id: adminId, tenantId, branchId, email: `${adminId}@test.local`, name: 'ACC Admin', role: 'school_admin' },
      { id: `acc-student-${suffix}`, tenantId, branchId, email: `acc-student-${suffix}@test.local`, name: 'ACC Student', role: 'student' },
    ]);
    await db.insert(libraryLoanPolicies).values({ tenantId, name: 'ACC default', patronCategory: 'student', branchId, maxLoans: 3, loanDurationDays: 14, renewalLimit: 1, renewalDurationDays: 7, finePerDay: '1', gracePeriodDays: 0, maxHolds: 2 });
    const member = await createMember(tenantId, { userId: `acc-student-${suffix}`, memberNumber: `ACCM-${suffix}`, branchId });
    memberId = member.id;
    const [charge] = await db.insert(libraryCharges).values({ tenantId, memberId, amount: '12.50', reason: 'overdue_fine', dedupeKey: `acc-${suffix}` }).returning();
    chargeId = charge!.id;
    await seedAccounting();
  }, 30_000);

  afterAll(async () => {
    if (tenantId) {
      await cleanupAccounting(tenantId);
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
  }, 30_000);

  it('blocks posting with an actionable exception when a mapping is missing (no journal entry)', async () => {
    const result = await postLibraryCharge({ tenantId, userId: adminId }, chargeId, { journalCode: 'GJ', voucherTypeCode: 'CHG' });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('MAPPING_MEMBER_RECEIVABLE_MISSING');
      expect(result.exceptionId).toBeTruthy();
    }
    const requests = await db.select().from(accountingPostingRequests).where(and(
      eq(accountingPostingRequests.tenantId, tenantId),
      eq(accountingPostingRequests.sourceDocumentId, chargeId),
    ));
    expect(requests).toHaveLength(0);
    const entries = await db.select().from(journalEntries).where(and(
      eq(journalEntries.tenantId, tenantId),
      eq(journalEntries.sourceModule, LIBRARY_CHARGE_MODULE),
    ));
    expect(entries).toHaveLength(0);
  });

  it('posts a balanced voucher once the member + reason mappings exist, then is idempotent', async () => {
    await db.insert(accountingSourceMappings).values([
      { tenantId, sourceModule: LIBRARY_CHARGE_MODULE, sourceKeyType: 'library_member', sourceKey: memberId, accountId: receivableAcc },
      { tenantId, sourceModule: LIBRARY_CHARGE_MODULE, sourceKeyType: 'library_charge_reason', sourceKey: 'overdue_fine', accountId: revenueAcc },
    ]);

    const result = await postLibraryCharge({ tenantId, userId: adminId }, chargeId, { journalCode: 'GJ', voucherTypeCode: 'CHG' });
    if (result.blocked) throw new Error(`expected a posting, blocked by ${result.reason}`);
    const first = result;
    expect(first.totalDebit).toBe('12.50');
    expect(first.totalCredit).toBe('12.50');
    const lines = await db.select().from(journalEntryLines).where(eq(journalEntryLines.journalEntryId, first.entry.id));
    expect(lines).toHaveLength(2);
    const debit = lines.filter(l => moneyToCents(l.debitAmount) !== 0n);
    const credit = lines.filter(l => moneyToCents(l.creditAmount) !== 0n);
    expect(debit[0]!.accountId).toBe(receivableAcc);
    expect(credit[0]!.accountId).toBe(revenueAcc);

    const [request] = await db.select().from(accountingPostingRequests).where(and(
      eq(accountingPostingRequests.tenantId, tenantId),
      eq(accountingPostingRequests.sourceDocumentId, chargeId),
    ));
    expect(request?.status).toBe('succeeded');
    expect(request?.journalEntryId).toBe(first.entry.id);

    // The previously blocked exception is resolved by the successful posting.
    const [exc] = await db.select().from(accountingAdapterExceptions).where(and(
      eq(accountingAdapterExceptions.tenantId, tenantId),
      eq(accountingAdapterExceptions.sourceModule, LIBRARY_CHARGE_MODULE),
      eq(accountingAdapterExceptions.sourceDocumentId, chargeId),
    ));
    expect(exc?.status).toBe('resolved');

    // Re-posting the same charge is idempotent and returns the same entry.
    const again = await postLibraryCharge({ tenantId, userId: adminId }, chargeId, { journalCode: 'GJ', voucherTypeCode: 'CHG' });
    if (again.blocked) throw new Error(`expected an idempotent posting, blocked by ${again.reason}`);
    expect(again.idempotent).toBe(true);
    expect(again.entry.id).toBe(first.entry.id);
  });

  it('falls back to the module default mapping when no exact reason mapping exists', async () => {
    const [charge] = await db.insert(libraryCharges).values({ tenantId, memberId, amount: '5.00', reason: 'damage', dedupeKey: `acc-dmg-${suffix}` }).returning();
    // Only the module default is configured; the damage reason has no exact row.
    await db.insert(accountingSourceMappings).values({ tenantId, sourceModule: LIBRARY_CHARGE_MODULE, sourceKeyType: 'library_charge_reason', sourceKey: null, accountId: revenueAcc });
    const result = await postLibraryCharge({ tenantId, userId: adminId }, charge!.id, { journalCode: 'GJ', voucherTypeCode: 'CHG' });
    if (result.blocked) throw new Error(`expected a posting, blocked by ${result.reason}`);
    const lines = await db.select().from(journalEntryLines).where(eq(journalEntryLines.journalEntryId, result.entry.id));
    const credit = lines.find(l => moneyToCents(l.creditAmount) !== 0n);
    expect(credit?.accountId).toBe(revenueAcc);
  });

  it('rejects posting a non-open charge and never uses another tenant mapping', async () => {
    const [otherTenant] = await db.insert(tenants).values({ name: `ACC Other ${suffix}`, slug: `acc-other-${suffix}` }).returning();
    try {
      const [otherBranch] = await db.insert(branches).values({ tenantId: otherTenant!.id, name: 'Other', code: `ACO${suffix}` }).returning();
      const otherUserId = `acc-other-user-${suffix}`;
      await db.insert(user).values({ id: otherUserId, tenantId: otherTenant!.id, branchId: otherBranch!.id, email: `${otherUserId}@test.local`, name: 'Other Student', role: 'student' });
      const otherMember = await createMember(otherTenant!.id, { userId: otherUserId, memberNumber: `ACOM-${suffix}`, branchId: otherBranch!.id });
      const [otherCharge] = await db.insert(libraryCharges).values({ tenantId: otherTenant!.id, memberId: otherMember.id, amount: '3.00', reason: 'overdue_fine', dedupeKey: `acc-other-${suffix}` }).returning();
      // This tenant has no mappings → blocked, proving isolation.
      const isolated = await postLibraryCharge({ tenantId: otherTenant!.id, userId: adminId }, otherCharge!.id, { journalCode: 'GJ', voucherTypeCode: 'CHG' });
      expect(isolated.blocked).toBe(true);
      if (isolated.blocked) expect(isolated.reason).toBe('MAPPING_MEMBER_RECEIVABLE_MISSING');

      const [waived] = await db.insert(libraryCharges).values({ tenantId, memberId, amount: '2.00', reason: 'overdue_fine', state: 'waived', dedupeKey: `acc-waived-${suffix}` }).returning();
      await expect(postLibraryCharge({ tenantId, userId: adminId }, waived!.id, { journalCode: 'GJ', voucherTypeCode: 'CHG' })).rejects.toMatchObject({ code: 'CHARGE_NOT_OPEN' });
    } finally {
      await cleanupAccounting(otherTenant!.id);
      await db.delete(tenants).where(eq(tenants.id, otherTenant!.id));
    }
  });
});
