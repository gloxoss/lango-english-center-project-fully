/**
 * GL auto-posting: fires after financial transactions are recorded.
 *
 * Payment:  DR Cash (11xx) / CR AR Receivable (34xx)
 * Expense:  DR Expense (6xx) / CR Cash (11xx)
 * Refund:   DR AR Receivable (34xx) / CR Cash (11xx)   [reversal of payment]
 *
 * Fail-open: skips silently if CoA not configured or no open fiscal period.
 * ponytail: resolve accounts by code prefix (Moroccan CGNC plan comptable).
 *   Add a settings lookup when schools need configurable GL mappings.
 */

import { and, eq, like } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { chartOfAccounts } from '@/models/Schema';
import { postBalancedJournal } from '@/libs/services/finance-ledger';

type PostResult = Awaited<ReturnType<typeof postBalancedJournal>> | null;

// Shared fail-open wrapper — rethrows unexpected errors, swallows known setup gaps
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
    .limit(1);
  return account ?? null;
}

export async function tryPostPaymentGLEntry(opts: {
  tenantId: string;
  actorId: string;
  paymentId: string;
  invoiceNumber: string;
  amount: string; // decimal string e.g. "1250.00"
  paymentDate: string; // ISO date string
}): Promise<PostResult> {
  try {
    const [cashAccount, arAccount] = await Promise.all([
      resolveAccount(opts.tenantId, '11'),
      resolveAccount(opts.tenantId, '34'),
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
}): Promise<PostResult> {
  try {
    const [arAccount, cashAccount] = await Promise.all([
      resolveAccount(opts.tenantId, '34'),
      resolveAccount(opts.tenantId, '11'),
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

