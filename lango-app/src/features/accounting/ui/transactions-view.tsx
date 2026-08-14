'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Transaction = {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceModule: string;
  journalCode: string | null;
  voucherTypeCode: string | null;
  debitTotal: string;
  creditTotal: string;
};

export function AccountingTransactionsView({ locale = 'fr' }: { locale?: string }) {
  const ar = locale === 'ar';
  const [rows, setRows] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/finance/accounting/transactions?pageSize=100&search=${encodeURIComponent(search)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Chargement impossible');
      setRows(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{ar ? 'دفتر الأستاذ العام' : 'Grand livre des transactions'}</h1>
          <p className="mt-1 text-xs text-slate-500">{ar ? 'قيود غير قابلة للتعديل مع المصادر وإجمالي المدين والدائن.' : 'Écritures immuables, sources et totaux débit/crédit.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2 rounded-xl">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> {ar ? 'تحديث' : 'Actualiser'}
        </Button>
      </div>
      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Numéro ou libellé…" className="rounded-xl ps-9" />
          </div>
        </div>
        {error && <div className="border-b border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500"><tr>
              <th className="px-4 py-3">Date</th><th className="px-4 py-3">Pièce</th><th className="px-4 py-3">Journal / Type</th><th className="px-4 py-3">Libellé</th><th className="px-4 py-3 text-end">Débit</th><th className="px-4 py-3 text-end">Crédit</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucune écriture.</td></tr>}
              {rows.map(row => <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">{row.entryDate}</td>
                <td className="px-4 py-3 font-mono font-bold text-[#1B6C93]">{row.entryNumber}</td>
                <td className="px-4 py-3">{row.journalCode ?? 'LEGACY'} / {row.voucherTypeCode ?? row.sourceModule}</td>
                <td className="max-w-md truncate px-4 py-3">{row.description}</td>
                <td className="px-4 py-3 text-end font-mono">{Number(row.debitTotal).toFixed(2)} MAD</td>
                <td className="px-4 py-3 text-end font-mono">{Number(row.creditTotal).toFixed(2)} MAD</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
