'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { DataTable, Column } from '@/components/shared/data-table';
import { ShieldCheck, AlertCircle, Layers, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CatalogAddon = { addonId: string; name: string; description: string; built: boolean; requires: string[] };
type ApiSchool = {
  id: string; name: string; slug: string; planTier: string;
  licenseStatus: string; licenseKey: string | null; expiresAt: string | null;
};
type Summary = { total: number; active: number; expiring: number; expired: number; suspended: number; cancelled: number; none: number; pendingPayments: number };
type ApiData = { schools: ApiSchool[]; summary: Summary; catalog: CatalogAddon[] };

const PLAN_LABELS: Record<string, string> = { trial: 'Essai', basic: 'Basique', standard: 'Standard', premium: 'Premium' };
const PLAN_DESC: Record<string, string> = {
  trial: 'Offre découverte pour les nouveaux établissements.',
  basic: 'Fonctionnalités essentielles pour les petites écoles.',
  standard: 'Modules étendus pour les établissements en croissance.',
  premium: 'Tous les modules, campus illimités, support prioritaire.',
};

export function SuperAdminSubscriptionsView() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/super-admin/subscriptions')
      .then(r => r.json())
      .then((json) => { if (json.success) setData(json.data); else setError(json.message || 'Erreur.'); })
      .catch(() => setError('Connexion impossible.'))
      .finally(() => setLoading(false));
  }, []);

  const summary = data?.summary;
  const planCounts: Record<string, number> = { trial: 0, basic: 0, standard: 0, premium: 0 };
  for (const s of data?.schools ?? []) planCounts[s.planTier] = (planCounts[s.planTier] ?? 0) + 1;

  const columns: Column<CatalogAddon>[] = [
    {
      key: 'name', header: 'Module',
      cell: a => (
        <div>
          <p className="text-xs font-bold text-[#0F172A]">{a.name}</p>
          <p className="text-[10px] text-slate-400 font-mono">{a.addonId}</p>
        </div>
      ),
    },
    { key: 'description', header: 'Description', cell: a => <span className="text-xs text-slate-500">{a.description}</span> },
    { key: 'requires', header: 'Prérequis', cell: a => <span className="text-xs text-slate-500">{a.requires.length ? a.requires.join(', ') : '—'}</span> },
    {
      key: 'built', header: 'Statut',
      cell: a => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.built ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {a.built ? 'Construit' : 'À venir'}
        </span>
      ),
    },
  ];

  const kpis = [
    { label: 'Total écoles', value: summary?.total ?? 0, cls: 'text-[#0F172A]' },
    { label: 'Licences actives', value: (summary?.active ?? 0) + (summary?.expiring ?? 0), cls: 'text-emerald-600' },
    { label: 'Expirées / sans licence', value: (summary?.expired ?? 0) + (summary?.none ?? 0), cls: 'text-rose-600' },
    { label: 'Demandes en attente', value: summary?.pendingPayments ?? 0, cls: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Plans & Modules</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Catalogue des offres tarifaires et des modules de la plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-8 text-xs rounded-xl border-slate-200 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Réessayer
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-bold text-slate-500">{k.label}</p>
            <p className={`text-2xl font-extrabold tracking-tight ${k.cls}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(['trial', 'basic', 'standard', 'premium'] as const).map(tier => (
          <Card key={tier} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-[#0F172A]">{PLAN_LABELS[tier]}</span>
              <span className="text-xs font-extrabold text-[#0066FF]">{planCounts[tier] ?? 0} école(s)</span>
            </div>
            <p className="text-xs text-slate-500">{PLAN_DESC[tier]}</p>
          </Card>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Catalogue des modules</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Activation par école dans <span className="font-mono">Gestion Abonnements</span> — un module n&apos;est visible pour un établissement que s&apos;il y est activé.
          </p>
        </div>
        <DataTable
          data={data?.catalog ?? []}
          columns={columns}
          isLoading={loading}
          emptyTitle="Aucun module"
          emptyDescription="Le catalogue est vide."
          defaultPageSize={10}
        />
      </div>
    </div>
  );
}
