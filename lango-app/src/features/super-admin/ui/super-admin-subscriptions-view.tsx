'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { DataTable, Column } from '@/components/shared/data-table';
import { ShieldCheck, AlertCircle, Layers, RefreshCw, CheckCircle2, Save, PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

type CatalogAddon = { addonId: string; name: string; description: string; built: boolean; requires: string[] };
type ApiSchool = {
  id: string; name: string; slug: string; planTier: string;
  licenseStatus: string; licenseKey: string | null; expiresAt: string | null;
};
type Summary = { total: number; active: number; expiring: number; expired: number; suspended: number; cancelled: number; none: number; pendingPayments: number };
type ApiData = { schools: ApiSchool[]; summary: Summary; catalog: CatalogAddon[] };

type PlanLimit = { planTier: string; label: string; maxStudents: number | null; maxStorageMb: number | null };
type PlanDraft = { label: string; maxStudents: string; maxStorageMb: string };

const TIERS = ['trial', 'basic', 'standard', 'premium'] as const;
const PLAN_LABELS: Record<(typeof TIERS)[number], string> = { trial: 'Essai', basic: 'Basique', standard: 'Standard', premium: 'Premium' };

function draftFromLimit(limit: PlanLimit): PlanDraft {
  return {
    label: limit.label,
    maxStudents: limit.maxStudents == null ? '' : String(limit.maxStudents),
    maxStorageMb: limit.maxStorageMb == null ? '' : String(limit.maxStorageMb),
  };
}

export function SuperAdminSubscriptionsView() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [limits, setLimits] = useState<PlanLimit[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [limitSuccess, setLimitSuccess] = useState<string | null>(null);

  // Addon create form state
  const [addonOpen, setAddonOpen] = useState(false);
  const [addonForm, setAddonForm] = useState({ id: '', name: '', description: '', enabled: false, requires: '' });
  const [addonSubmitting, setAddonSubmitting] = useState(false);
  const [addonError, setAddonError] = useState<string | null>(null);
  const [addonSuccess, setAddonSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/super-admin/subscriptions')
      .then(r => r.json())
      .then((json) => { if (json.success) setData(json.data); else setError(json.message || 'Erreur.'); })
      .catch(() => setError('Connexion impossible.'))
      .finally(() => setLoading(false));

    fetch('/api/super-admin/plan-limits')
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setLimits(json.data);
          const next: Record<string, PlanDraft> = {};
          for (const l of json.data) next[l.planTier] = draftFromLimit(l);
          setDrafts(next);
        } else {
          setLimitError(json.message || 'Impossible de charger les limites.');
        }
      })
      .catch(() => setLimitError('Connexion impossible.'));
  }, []);

  async function saveLimit(tier: (typeof TIERS)[number]) {
    const draft = drafts[tier];
    if (!draft) return;
    setSavingTier(tier);
    setLimitError(null);
    setLimitSuccess(null);
    try {
      const res = await fetch('/api/super-admin/plan-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: tier,
          label: draft.label,
          maxStudents: draft.maxStudents.trim() === '' ? null : Number(draft.maxStudents),
          maxStorageMb: draft.maxStorageMb.trim() === '' ? null : Number(draft.maxStorageMb),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setLimitError(json.message || 'Échec de l\'enregistrement.');
        return;
      }
      setLimits(prev => (prev ?? []).map(l => (l.planTier === tier ? json.data : l)));
      setLimitSuccess(`Limites du plan ${PLAN_LABELS[tier] ?? tier} enregistrées.`);
    } catch {
      setLimitError('Connexion impossible.');
    } finally {
      setSavingTier(null);
    }
  }

  async function refreshCatalog() {
    const r = await fetch('/api/super-admin/subscriptions');
    const json = await r.json();
    if (json.success) setData(json.data);
  }

  async function submitAddon(e: React.FormEvent) {
    e.preventDefault();
    setAddonSubmitting(true);
    setAddonError(null);
    setAddonSuccess(null);
    try {
      const requires = addonForm.requires
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/super-admin/addon-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: addonForm.id.trim(),
          name: addonForm.name.trim(),
          description: addonForm.description.trim(),
          enabled: addonForm.enabled,
          requires,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAddonError(json.error?.message || json.message || 'Échec de la création.');
        return;
      }
      setAddonSuccess(`Module « ${json.data.name} » ajouté au catalogue.`);
      setAddonForm({ id: '', name: '', description: '', enabled: false, requires: '' });
      setAddonOpen(false);
      refreshCatalog();
    } catch {
      setAddonError('Connexion impossible.');
    } finally {
      setAddonSubmitting(false);
    }
  }

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
          <Button
            size="sm"
            onClick={() => {
              setAddonError(null);
              setAddonSuccess(null);
              setAddonOpen(true);
            }}
            className="h-8 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Nouveau module
          </Button>
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

      {/* Plan-tier capacity limits (editable) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Limites par plan</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Capacités appliquées à chaque formule. Laissez un champ vide pour « illimité ».
          </p>
        </div>

        {limitError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{limitError}</span>
          </div>
        )}
        {limitSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{limitSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map(tier => {
            const draft = drafts[tier] ?? { label: PLAN_LABELS[tier]!, maxStudents: '', maxStorageMb: '' };
            return (
              <Card key={tier} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-[#0F172A]">{PLAN_LABELS[tier]}</span>
                  <span className="text-xs font-extrabold text-[#0066FF]">{planCounts[tier] ?? 0} école(s)</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Libellé</label>
                  <Input
                    value={draft.label}
                    onChange={e => setDrafts(prev => ({ ...prev, [tier]: { ...draft, label: e.target.value } }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Élèves max</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Illimité"
                    value={draft.maxStudents}
                    onChange={e => setDrafts(prev => ({ ...prev, [tier]: { ...draft, maxStudents: e.target.value } }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Stockage max (Mo)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Illimité"
                    value={draft.maxStorageMb}
                    onChange={e => setDrafts(prev => ({ ...prev, [tier]: { ...draft, maxStorageMb: e.target.value } }))}
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={savingTier === tier}
                  onClick={() => saveLimit(tier)}
                  className="w-full h-8 text-xs rounded-lg gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> {savingTier === tier ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Catalogue des modules</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Activation par école dans <span className="font-mono">Gestion Abonnements</span> — un module n&apos;est visible pour un établissement que s&apos;il y est activé.
          </p>
        </div>

        {addonSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{addonSuccess}</span>
          </div>
        )}
        {addonError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{addonError}</span>
          </div>
        )}

        <DataTable
          data={data?.catalog ?? []}
          columns={columns}
          isLoading={loading}
          emptyTitle="Aucun module"
          emptyDescription="Le catalogue est vide."
          defaultPageSize={10}
        />
      </div>

      {/* Addon create dialog */}
      <Dialog open={addonOpen} onOpenChange={setAddonOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#0F172A]">
              Nouveau module
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAddon} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Identifiant</label>
              <Input
                value={addonForm.id}
                onChange={e => setAddonForm({ ...addonForm, id: e.target.value })}
                placeholder="ex: reporting-custom"
                pattern="[a-z0-9][a-z0-9-]*"
                title="Minuscules, chiffres et tirets uniquement"
                className="h-9 text-xs rounded-xl border-slate-200 font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Nom</label>
              <Input
                value={addonForm.name}
                onChange={e => setAddonForm({ ...addonForm, name: e.target.value })}
                placeholder="ex: Reporting personnalisé"
                className="h-9 text-xs rounded-xl border-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Description</label>
              <Textarea
                value={addonForm.description}
                onChange={e => setAddonForm({ ...addonForm, description: e.target.value })}
                placeholder="Ce que fait le module et pour qui."
                rows={3}
                className="text-xs rounded-xl border-slate-200 resize-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Prérequis (identifiants séparés par des virgules)</label>
              <Input
                value={addonForm.requires}
                onChange={e => setAddonForm({ ...addonForm, requires: e.target.value })}
                placeholder="ex: human-resources"
                className="h-9 text-xs rounded-xl border-slate-200 font-mono"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={addonForm.enabled}
                onChange={e => setAddonForm({ ...addonForm, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]"
              />
              Module construit (visible dans le catalogue, sinon « À venir »)
            </label>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddonOpen(false)}
                className="h-9 text-xs rounded-xl border-slate-200"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={addonSubmitting}
                className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5"
              >
                {addonSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Créer le module
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
