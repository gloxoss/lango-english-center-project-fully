'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ShieldCheck, Sparkles, Download, Search, Lock, Check, AlertCircle, RefreshCw,
} from 'lucide-react';

type AddonModule = {
  addonId: string;
  name: string;
  description: string;
  built: boolean;
  active: boolean;
  expiresAt: string | null;
  expiryLabel: string | null;
};

type PlanInfo = {
  planTier: string;
  subscriptionStatus: string;
  maxBranches: number;
  hasMultiBranchAddon: boolean;
  branchCount: number;
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Offre SchoolOS Découverte',
  basic: 'Offre SchoolOS Basic',
  standard: 'Offre SchoolOS Standard',
  premium: 'Offre SchoolOS Enterprise',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Licence Valide',
  suspended: 'Licence Suspendue',
  cancelled: 'Licence Annulée',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-[#DDF5EC] text-[#17A673]',
  suspended: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

type ModuleStatus = 'active' | 'expired' | 'available' | 'upcoming';

function moduleStatus(m: AddonModule): ModuleStatus {
  if (m.active) return 'active';
  if (m.expiresAt) return 'expired';
  if (m.built) return 'available';
  return 'upcoming';
}

const STATUS_CARD_BADGE: Record<ModuleStatus, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-[#DDF5EC] text-[#17A673]' },
  expired: { label: 'Expiré', className: 'bg-rose-50 text-rose-500' },
  available: { label: 'Disponible', className: 'bg-blue-50 text-[#1B6C93]' },
  upcoming: { label: 'À venir', className: 'bg-slate-100 text-slate-500' },
};

export function EntitlementsCatalogView({ locale }: { locale?: string } = {}) {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'premium'>('all');
  const [search, setSearch] = useState('');
  const [modules, setModules] = useState<AddonModule[]>([]);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/addons');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Impossible de charger les modules');
      setModules(json.data ?? []);
      setPlan(json.plan ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les modules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredModules = modules.filter(m => {
    const s = moduleStatus(m);
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all'
      || (activeTab === 'active' && s === 'active')
      || (activeTab === 'premium' && s !== 'active');
    return matchesSearch && matchesTab;
  });

  const activeModuleCount = modules.filter(m => m.active).length;
  const earliestExpiry = modules
    .filter(m => m.active && m.expiresAt)
    .map(m => new Date(m.expiresAt as string).getTime())
    .sort((a, b) => a - b)[0];
  const contractExpiry = earliestExpiry ? new Date(earliestExpiry).toLocaleDateString('fr-FR') : '—';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Catalogue de Licences & Offres Subscrites</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez les modules activés, suivez vos quotas de consommation et demandez l&apos;extension de vos licences.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
            <Download className="w-4 h-4 text-slate-600" />
            <span>Attestation de licence</span>
          </Button>
          <Button size="sm" className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
            <Sparkles className="w-4 h-4" />
            <span>Demander un nouveau module</span>
          </Button>
        </div>
      </div>

      {/* Subscription Plan Summary Band */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#16212B]">
                  {PLAN_LABELS[plan?.planTier ?? ''] ?? 'Offre SchoolOS'}
                </h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_BADGE[plan?.subscriptionStatus ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABELS[plan?.subscriptionStatus ?? ''] ?? 'Licence'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Expiration du contrat d&apos;abonnement: <strong className="text-slate-700">{contractExpiry}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 text-xs">
            <div>
              <p className="text-slate-400 font-bold">Campus Inclus</p>
              <p className="font-extrabold text-[#16212B] text-sm">{plan?.branchCount ?? 0} / {plan?.maxBranches ?? 1}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold">Modules Actifs</p>
              <p className="font-extrabold text-[#16212B] text-sm">{activeModuleCount}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Modules Filter & Search */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'Tous les modules' },
            { id: 'active', label: 'Modules Actifs' },
            { id: 'premium', label: 'Modules Optionnels' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                activeTab === tab.id ? 'bg-[#2487B8] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un module..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
          />
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <Card className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm font-bold text-[#16212B]">Impossible de charger le catalogue</p>
          <p className="text-xs text-slate-500">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()} className="h-8 text-xs rounded-xl mt-2">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Réessayer
          </Button>
        </Card>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-full bg-slate-50 rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-slate-50 rounded animate-pulse" />
              <div className="pt-3 border-t border-slate-100 h-4 w-20 bg-slate-100 rounded animate-pulse" />
            </Card>
          ))}
        </div>
      )}

      {/* Modules Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map(m => {
            const s = moduleStatus(m);
            const badge = STATUS_CARD_BADGE[s];
            return (
              <Card key={m.addonId} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">{m.expiryLabel ?? '—'}</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#16212B]">{m.name}</h3>
                  <p className="text-xs text-slate-500">{m.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {s === 'active' ? (
                    <span className="flex items-center gap-1 text-[#17A673] font-bold text-[11px]">
                      <Check className="w-4 h-4" /> Inclus
                    </span>
                  ) : s === 'available' ? (
                    <Button size="sm" variant="outline" disabled className="h-8 text-xs font-bold rounded-xl border-slate-200 gap-1 text-[#2487B8]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Sur demande</span>
                    </Button>
                  ) : s === 'expired' ? (
                    <span className="flex items-center gap-1 text-rose-500 font-bold text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" /> Expiré
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400 font-bold text-[11px]">
                      <Lock className="w-3.5 h-3.5" /> À venir
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !error && filteredModules.length === 0 && (
        <Card className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-[#16212B]">Aucun module trouvé</p>
          <p className="text-xs text-slate-500">Aucun module ne correspond à votre recherche "{search}".</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setActiveTab('all'); }} className="h-8 text-xs rounded-xl mt-2">
            Réinitialiser les filtres
          </Button>
        </Card>
      )}
    </div>
  );
}
