'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookCheck, BookOpen, Clock3, Library, RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Overview = { totalCopies: number; availableCopies: number; activeLoans: number; overdueLoans: number; waitingHolds: number; activeMembers: number };
type Overdue = { loanId: string; dueDate: string; memberNumber: string; memberName: string; accessionNumber: string; title: string };

export function LibraryReportsClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [or, odr] = await Promise.all([
        fetch('/api/addons/library/reports/overview', { cache: 'no-store' }),
        fetch('/api/addons/library/reports/overdue', { cache: 'no-store' }),
      ]);
      const [oj, odj] = await Promise.all([or.json(), odr.json()]);
      if (oj.success) setOverview(oj.data);
      if (odj.success) setOverdue(odj.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const kpis = overview ? ([['Exemplaires', overview.totalCopies, Library], ['Disponibles', overview.availableCopies, BookOpen], ['Prêts actifs', overview.activeLoans, BookCheck], ['Retards', overview.overdueLoans, Clock3], ['Réservations', overview.waitingHolds, Users], ['Adhérents actifs', overview.activeMembers, Users]] as const) : [];

  return <div className="mx-auto max-w-[1600px] space-y-6 p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Rapports bibliothèque</h1><p className="mt-1 text-sm text-slate-500">Vue d’ensemble et retards en temps réel.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualiser</Button></div>
    {loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement…</div> : <>
      {overview && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{kpis.map(([label, value, Icon]) => <Card key={label} className="p-4"><Icon className="mb-3 h-5 w-5 text-[#2487B8]" /><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value}</p></Card>)}</div>}
      <Card className="p-4"><div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><h2 className="font-semibold">Retards ({overdue.length})</h2></div>{overdue.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun retard.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Adhérent</th><th className="p-3">Échéance</th></tr></thead><tbody>{overdue.map(o => <tr key={o.loanId} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{o.title}</div><div className="font-mono text-xs text-slate-500">{o.accessionNumber}</div></td><td className="p-3">{o.memberName}<div className="text-xs text-slate-500">{o.memberNumber}</div></td><td className="p-3"><Badge variant={o.dueDate < today ? 'danger' : 'warning'}>{o.dueDate}</Badge></td></tr>)}</tbody></table></div>}</Card>
    </>}
  </div>;
}
