'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookCheck, BookOpen, Boxes, Clock3, Library, RefreshCw, Repeat, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Overview = { totalCopies: number; availableCopies: number; activeLoans: number; overdueLoans: number; waitingHolds: number; activeMembers: number };
type Overdue = { loanId: string; dueDate: string; memberNumber: string; memberName: string; accessionNumber: string; title: string };
type InventoryRow = { branchId: string; branchName: string; total: number; available: number; checkedOut: number; onHoldShelf: number; inTransit: number; repair: number; lost: number; missing: number; withdrawn: number; active: number; conditions: Record<string, number> };
type InventoryReport = { byBranch: InventoryRow[]; totals: { total: number; active: number; withdrawn: number } };
type CirculationReport = {
  loans: { active: number; issued30: number; returned30: number; renewed30: number; issued90: number; returned90: number; renewed90: number; daily: Array<{ day: string; issued: number; returned: number; renewed: number }> };
  holds: Record<string, number>; transfers: Record<string, number>;
  charges: { open: number; waived: number; paid: number; openAmount: number };
};

export function LibraryReportsClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [circulation, setCirculation] = useState<CirculationReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [or, odr, ir, cr] = await Promise.all([
        fetch('/api/addons/library/reports/overview', { cache: 'no-store' }),
        fetch('/api/addons/library/reports/overdue', { cache: 'no-store' }),
        fetch('/api/addons/library/reports/inventory', { cache: 'no-store' }),
        fetch('/api/addons/library/reports/circulation', { cache: 'no-store' }),
      ]);
      const [oj, odj, ij, cj] = await Promise.all([or.json(), odr.json(), ir.json(), cr.json()]);
      if (oj.success) setOverview(oj.data);
      if (odj.success) setOverdue(odj.data);
      if (ij.success) setInventory(ij.data);
      if (cj.success) setCirculation(cj.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const kpis = overview ? ([['Exemplaires', overview.totalCopies, Library], ['Disponibles', overview.availableCopies, BookOpen], ['Prêts actifs', overview.activeLoans, BookCheck], ['Retards', overview.overdueLoans, Clock3], ['Réservations', overview.waitingHolds, Users], ['Adhérents actifs', overview.activeMembers, Users]] as const) : [];
  const circKpis = circulation ? ([['Prêts actifs', circulation.loans.active, BookCheck], ['Émis 30j', circulation.loans.issued30, BookOpen], ['Retours 30j', circulation.loans.returned30, Clock3], ['Renouvelés 30j', circulation.loans.renewed30, Repeat], ['Réservations en attente', circulation.holds.waiting ?? 0, Users], ['Frais ouverts', circulation.charges.open, TrendingUp]] as const) : [];

  return <div className="mx-auto max-w-[1600px] space-y-6 p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Rapports bibliothèque</h1><p className="mt-1 text-sm text-slate-500">Vue d’ensemble, retards, inventaire et circulation en temps réel.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualiser</Button></div>
    {loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement…</div> : <>
      {overview && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{kpis.map(([label, value, Icon]) => <Card key={label} className="p-4"><Icon className="mb-3 h-5 w-5 text-[#2487B8]" /><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value}</p></Card>)}</div>}
      <Card className="p-4"><div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><h2 className="font-semibold">Retards ({overdue.length})</h2></div>{overdue.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun retard.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Adhérent</th><th className="p-3">Échéance</th></tr></thead><tbody>{overdue.map(o => <tr key={o.loanId} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{o.title}</div><div className="font-mono text-xs text-slate-500">{o.accessionNumber}</div></td><td className="p-3">{o.memberName}<div className="text-xs text-slate-500">{o.memberNumber}</div></td><td className="p-3"><Badge variant={o.dueDate < today ? 'danger' : 'warning'}>{o.dueDate}</Badge></td></tr>)}</tbody></table></div>}</Card>
      {inventory && <Card className="p-4"><div className="mb-3 flex items-center gap-2"><Boxes className="h-4 w-4 text-[#2487B8]" /><h2 className="font-semibold">Inventaire par succursale</h2><span className="ml-auto text-xs text-slate-500">Total : {inventory.totals.total} · Actifs : {inventory.totals.active} · Retirés : {inventory.totals.withdrawn}</span></div>{inventory.byBranch.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun exemplaire enregistré.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Succursale</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Actifs</th><th className="p-3 text-right">Prêtés</th><th className="p-3 text-right">Réservés</th><th className="p-3 text-right">En transit</th><th className="p-3 text-right">Réparation</th><th className="p-3 text-right">Perdus</th><th className="p-3 text-right">Manquants</th><th className="p-3 text-right">Retirés</th></tr></thead><tbody>{inventory.byBranch.map(b => <tr key={b.branchId} className="border-b last:border-0"><td className="p-3 font-semibold">{b.branchName}</td><td className="p-3 text-right">{b.total}</td><td className="p-3 text-right">{b.active}</td><td className="p-3 text-right">{b.checkedOut}</td><td className="p-3 text-right">{b.onHoldShelf}</td><td className="p-3 text-right">{b.inTransit}</td><td className="p-3 text-right">{b.repair}</td><td className="p-3 text-right">{b.lost}</td><td className="p-3 text-right">{b.missing}</td><td className="p-3 text-right">{b.withdrawn}</td></tr>)}<tr className="font-bold"><td className="p-3">Totaux</td><td className="p-3 text-right">{inventory.totals.total}</td><td className="p-3 text-right">{inventory.totals.active}</td><td className="p-3 text-right" /><td className="p-3 text-right" /><td className="p-3 text-right" /><td className="p-3 text-right" /><td className="p-3 text-right" /><td className="p-3 text-right" /><td className="p-3 text-right">{inventory.totals.withdrawn}</td></tr></tbody></table></div>}</Card>}
      {circulation && <Card className="p-4"><div className="mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#2487B8]" /><h2 className="font-semibold">Circulation</h2></div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">{circKpis.map(([label, value, Icon]) => <div key={label} className="flex items-center gap-3 rounded-lg border p-3"><Icon className="h-5 w-5 text-[#2487B8]" /><div><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold">{value}</p></div></div>)}</div>
        {circulation.loans.daily.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucune activité de prêt.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Jour</th><th className="p-3 text-right">Émis</th><th className="p-3 text-right">Retours</th><th className="p-3 text-right">Renouvellements</th></tr></thead><tbody>{circulation.loans.daily.map(d => <tr key={d.day} className="border-b last:border-0"><td className="p-3">{new Date(d.day).toLocaleDateString('fr-FR')}</td><td className="p-3 text-right">{d.issued}</td><td className="p-3 text-right">{d.returned}</td><td className="p-3 text-right">{d.renewed}</td></tr>)}</tbody></table></div>}</Card>}
    </>}
  </div>;
}
