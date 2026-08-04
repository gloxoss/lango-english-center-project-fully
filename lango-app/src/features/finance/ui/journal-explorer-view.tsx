'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

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
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Grand livre</h1>
        <p className="text-xs text-slate-500 mt-1">{filtered.length} ligne(s) d&apos;écriture comptable.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">Total débit</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{totalDebit.toLocaleString('fr-FR')} MAD</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">Total crédit</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{totalCredit.toLocaleString('fr-FR')} MAD</p>
        </Card>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher par description, pièce ou compte..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Pièce</th>
                <th className="py-3.5 px-4">Compte</th>
                <th className="py-3.5 px-4">Libellé</th>
                <th className="py-3.5 px-4 text-right">Débit</th>
                <th className="py-3.5 px-4 text-right">Crédit</th>
                <th className="py-3.5 px-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Aucune écriture trouvée.</td></tr>
              )}
              {filtered.map(l => (
                <tr key={l.lineId} className="hover:bg-slate-50/80 transition font-medium">
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{l.entryDate}</td>
                  <td className="py-3.5 px-4 font-mono text-[#2487B8] text-[11px]">{l.entryNumber}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">{l.accountCode} — {l.accountName}</td>
                  <td className="py-3.5 px-4 text-[#16212B]">{l.description}</td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(l.debitAmount) > 0 ? Number(l.debitAmount).toLocaleString('fr-FR') : '—'}</td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(l.creditAmount) > 0 ? Number(l.creditAmount).toLocaleString('fr-FR') : '—'}</td>
                  <td className="py-3.5 px-4 text-right">
                    <Badge className={`text-[10px] border-none font-bold ${l.status === 'posted' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-600'}`}>
                      {l.status === 'posted' ? 'Validée' : l.status}
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
