import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { chartOfAccounts, expenses, journalEntries, journalEntryLines, payments } from '@/models/Schema';

export class FinancialAdapter {
  /**
   * 1. Account Statement Report.
   */
  static async getAccountStatementReport(tenantId: string, params?: any) {
    const list = await db
      .select({
        transactionDate: journalEntries.entryDate,
        voucherNumber: journalEntries.entryNumber,
        description: journalEntries.description,
        debit: journalEntryLines.debitAmount,
        credit: journalEntryLines.creditAmount,
      })
      .from(journalEntries)
      .innerJoin(journalEntryLines, eq(journalEntries.id, journalEntryLines.journalEntryId))
      .where(and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, 'posted')));

    let running = 0;
    return list.map(item => {
      const d = Number(item.debit || 0);
      const c = Number(item.credit || 0);
      running += d - c;
      return {
        transactionDate: item.transactionDate,
        voucherNumber: item.voucherNumber || 'JV-00',
        description: item.description || 'Écriture comptable',
        debit: d,
        credit: c,
        runningBalance: running,
      };
    });
  }

  /**
   * 2. Income & Expense Report.
   */
  static async getIncomeExpenseReport(tenantId: string, params?: any) {
    const [inc] = await db
      .select({ total: sql<number>`SUM(CAST(${payments.amount} AS NUMERIC))` })
      .from(payments)
      .where(eq(payments.tenantId, tenantId));

    const [exp] = await db
      .select({ total: sql<number>`SUM(CAST(${expenses.amount} AS NUMERIC))` })
      .from(expenses)
      .where(eq(expenses.tenantId, tenantId));

    const totalInc = Number(inc?.total || 0);
    const totalExp = Number(exp?.total || 0);

    return [
      { category: 'Produits (Revenus)', accountName: 'Frais de Scolarité & Inscriptions', amount: totalInc, percentageOfTotal: 100 },
      { category: 'Charges (Dépenses)', accountName: 'Loyers, Salaires & Fournitures', amount: totalExp, percentageOfTotal: totalInc > 0 ? Math.round((totalExp / totalInc) * 100) : 0 },
    ];
  }

  /**
   * 3. Transactions Report.
   */
  static async getTransactionsReport(tenantId: string, params?: any) {
    const entries = await db
      .select({
        journalId: journalEntries.id,
        entryDate: journalEntries.entryDate,
        accountCode: chartOfAccounts.code,
        debitAmount: journalEntryLines.debitAmount,
        creditAmount: journalEntryLines.creditAmount,
        status: journalEntries.status,
      })
      .from(journalEntries)
      .innerJoin(journalEntryLines, eq(journalEntries.id, journalEntryLines.journalEntryId))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, 'posted')))
      .limit(100);

    return entries.map(e => ({
      journalId: e.journalId,
      entryDate: e.entryDate,
      accountCode: e.accountCode || '701100',
      debitAmount: Number(e.debitAmount || 0),
      creditAmount: Number(e.creditAmount || 0),
      status: e.status,
    }));
  }

  /**
   * 4. Balance Sheet Report (Assets = Liabilities + Equity).
   * Real double-entry aggregation by chart-of-accounts type, from posted
   * journal entries only. Net income (revenue - expense) is folded into
   * equity, matching standard practice before formal period-close entries
   * exist - without it the equation would not hold mid-period.
   */
  static async getBalanceSheetReport(tenantId: string, params?: any) {
    const balancesByType = await db
      .select({
        accountType: chartOfAccounts.accountType,
        debit: sql<number>`COALESCE(SUM(CAST(${journalEntryLines.debitAmount} AS NUMERIC)), 0)`,
        credit: sql<number>`COALESCE(SUM(CAST(${journalEntryLines.creditAmount} AS NUMERIC)), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, 'posted')))
      .groupBy(chartOfAccounts.accountType);

    const byType = new Map(balancesByType.map(r => [r.accountType, { debit: Number(r.debit), credit: Number(r.credit) }]));
    const netOf = (type: typeof balancesByType[number]['accountType'], normalSide: 'debit' | 'credit') => {
      const row = byType.get(type) ?? { debit: 0, credit: 0 };
      return normalSide === 'debit' ? row.debit - row.credit : row.credit - row.debit;
    };

    const assets = netOf('asset', 'debit');
    const liabilities = netOf('liability', 'credit');
    const revenue = netOf('revenue', 'credit');
    const expense = netOf('expense', 'debit');
    const netIncome = revenue - expense;
    const equity = netOf('equity', 'credit') + netIncome;

    return [
      { section: '1. ACTIF', item: 'Trésorerie, Banque & Créances (comptes de type Actif)', amount: assets },
      { section: '2. PASSIF', item: 'Dettes & Engagements (comptes de type Passif)', amount: liabilities },
      { section: '3. CAPITAUX PROPRES', item: 'Capital & Résultat Net de la Période', amount: equity },
    ];
  }

  /**
   * 5. Income vs Expense Report. Real monthly aggregation from posted
   * journal entries against revenue/expense-type accounts, matching the
   * period-based aggregation style already used in getIncomeExpenseReport.
   */
  static async getIncomeVsExpenseReport(tenantId: string, params?: any) {
    const rows = await db
      .select({
        month: sql<string>`to_char(${journalEntries.entryDate}, 'YYYY-MM')`,
        accountType: chartOfAccounts.accountType,
        debit: sql<number>`COALESCE(SUM(CAST(${journalEntryLines.debitAmount} AS NUMERIC)), 0)`,
        credit: sql<number>`COALESCE(SUM(CAST(${journalEntryLines.creditAmount} AS NUMERIC)), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.status, 'posted'),
        sql`${chartOfAccounts.accountType} IN ('revenue', 'expense')`,
      ))
      .groupBy(sql`to_char(${journalEntries.entryDate}, 'YYYY-MM')`, chartOfAccounts.accountType);

    const byMonth = new Map<string, { income: number; expense: number }>();
    for (const r of rows) {
      const entry = byMonth.get(r.month) ?? { income: 0, expense: 0 };
      if (r.accountType === 'revenue') {
        entry.income += Number(r.credit) - Number(r.debit);
      } else {
        entry.expense += Number(r.debit) - Number(r.credit);
      }
      byMonth.set(r.month, entry);
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { income, expense }]) => ({
        month,
        totalIncome: income,
        totalExpense: expense,
        netResult: income - expense,
      }));
  }
}
