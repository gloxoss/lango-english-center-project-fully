'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, CalendarCheck2, Download, FileClock, Loader2, Lock,
  UserMinus, UserPlus, Users, UsersRound,
} from 'lucide-react';
import { EMPLOYMENT_STATUS_LABELS, type EmploymentStatus } from '@/features/hr/model/types';

type ApiErrorShape = { code?: string; message?: string };

type ExpiringDocument = {
  employeeId: string;
  employeeName: string | null;
  documentType: string;
  originalName: string | null;
  expiryDate: string | null;
};

type OverviewData = {
  headcount: Record<string, number>;
  hiresThisMonth: number;
  departuresThisMonth: number;
  unlinkedAccounts: number;
  expiringDocuments: ExpiringDocument[];
  salaryTotal?: string | null;
};

async function api<T>(url: string): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

export function HrOverviewView() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addonDisabled, setAddonDisabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAddonDisabled(false);
    const res = await api<OverviewData>('/api/hr/overview');
    if (res.ok && res.data) setData(res.data);
    else {
      if (res.error?.code === 'ADDON_NOT_ACTIVATED') setAddonDisabled(true);
      setError(res.error?.message ?? 'Chargement impossible.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  if (addonDisabled) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-[#16212B]">Module non activé</h1>
        <p className="text-sm text-slate-500">
          La gestion avancée des ressources humaines n&apos;est pas activée pour votre établissement.
          Contactez l&apos;administrateur de la plateforme.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-[#16212B]">Impossible de charger l&apos;aperçu RH</h1>
        <p className="text-sm text-slate-500">{error}</p>
        <Button variant="outline" onClick={() => load().catch(() => {})}>Réessayer</Button>
      </div>
    );
  }

  const hc = data.headcount;
  const kpis = [
    { label: 'Effectif total', value: hc.total ?? 0, icon: Users },
    { label: 'Actifs', value: hc.active ?? 0, icon: UsersRound },
    { label: 'En congé', value: hc.on_leave ?? 0, icon: UserMinus },
    { label: 'En période d\'essai', value: hc.probation ?? 0, icon: UserPlus },
    { label: 'Embauches ce mois', value: data.hiresThisMonth, icon: CalendarCheck2 },
    { label: 'Départs ce mois', value: data.departuresThisMonth, icon: UserMinus },
    { label: 'Sans compte', value: data.unlinkedAccounts, icon: UserPlus },
  ];

  const statusBreakdown = Object.entries(hc).filter(([k]) => k !== 'total');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Aperçu RH</h1>
          <p className="text-sm text-slate-500">Indicateurs clés du personnel de l&apos;établissement.</p>
        </div>
        <Button onClick={() => { window.location.href = '/api/hr/export'; }}>
          <Download className="mr-2 h-4 w-4" /> Exporter CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]">
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-[#16212B]">{kpi.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-[#16212B]">Répartition par statut</h2>
          <div className="space-y-2">
            {statusBreakdown.map(([status, value]) => (
              <div key={status} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">{EMPLOYMENT_STATUS_LABELS[status as EmploymentStatus] ?? status}</span>
                <Badge variant="neutral">{value}</Badge>
              </div>
            ))}
          </div>
          {data.salaryTotal !== undefined && (
            <div className="mt-4 rounded-xl border border-[#D1F5E8] bg-[#D1F5E8]/40 px-3 py-2">
              <p className="text-xs text-slate-500">Masse salariale (actifs)</p>
              <p className="text-lg font-bold text-[#16212B]">{Number(data.salaryTotal).toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })}</p>
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-[#16212B]">Documents arrivant à expiration (90 jours)</h2>
          {data.expiringDocuments.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucun document à expirer prochainement.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-medium">Employé</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Fichier</th>
                    <th className="py-2 font-medium">Expire le</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiringDocuments.map(doc => (
                    <tr key={`${doc.employeeId}-${doc.originalName}`} className="border-b border-slate-50">
                      <td className="py-2 pr-3 font-medium text-[#16212B]">{doc.employeeName ?? '—'}</td>
                      <td className="py-2 pr-3 text-slate-600">{doc.documentType}</td>
                      <td className="flex items-center gap-1 py-2 pr-3 text-slate-500">
                        <FileClock className="h-3.5 w-3.5 text-amber-500" /> {doc.originalName ?? '—'}
                      </td>
                      <td className="py-2">
                        <Badge variant="warning">
                          {doc.expiryDate ?? '—'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
