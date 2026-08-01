'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

type ReportsData = {
  totalCollected: number;
  collectedChangePct: number | null;
  totalOutstanding: number;
  totalExpenses: number;
  expensesChangePct: number | null;
  netResult: number;
  collectionRate: number;
  monthlyTrend: { month: string; collected: number; invoiced: number; expenses: number }[];
  outstandingByClass: { className: string; amount: number }[];
};

function formatMad(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} MAD`;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <p className="text-[11px] font-bold text-slate-400">Pas de référence le mois dernier</p>;
  }
  const positive = pct >= 0;
  return (
    <p className={`text-[11px] font-bold flex items-center gap-1 ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
      {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {positive ? '+' : ''}
      {pct}% vs mois dernier
    </p>
  );
}

export function FinancialReportsView() {
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    fetch('/api/finance/reports').then(r => r.json()).then((json) => {
      if (json.success) {
        setData(json.data);
      }
    }).catch(err => console.error('Failed loading financial reports', err));
  }, []);

  const maxMonthly = data ? Math.max(1, ...data.monthlyTrend.flatMap(m => [m.collected, m.expenses])) : 1;
  const maxOutstanding = data ? Math.max(1, ...data.outstandingByClass.map(c => c.amount)) : 1;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Rapports financiers</h1>
        <p className="text-xs text-slate-500 mt-1">Santé financière réelle de votre établissement, calculée à partir des factures et paiements enregistrés.</p>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-400">Encaissé ce mois-ci</p>
              <p className="text-2xl font-extrabold text-[#16212B]">{formatMad(data.totalCollected)}</p>
              <DeltaBadge pct={data.collectedChangePct} />
            </Card>
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-400">Encours total</p>
              <p className="text-2xl font-extrabold text-[#16212B]">{formatMad(data.totalOutstanding)}</p>
              <p className="text-[11px] font-bold text-slate-500">Toutes factures non annulées</p>
            </Card>
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-400">Taux de recouvrement</p>
              <p className="text-2xl font-extrabold text-[#2487B8]">{data.collectionRate}%</p>
              <p className="text-[11px] font-bold text-[#2487B8]">Encaissé / Facturé (total)</p>
            </Card>
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-400">Dépenses ce mois-ci</p>
              <p className="text-2xl font-extrabold text-[#16212B]">{formatMad(data.totalExpenses)}</p>
              <DeltaBadge pct={data.expensesChangePct === null ? null : -data.expensesChangePct} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex justify-between items-center text-xs">
                <h3 className="font-extrabold text-[#16212B]">Encaissements vs dépenses (6 mois)</h3>
                <Badge variant="neutral" className="text-[10px]">Résultat net ce mois: {formatMad(data.netResult)}</Badge>
              </div>
              <div className="h-44 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-100 text-[10px]">
                {data.monthlyTrend.map(m => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div className="w-full flex justify-center gap-1 items-end h-32">
                      <div className="w-3 bg-[#2487B8] rounded-t-md" style={{ height: `${Math.max(2, (m.collected / maxMonthly) * 100)}%` }} />
                      <div className="w-3 bg-rose-400 rounded-t-md" style={{ height: `${Math.max(2, (m.expenses / maxMonthly) * 100)}%` }} />
                    </div>
                    <span className="font-bold text-slate-500">{m.month.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 text-xs font-bold">
                <span className="flex items-center gap-2 text-[#2487B8]"><span className="w-3 h-3 rounded-full bg-[#2487B8]" /> Encaissé (MAD)</span>
                <span className="flex items-center gap-2 text-rose-500"><span className="w-3 h-3 rounded-full bg-rose-400" /> Dépenses (MAD)</span>
              </div>
            </Card>

            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <h3 className="text-xs font-extrabold text-[#16212B]">Encours impayés par classe</h3>
              <div className="space-y-2.5 text-xs font-semibold">
                {data.outstandingByClass.map(item => (
                  <div key={item.className} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-700">{item.className}</span>
                      <span className="font-extrabold text-[#2487B8]">{formatMad(item.amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#2487B8] h-full rounded-full" style={{ width: `${Math.max(2, (item.amount / maxOutstanding) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {data.outstandingByClass.length === 0 && <p className="text-slate-400 text-center py-4">Aucun impayé.</p>}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
