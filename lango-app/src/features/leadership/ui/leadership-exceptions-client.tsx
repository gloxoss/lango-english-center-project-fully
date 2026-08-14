'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bus, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Scope = { assignmentId: string | null; type: 'tenant' | 'branch' | 'department'; branchId: string | null; departmentId: string | null };
type Exceptions = { scope: Scope; attendance: Record<string, number>; operations: { openGuardIncidents: number; openTransportIncidents: number }; privacy: { containsIndividualRecords: boolean; smallGroupSuppression: string }; generatedAt: string };

const SEVERITY_LABELS: Record<string, { label: string; cls: string }> = {
  CRITIQUE: { label: 'Critique', cls: 'bg-rose-100 text-rose-700' },
  ELEVE: { label: 'Élevé', cls: 'bg-amber-100 text-amber-700' },
  MOYEN: { label: 'Moyen', cls: 'bg-[#DCEBF4] text-[#1B6C93]' },
};
const SCOPE_LABELS: Record<Scope['type'], string> = { tenant: 'Établissement', branch: 'Filiale', department: 'Département' };

export function LeadershipExceptionsClient() {
  const [data, setData] = useState<Exceptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/leadership/me/exceptions', { cache: 'no-store' });
      const j = await r.json();
      if (j.success) setData(j.data);
      else setError(j.error?.message ?? 'Impossible de charger les exceptions.');
    } catch { setError('Erreur réseau lors du chargement.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalAttendance = Object.values(data?.attendance ?? {}).reduce((a, b) => a + b, 0);

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Exceptions & supervision</h1><p className="mt-1 text-sm text-slate-500">Alertes de présence et incidents opérationnels — comptes agrégés, sans dossier individuel.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualiser</Button></div>

    {error ? <Card className="p-10 text-center"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" /><p className="font-medium">{error}</p></Card> : !data ? <Card className="p-10 text-center text-sm text-slate-500">Chargement…</Card> : <>
      {data.scope.assignmentId && <div className="flex flex-wrap items-center gap-2"><Badge variant="info">Périmètre : {SCOPE_LABELS[data.scope.type] ?? data.scope.type}</Badge><span className="text-xs text-slate-400">Mis à jour le {new Date(data.generatedAt).toLocaleString('fr-FR')}</span></div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="flex items-center gap-2 text-sm text-slate-500"><ShieldAlert className="h-4 w-4 text-[#2487B8]" />Drapeaux de présence</p><p className="text-2xl font-bold">{totalAttendance}</p></Card>
        <Card className="p-4"><p className="flex items-center gap-2 text-sm text-slate-500"><ShieldAlert className="h-4 w-4 text-[#2487B8]" />Incidents gardien</p><p className="text-2xl font-bold">{data.operations.openGuardIncidents}</p></Card>
        <Card className="p-4"><p className="flex items-center gap-2 text-sm text-slate-500"><Bus className="h-4 w-4 text-[#2487B8]" />Incidents transport</p><p className="text-2xl font-bold">{data.operations.openTransportIncidents}</p></Card>
      </div>

      <Card className="p-5"><h2 className="mb-3 font-semibold">Alertes de présence par sévérité</h2>{totalAttendance === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun drapeau de présence ouvert.</p> : <div className="flex flex-wrap gap-2">{Object.entries(data.attendance).map(([sev, n]) => { const s = SEVERITY_LABELS[sev] ?? { label: sev, cls: 'bg-slate-100 text-slate-500' }; return <span key={sev} className={`rounded-full px-4 py-2 text-sm font-semibold ${s.cls}`}>{s.label} : {n}</span>; })}</div>}</Card>

      <Card className="p-5"><h2 className="mb-3 font-semibold">Incidents opérationnels ouverts</h2><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Sécurité & gardiens</p><p className="text-2xl font-bold">{data.operations.openGuardIncidents}</p></div><div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Transport scolaire</p><p className="text-2xl font-bold">{data.operations.openTransportIncidents}</p></div></div></Card>

      <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />Confidentialité : comptes agrégés uniquement — aucun enregistrement individuel n’est renvoyé ({data.privacy.smallGroupSuppression === 'not-applicable-to-counts' ? 'suppression des petits groupes non applicable aux compteurs' : 'suppression des petits groupes appliquée'}).</p>
    </>}
  </div>;
}
