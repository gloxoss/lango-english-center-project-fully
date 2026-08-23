'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle2, FileText, Printer, Search, TrendingUp } from 'lucide-react';

type ReceiptAllocation = { invoiceId: string; invoiceNumber: string; amount: string };

type ReceiptRow = {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentDate: string;
  allocations: ReceiptAllocation[];
  receivedByName: string | null;
  createdAt: string;
};

export function ReceiptsFinanceView({ locale: _locale }: { locale?: string }) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReceiptRow | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/receipts');
      const json = await res.json();
      if (json.success) {
        setReceipts(json.data);
      }
    } catch (e) {
      console.error('Failed to load receipts', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return receipts.filter(r => r.studentName.toLowerCase().includes(q) || r.receiptNumber.toLowerCase().includes(q));
  }, [receipts, search]);

  const totalAmount = receipts.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Reçus de paiement</h1>
          <p className="text-xs text-slate-500 mt-1">{receipts.length} reçu(s) émis, tenant-scopés.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReceipts} className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Actualiser
        </Button>
      </div>

      {/* Stat Band */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <FileText className="w-5 h-5 text-[#2487B8]" />, color: 'bg-[#DCEBF4]', label: 'Reçus émis', value: String(receipts.length) },
          { icon: <CheckCircle2 className="w-5 h-5 text-[#17A673]" />, color: 'bg-[#DDF5EC]', label: 'Montant encaissé', value: `${totalAmount.toLocaleString('fr-FR')} MAD` },
        ].map((stat, i) => (
          <Card key={i} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">{stat.label}</p>
              <p className="text-xl font-extrabold text-[#16212B] leading-tight">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        {/* LEFT — Receipt list */}
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 flex items-center gap-2 border-b border-slate-100">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Rechercher un reçu ou un élève…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-[11px] bg-slate-50 rounded-xl border-slate-200" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                  <th className="py-2.5 px-3 text-left">N° reçu</th>
                  <th className="py-2.5 px-3 text-left">Élève</th>
                  <th className="py-2.5 px-3 text-right">Montant</th>
                  <th className="py-2.5 px-3 text-center">Date</th>
                  <th className="py-2.5 px-3 text-left">Reçu par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">Aucun reçu trouvé.</td></tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`cursor-pointer transition-colors ${selected?.id === r.id ? 'bg-[#DCEBF4]/30' : 'hover:bg-slate-50/80'}`}
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#2487B8]">{r.receiptNumber}</td>
                    <td className="py-2.5 px-3 font-bold text-[#16212B]">{r.studentName}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#17A673]">{Number(r.amount).toLocaleString('fr-FR')} MAD</td>
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[10px]">{r.paymentDate}</td>
                    <td className="py-2.5 px-3 text-slate-500">{r.receivedByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* RIGHT — Receipt detail panel */}
        {selected && (
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 sticky top-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400">Reçu</p>
                <p className="font-mono font-extrabold text-[#2487B8]">{selected.receiptNumber}</p>
              </div>
              <Badge className="bg-[#DDF5EC] text-[#17A673] border-none font-bold text-[9px]">ENCASSÉ</Badge>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-500">Élève</span><span className="font-bold text-[#16212B]">{selected.studentName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-bold text-[#16212B]">{selected.paymentDate}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Reçu par</span><span className="font-bold text-[#16212B]">{selected.receivedByName ?? '—'}</span></div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-extrabold text-[#16212B]">Ventilation par facture</p>
              <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                {selected.allocations.length === 0 && <p className="py-2 text-[10px] text-slate-400">Aucune allocation.</p>}
                {selected.allocations.map(a => (
                  <div key={a.invoiceId} className="flex items-center justify-between py-1.5 text-[11px]">
                    <span className="font-semibold text-[#16212B]">{a.invoiceNumber}</span>
                    <span className="font-bold text-[#17A673]">{Number(a.amount).toLocaleString('fr-FR')} MAD</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-sm font-extrabold text-[#16212B] border-t border-slate-200 pt-2">
              <span>Total</span><span>{Number(selected.amount).toLocaleString('fr-FR')} MAD</span>
            </div>

            <Button variant="outline" size="sm" onClick={() => window.print()} className="w-full h-9 text-[11px] rounded-xl border-slate-200 gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              Imprimer le reçu
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
