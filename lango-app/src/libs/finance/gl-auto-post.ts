/**
 * GL auto-posting: fires after financial transactions are recorded.
 *
 * Payment:  DR treasury / CR receivables
 * Expense:  DR expense / CR treasury
 * Refund:   DR receivables / CR treasury
 *
 * Returns null when GL setup is incomplete. Callers must surface and retry that state.
 * Treasury uses the configured payment method account when available.
 */

import { and, eq, like } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { chartOfAccounts, paymentMethodConfigurations } from '@/models/Schema';
import { postBalancedJournal } from '@/libs/services/finance-ledger';

type PostResult = Awaited<ReturnType<typeof postBalancedJournal>> | null;

// Known setup gaps remain retryable; unexpected errors go to the caller.
function isSoftError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  const msg = (err as { message?: string })?.message ?? '';
  return (
    code === 'NO_OPEN_FISCAL_PERIOD'
    || code === 'INVALID_ACCOUNT'
    || msg.includes('NO_OPEN_FISCAL_PERIOD')
    || msg.includes('INVALID_ACCOUNT')
  );
}

async function resolveAccount(tenantId: string, codePrefix: string) {
  const [account] = await db
    .select({ id: chartOfAccounts.id })
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.tenantId, tenantId),
      eq(chartOfAccounts.isActive, true),
      like(chartOfAccounts.code, `${codePrefix}%`),
    ))
    .orderBy(chartOfAccounts.code)
    .limit(1);
  return account ?? null;
}

async function resolveFirstAccount(tenantId: string, prefixes: string[]) {
  for (const prefix of prefixes) {
    const account = await resolveAccount(tenantId, prefix);
    if (account) return account;
  }
  return null;
}

async function resolveTreasuryAccount(tenantId: string, paymentMethod?: string) {
  if (paymentMethod) {
    const [configured] = await db.select({ id: chartOfAccounts.id })
      .from(paymentMethodConfigurations)
      .innerJoin(chartOfAccounts, and(
        eq(chartOfAccounts.id, paymentMethodConfigurations.accountingAccountId),
        eq(chartOfAccounts.tenantId, tenantId), eq(chartOfAccounts.isActive, true),
      ))
      .where(and(eq(paymentMethodConfigurations.tenantId, tenantId),
        eq(paymentMethodConfigurations.methodCode, paymentMethod), eq(paymentMethodConfigurations.isActive, true)))
      .limit(1);
    if (configured) return configured;
  }
  return resolveFirstAccount(tenantId, paymentMethod === 'cash'
    ? ['516', '53', '512', '514', '11']
    : ['514', '512', '51', '516', '53', '11']);
}

export async function tryPostPaymentGLEntry(opts: {
  tenantId: string;
  actorId: string;
  paymentId: string;
  invoiceNumber: string;
  amount: string; // decimal string e.g. "1250.00"
  paymentDate: string; // ISO date string
  paymentMethod?: string;
}): Promise<PostResult> {
  try {
    const [cashAccount, arAccount] = await Promise.all([
      resolveTreasuryAccount(opts.tenantId, opts.paymentMethod),
      resolveFirstAccount(opts.tenantId, ['342', '411', '34']),
    ]);
    if (!cashAccount || !arAccount) return null;

    return await postBalancedJournal({
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      entryDate: opts.paymentDate.slice(0, 10),
      description: `Paiement reçu — Facture ${opts.invoiceNumber}`,
      sourceModule: 'payment',
      sourceId: opts.paymentId,
      lines: [
        { accountId: cashAccount.id, debitAmount: opts.amount, creditAmount: '0', memo: `Paiement — Facture ${opts.invoiceNumber}` },
        { accountId: arAccount.id, debitAmount: '0', creditAmount: opts.amount, memo: `Effacement créance — Facture ${opts.invoiceNumber}` },
      ],
    });
  } catch (err) {
    if (isSoftError(err)) return null;
    throw err;
  }
}

export async function tryPostExpenseGLEntry(opts: {
  tenantId: string;
  actorId: string;
  expenseId: string;
  description: string;
  amount: string; // decimal string e.g. "500.00"
  expenseDate: string; // ISO date string
}): Promise<PostResult> {
  try {
    const [expenseAccount, cashAccount] = await Promise.all([
      resolveAccount(opts.tenantId, '6'),
      resolveAccount(opts.tenantId, '11'),
    ]);
    if (!expenseAccount || !cashAccount) return null;

    return await postBalancedJournal({
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      entryDate: opts.expenseDate.slice(0, 10),
      description: `Dépense enregistrée — ${opts.description}`,
      sourceModule: 'expense',
      sourceId: opts.expenseId,
      lines: [
        { accountId: expenseAccount.id, debitAmount: opts.amount, creditAmount: '0', memo: opts.description },
        { accountId: cashAccount.id, debitAmount: '0', creditAmount: opts.amount, memo: opts.description },
      ],
    });
  } catch (err) {
    if (isSoftError(err)) return null;
    throw err;
  }
}

export async function tryPostRefundGLEntry(opts: {
  tenantId: string;
  actorId: string;
  refundId: string;
  refundNumber: string;
  amount: string; // decimal string
  refundDate: string; // ISO date string
  refundMethod?: string;
}): Promise<PostResult> {
  try {
    const [arAccount, cashAccount] = await Promise.all([
      resolveFirstAccount(opts.tenantId, ['342', '411', '34']),
      resolveTreasuryAccount(opts.tenantId, opts.refundMethod),
    ]);
    if (!arAccount || !cashAccount) return null;

    return await postBalancedJournal({
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      entryDate: opts.refundDate.slice(0, 10),
      description: `Remboursement — ${opts.refundNumber}`,
      sourceModule: 'refund',
      sourceId: opts.refundId,
      lines: [
        { accountId: arAccount.id, debitAmount: opts.amount, creditAmount: '0', memo: `Remboursement ${opts.refundNumber}` },
        { accountId: cashAccount.id, debitAmount: '0', creditAmount: opts.amount, memo: `Sortie caisse — ${opts.refundNumber}` },
      ],
    });
  } catch (err) {
    if (isSoftError(err)) return null;
    throw err;
  }
}

// Payment reversal — mirror of the payment entry: DR AR (34) / CR Cash (11).
export async function tryPostPaymentReversalGLEntry(opts: {
  tenantId: string;
  actorId: string;
  reversalId: string;
  invoiceNumber: string;
  amount: string; // decimal string
  reversalDate: string; // ISO date string
  paymentMethod?: string;
}): Promise<PostResult> {
  try {
    const [arAccount, cashAccount] = await Promise.all([
      resolveFirstAccount(opts.tenantId, ['342', '411', '34']),
      resolveTreasuryAccount(opts.tenantId, opts.paymentMethod),
    ]);
    if (!arAccount || !cashAccount) return null;

    return await postBalancedJournal({
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      entryDate: opts.reversalDate.slice(0, 10),
      description: `Annulation paiement — Facture ${opts.invoiceNumber}`,
      sourceModule: 'payment_reversal',
      sourceId: opts.reversalId,
      lines: [
        { accountId: arAccount.id, debitAmount: opts.amount, creditAmount: '0', memo: `Annulation paiement — Facture ${opts.invoiceNumber}` },
        { accountId: cashAccount.id, debitAmount: '0', creditAmount: opts.amount, memo: `Réintégration caisse — Facture ${opts.invoiceNumber}` },
      ],
    });
  } catch (err) {
    if (isSoftError(err)) return null;
    throw err;
  }
}

// Cashier close variance — only posted when variance !== 0.
// overage (variance > 0):  DR Cash (11) / CR Other income (75)
// shortage (variance < 0): DR Other expense (65) / CR Cash (11)
export async function tryPostCashierVarianceGLEntry(opts: {
  tenantId: string;
  actorId: string;
  cashierClosingId: string;
  variance: number;
  closeDate: string; // ISO date string
}): Promise<PostResult> {
  if (opts.variance === 0) return null;
  try {
    const amount = Math.abs(opts.variance).toFixed(2);
    const cashAccount = await resolveAccount(opts.tenantId, '11');
    if (!cashAccount) return null;

    if (opts.variance > 0) {
      const incomeAccount = await resolveAccount(opts.tenantId, '75');
      if (!incomeAccount) return null;
      return await postBalancedJournal({
        tenantId: opts.tenantId,
        actorId: opts.actorId,
        entryDate: opts.closeDate.slice(0, 10),
        description: 'Écart de caisse — excédent',
        sourceModule: 'cashier_variance',
        sourceId: opts.cashierClosingId,
        lines: [
          { accountId: cashAccount.id, debitAmount: amount, creditAmount: '0', memo: 'Excédent de caisse' },
          { accountId: incomeAccount.id, debitAmount: '0', creditAmount: amount, memo: 'Excédent de caisse' },
        ],
      });
    }

    const expenseAccount = await resolveAccount(opts.tenantId, '65');
    if (!expenseAccount) return null;
    return await postBalancedJournal({
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      entryDate: opts.closeDate.slice(0, 10),
      description: 'Écart de caisse — manquant',
      sourceModule: 'cashier_variance',
      sourceId: opts.cashierClosingId,
      lines: [
        { accountId: expenseAccount.id, debitAmount: amount, creditAmount: '0', memo: 'Manquant de caisse' },
        { accountId: cashAccount.id, debitAmount: '0', creditAmount: amount, memo: 'Manquant de caisse' },
      ],
    });
  } catch (err) {
    if (isSoftError(err)) return null;
    throw err;
  }
}

