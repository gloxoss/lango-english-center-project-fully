'use client';

import {
  FileSpreadsheet,
  FileText,
  BarChart3,
  Download,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

type PaymentRow = { paymentDate: string; invoiceNumber: string; studentName: string; amount: number; paymentMethod: string; referenceId: string | null };
type ExpenseRow = { expenseDate: string; category: string; amount: string; description: string | null };
type InvoiceRow = { invoiceNumber: string; studentName: string; className: string | null; sectionName: string | null; dueDate: string; netAmount: number; paidAmount: number; status: string };

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map(row => row.map(v => csvEscape(String(v))).join(',')).join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ponytail: no true `total` count from these list routes (they return
// rows.length), so loop pages until a short page comes back. Capped at 20
// pages (2000 rows) - plenty for a single school, revisit if that ever caps out.
async function fetchAllPages<T>(url: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}page=${page}&pageSize=100`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
      break;
    }
    all.push(...json.data);
    if (json.data.length < 100) {
      break;
    }
  }
  return all;
}

export default function ReportsPage() {
  const t = useTranslations('Finance');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expenseCategoryLabels: Record<string, string> = {
    salary: t('categorySalary'),
    rent: t('categoryRent'),
    utilities: t('categoryUtilities'),
    supplies: t('categorySupplies'),
    marketing: t('categoryMarketing'),
    other: t('categoryOther'),
  };

  async function exportEncaissements() {
    setLoading('encaissements');
    setError(null);
    try {
      const rows = await fetchAllPages<PaymentRow>('/api/finance/payments');
      const inPeriod = rows.filter(r => r.paymentDate.startsWith(period));
      const csv = toCsv(
        [t('csvDate'), t('csvInvoiceNum'), t('csvStudent'), t('csvAmount'), t('csvMethod'), t('csvReference')],
        inPeriod.map(r => [r.paymentDate, r.invoiceNumber, r.studentName, r.amount, r.paymentMethod, r.referenceId ?? '']),
      );
      downloadCsv(`journal-encaissements-${period}.csv`, csv);
    } catch {
      setError(t('exportReceiptsError'));
    } finally {
      setLoading(null);
    }
  }

  async function exportDepenses() {
    setLoading('depenses');
    setError(null);
    try {
      const rows = await fetchAllPages<ExpenseRow>('/api/finance/expenses');
      const inPeriod = rows.filter(r => r.expenseDate.startsWith(period));
      const csv = toCsv(
        [t('csvDate'), t('csvCategory'), t('csvAmount'), t('csvDescription')],
        inPeriod.map(r => [r.expenseDate, expenseCategoryLabels[r.category] ?? r.category, r.amount, r.description ?? '']),
      );
      downloadCsv(`depenses-${period}.csv`, csv);
    } catch {
      setError(t('exportExpensesError'));
    } finally {
      setLoading(null);
    }
  }

  async function exportAncienneteCreances() {
    setLoading('ancienneté');
    setError(null);
    try {
      const rows = await fetchAllPages<InvoiceRow>('/api/finance/invoices');
      const today = new Date();
      const outstanding = rows
        .filter(r => r.status !== 'paid' && r.status !== 'cancelled' && r.netAmount - r.paidAmount > 0)
        .map((r) => {
          const daysLate = Math.floor((today.getTime() - new Date(r.dueDate).getTime()) / 86_400_000);
          const bucket = daysLate <= 0 ? t('bucketNotDue') : daysLate <= 30 ? t('bucket1to30') : daysLate <= 60 ? t('bucket31to60') : daysLate <= 90 ? t('bucket61to90') : t('bucket90Plus');
          return [r.invoiceNumber, r.studentName, [r.className, r.sectionName].filter(Boolean).join(' '), r.dueDate, Math.max(0, daysLate), (r.netAmount - r.paidAmount).toFixed(2), bucket];
        });
      const csv = toCsv(
        [t('csvInvoiceNum'), t('csvStudent'), t('csvClass'), t('csvDueDate'), t('csvOverdueDays'), t('csvBalance'), t('csvBracket')],
        outstanding,
      );
      downloadCsv(`anciennete-creances-${today.toISOString().slice(0, 10)}.csv`, csv);
    } catch {
      setError(t('exportAgingError'));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('accountingReportsTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('accountingReportsSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">{t('periodLabel')}</label>
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>
      )}

      {/* Reports Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#0066FF]">
              <FileSpreadsheet className="size-5" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">{t('receiptsJournalCardTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('receiptsJournalCardDesc')}
            </p>
          </div>
          <button
            onClick={exportEncaissements}
            disabled={loading !== null}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading === 'encaissements' ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {t('downloadCsv')}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileText className="size-5" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">{t('operatingExpensesCardTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('operatingExpensesCardDesc')}
            </p>
          </div>
          <button
            onClick={exportDepenses}
            disabled={loading !== null}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading === 'depenses' ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {t('downloadCsv')}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <BarChart3 className="size-5" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">{t('agingReportCardTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('agingReportCardDesc')}
            </p>
          </div>
          <button
            onClick={exportAncienneteCreances}
            disabled={loading !== null}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading === 'ancienneté' ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {t('downloadCsv')}
          </button>
        </div>
      </div>
    </div>
  );
}
