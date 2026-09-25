'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Printer, RefreshCw, Search, User } from 'lucide-react';
import { exportToCsv } from '@/libs/csv-export';
import { printStatementDocument } from './finance-document-print';

type StudentResult = { id: string; name: string; email: string | null; matricule: string | null };

type StatementRow = {
  id: string;
  date: string;
  type: 'invoice' | 'payment' | 'credit';
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
};

type StatementData = {
  studentId: string;
  studentName: string;
  period: { startDate: string; endDate: string };
  openingBalance: number;
  chargesTotal: number;
  creditsTotal: number;
  closingBalance: number;
  transactions: StatementRow[];
};

export function StatementsFinanceView({ locale = 'fr' }: { locale?: string }) {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [creditsBalance, setCreditsBalance] = useState(0);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setSelected(null);
    setStatement(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data.students ?? []);
      } else {
        setError(json.error?.message ?? t('requestFailed'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('connectionError'));
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (student: StudentResult) => {
    setSelected(student);
    setResults([]);
    setLoading(true);
    setError(null);
    try {
      const [res, creditsRes] = await Promise.all([
        fetch(`/api/finance/statements?studentId=${student.id}`),
        fetch(`/api/finance/credits?studentId=${student.id}`),
      ]);
      const json = await res.json();
      if (json.success) {
        setStatement(json.data);
      } else {
        setError(json.error?.message ?? json.message ?? t('requestFailed'));
      }
      const creditsJson = await creditsRes.json();
      if (creditsJson.success) {
        setCreditsBalance((creditsJson.data ?? []).reduce((sum: number, c: { balance: number }) => sum + Number(c.balance), 0));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('studentStatementsTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('studentStatementsSubtitle')}</p>
        </div>
      </div>

      {/* Student search */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-2.5 size-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('searchStudentStatementPlaceholder')}
              className="w-full rounded-xl border border-slate-200 py-2.5 ps-10 pe-4 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
            />
          </div>
          <Button type="submit" disabled={searching || query.trim().length < 2} className="h-10 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-xs gap-1.5">
            {searching ? t('searching') : t('searchPlaceholder')}
          </Button>
        </form>

        {results.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {results.map(s => (
              <button key={s.id} onClick={() => handleSelect(s)} className="flex w-full items-center gap-3 p-3 text-start hover:bg-slate-50">
                <User className="size-4 text-slate-400" />
                <div>
                  <div className="text-sm font-bold text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.matricule ?? s.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading && <p className="text-sm text-slate-500">{t('loadingStatement')}</p>}

      {!loading && selected && statement && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('openingBalance'), value: statement.openingBalance, cls: 'text-[#2487B8]' },
              { label: t('chargesInvoices'), value: statement.chargesTotal, cls: 'text-[#16212B]' },
              { label: t('creditsPayments'), value: statement.creditsTotal, cls: 'text-[#17A673]' },
              { label: t('closingBalance'), value: statement.closingBalance, cls: statement.closingBalance > 0 ? 'text-rose-600' : 'text-[#17A673]' },
            ].map((s, i) => (
              <Card key={i} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400">{s.label}</p>
                <p className={`text-xl font-extrabold ${s.cls}`}>{s.value.toLocaleString('fr-FR')} MAD</p>
              </Card>
            ))}
          </div>

          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-[#16212B]">{statement.studentName}</h2>
                  <Badge className="bg-[#DCEBF4] text-[#2487B8] border-none font-bold text-[9px]">
                    {statement.period.startDate} → {statement.period.endDate}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{t('equationHint')}</p>
                {creditsBalance > 0 && (
                  <p className="text-[11px] font-bold text-violet-600 mt-0.5">{t('availableCredit', { amount: `${creditsBalance.toLocaleString('fr-FR')} MAD` })}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => exportToCsv(statement.transactions, `releve-${statement.studentName}`)} className="h-8 text-[11px] rounded-xl border-slate-200 gap-1.5">
                  <Download className="w-3.5 h-3.5" />{t('exportCsvBtn')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => printStatementDocument(statement, {
                  title: t('studentStatementsTitle'), student: t('student'), date: tCommon('date'),
                  description: t('descriptionCol'), amount: t('amount'), total: t('closingBalance'),
                  reference: t('referenceCol'), debit: t('debitCol'), credit: t('creditCol'),
                  balance: t('balanceCol'), period: t('periodCol'),
                  opening: t('openingBalance'), closing: t('closingBalance'),
                }, locale)} className="h-8 text-[11px] rounded-xl border-slate-200 gap-1.5">
                  <Printer className="w-3.5 h-3.5" />{t('printBtn')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSelect(selected)} className="h-8 text-[11px] rounded-xl border-slate-200 gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />{tCommon('refresh')}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-[11px]">
                <thead>
                  <tr className="text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                    <th className="py-2.5 px-3 text-start">{tCommon('date')}</th>
                    <th className="py-2.5 px-3 text-start">{t('descriptionCol')}</th>
                    <th className="py-2.5 px-3 text-start">{t('referenceCol')}</th>
                    <th className="py-2.5 px-3 text-end">{t('debitCol')}</th>
                    <th className="py-2.5 px-3 text-end">{t('creditCol')}</th>
                    <th className="py-2.5 px-3 text-end">{t('balanceCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/70">
                    <td className="py-2 px-3 text-slate-400 font-semibold">—</td>
                    <td className="py-2 px-3 text-slate-500 font-semibold">{t('openingBalance')}</td>
                    <td className="py-2 px-3 text-slate-400">—</td>
                    <td className="py-2 px-3 text-end text-slate-400">—</td>
                    <td className="py-2 px-3 text-end text-slate-400">—</td>
                    <td className="py-2 px-3 text-end font-extrabold text-[#2487B8]">{statement.openingBalance.toLocaleString('fr-FR')} MAD</td>
                  </tr>
                  {statement.transactions.map(item => (
                    <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{item.date}</td>
                      <td className="py-2 px-3 font-semibold text-[#16212B]">{item.description}</td>
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{item.reference}</td>
                      <td className={`py-2 px-3 text-end font-bold ${item.debit > 0 ? 'text-[#16212B]' : 'text-slate-300'}`}>{item.debit > 0 ? `${item.debit.toLocaleString('fr-FR')} MAD` : '—'}</td>
                      <td className={`py-2 px-3 text-end font-bold ${item.credit > 0 ? 'text-[#17A673]' : 'text-slate-300'}`}>{item.credit > 0 ? `${item.credit.toLocaleString('fr-FR')} MAD` : '—'}</td>
                      <td className="py-2 px-3 text-end font-extrabold text-[#16212B]">{item.balance.toLocaleString('fr-FR')} MAD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!loading && selected && !statement && !error && (
        <p className="text-sm text-slate-500">{t('noStatementData')}</p>
      )}
    </div>
  );
}
