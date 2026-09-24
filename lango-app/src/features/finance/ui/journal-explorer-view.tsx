'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { formatMoney } from '@/libs/finance/format-money';

type JournalLine = {
  lineId: string;
  entryId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceModule: string;
  status: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
  memo: string | null;
};

export function JournalExplorerView() {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const [lines, setLines] = useState<JournalLine[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/finance/journals')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setLines(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = lines.filter(l =>
    l.description.toLowerCase().includes(search.toLowerCase())
    || l.entryNumber.toLowerCase().includes(search.toLowerCase())
    || l.accountName.toLowerCase().includes(search.toLowerCase()),
  );

  const totalDebit = filtered.reduce((sum, l) => sum + Number(l.debitAmount), 0);
  const totalCredit = filtered.reduce((sum, l) => sum + Number(l.creditAmount), 0);

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('generalLedgerTitle')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('generalLedgerSubtitle', { count: filtered.length })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">{t('totalDebit')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{formatMoney(totalDebit)}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">{t('totalCredit')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{formatMoney(totalCredit)}</p>
        </Card>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder={t('searchJournalPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">{tCommon('date')}</th>
                <th className="py-3.5 px-4">{t('entryNumberCol')}</th>
                <th className="py-3.5 px-4">{t('accountCol')}</th>
                <th className="py-3.5 px-4">{t('descriptionCol')}</th>
                <th className="py-3.5 px-4 text-end">{t('debitCol')}</th>
                <th className="py-3.5 px-4 text-end">{t('creditCol')}</th>
                <th className="py-3.5 px-4 text-end">{tCommon('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">{t('noEntriesFound')}</td></tr>
              )}
              {filtered.map(l => (
                <tr key={l.lineId} className="hover:bg-slate-50/80 transition font-medium">
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{l.entryDate}</td>
                  <td className="py-3.5 px-4 font-mono text-[#2487B8] text-[11px]">{l.entryNumber}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">{l.accountCode} — {l.accountName}</td>
                  <td className="py-3.5 px-4 text-[#16212B]">{l.description}</td>
                  <td className="py-3.5 px-4 text-end font-extrabold text-[#16212B]">{Number(l.debitAmount) > 0 ? Number(l.debitAmount).toLocaleString('fr-FR') : '—'}</td>
                  <td className="py-3.5 px-4 text-end font-extrabold text-[#16212B]">{Number(l.creditAmount) > 0 ? Number(l.creditAmount).toLocaleString('fr-FR') : '—'}</td>
                  <td className="py-3.5 px-4 text-end">
                    <Badge className={`text-[10px] border-none font-bold ${l.status === 'posted' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-600'}`}>
                      {l.status === 'posted' ? t('statusPosted') : l.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
