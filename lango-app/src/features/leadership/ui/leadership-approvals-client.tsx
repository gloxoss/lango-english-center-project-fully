'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Scope = { assignmentId: string | null; type: 'tenant' | 'branch' | 'department'; branchId: string | null; departmentId: string | null };
type Authority = { id: string; domain: string; action: string; maxAmount: string | null; delegatedFromAuthorityId: string | null; endsOn: string | null };
type FinanceQueue = { pendingCreditNotes: number; pendingCreditNoteAmount: string; pendingRefunds: number; pendingRefundAmount: string; pendingPeriodReopens: number };
type Approvals = { scope: Scope; authorities: Authority[]; queues: { finance: FinanceQueue | null }; generatedAt: string };

const DOMAIN_LABELS: Record<string, string> = { academics: 'Académique', attendance: 'Présences', finance: 'Finances', workforce: 'Personnel', operations: 'Opérations', reporting: 'Reporting' };
const SCOPE_LABELS: Record<Scope['type'], string> = { tenant: 'Établissement', branch: 'Filiale', department: 'Département' };
const money = (n: string) => `${Number(n).toLocaleString('fr-FR')} DH`;

export function LeadershipApprovalsClient() {
  const [data, setData] = useState<Approvals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/leadership/me/approvals', { cache: 'no-store' });
      const j = await r.json();
      if (j.success) setData(j.data);
      else setError(j.error?.message ?? 'Impossible de charger les approbations.');
    } catch { setError('Erreur réseau lors du chargement.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const finance = data?.queues?.finance;

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Approbations</h1><p className="mt-1 text-sm text-slate-500">Bac à approbations de la direction — montants et domaines limités par vos autorités actives.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualiser</Button></div>

    {error ? <Card className="p-10 text-center"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" /><p className="font-medium">{error}</p></Card> : !data ? <Card className="p-10 text-center text-sm text-slate-500">Chargement…</Card> : <>
      {data.scope.assignmentId && <div className="flex flex-wrap items-center gap-2"><Badge variant="info">Périmètre : {SCOPE_LABELS[data.scope.type] ?? data.scope.type}</Badge>{data.scope.branchId && <span className="text-xs text-slate-500">Filiale</span>}{data.scope.departmentId && <span className="text-xs text-slate-500">Département</span>}<span className="text-xs text-slate-400">Mis à jour le {new Date(data.generatedAt).toLocaleString('fr-FR')}</span></div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-slate-500">Autorités actives</p><p className="text-2xl font-bold">{data.authorities.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Notes de crédit en attente</p><p className="text-2xl font-bold">{finance?.pendingCreditNotes ?? 0}</p>{finance && finance.pendingCreditNotes > 0 && <p className="text-xs text-slate-500">{money(finance.pendingCreditNoteAmount)}</p>}</Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Remboursements en attente</p><p className="text-2xl font-bold">{finance?.pendingRefunds ?? 0}</p>{finance && finance.pendingRefunds > 0 && <p className="text-xs text-slate-500">{money(finance.pendingRefundAmount)}</p>}</Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Rouvertures de période</p><p className="text-2xl font-bold">{finance?.pendingPeriodReopens ?? 0}</p></Card>
      </div>

      {!finance && <Card className="p-4"><p className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4 text-slate-400" />Le flux financier est visible uniquement avec une autorité « finance » active ou en tant que responsable d’établissement.</p></Card>}

      <Card className="p-5"><h2 className="mb-3 font-semibold">Autorités d’approbation</h2>{data.authorities.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucune autorité d’approbation active.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Domaine</th><th className="p-3">Action</th><th className="p-3">Plafond</th><th className="p-3">Fin de validité</th><th className="p-3">Origine</th></tr></thead><tbody>{data.authorities.map(a => <tr key={a.id} className="border-b last:border-0"><td className="p-3"><Badge variant="neutral">{DOMAIN_LABELS[a.domain] ?? a.domain}</Badge></td><td className="p-3 font-medium">{a.action}</td><td className="p-3">{a.maxAmount != null ? money(a.maxAmount) : '—'}</td><td className="p-3">{a.endsOn ? new Date(a.endsOn).toLocaleDateString('fr-FR') : 'Illimitée'}</td><td className="p-3">{a.delegatedFromAuthorityId ? <Badge variant="warning">Délégation</Badge> : <BadgeCheck className="h-4 w-4 text-emerald-600" />}</td></tr>)}</tbody></table></div>}</Card>
    </>}
  </div>;
}
