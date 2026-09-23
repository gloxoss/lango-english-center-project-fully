'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { DataTable, Column } from '@/components/shared/data-table';
import {
  ShieldCheck,
  AlertCircle,
  Layers,
  RefreshCw,
  CheckCircle2,
  PlusCircle,
  Loader2,
  Users,
  HardDrive,
  Building,
  Edit,
  Trash2,
  RotateCw,
  Sparkles,
  Clock,
  Check,
  PackageCheck,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type CatalogAddon = { addonId: string; name: string; description: string; built: boolean; requires: string[] };

type PlanRecord = {
  planTier: string;
  label: string;
  description: string | null;
  maxStudents: number | null;
  maxStorageMb: number | null;
  maxBranches: number;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  isTrial: boolean;
  includedAddons: string[];
  features: string[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  schoolCount: number;
  createdAt: string;
  updatedAt: string;
};

type Summary = { total: number; active: number; expiring: number; expired: number; suspended: number; cancelled: number; none: number; pendingPayments: number };

type PlanFormData = {
  planTier: string;
  label: string;
  description: string;
  maxStudents: string;
  maxStorageMb: string;
  maxBranches: number;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  trialDays: string;
  isTrial: boolean;
  includedAddons: string[];
  features: string;
  isActive: boolean;
  isPopular: boolean;
  syncToExistingSchools: boolean;
};

const EMPTY_PLAN_FORM: PlanFormData = {
  planTier: '',
  label: '',
  description: '',
  maxStudents: '',
  maxStorageMb: '',
  maxBranches: 1,
  priceMonthly: '0',
  priceYearly: '0',
  currency: 'MAD',
  trialDays: '14',
  isTrial: false,
  includedAddons: [],
  features: '',
  isActive: true,
  isPopular: false,
  syncToExistingSchools: false,
};

const SYSTEM_TIERS = ['trial', 'basic', 'standard', 'premium'];

export function SuperAdminSubscriptionsView() {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [catalog, setCatalog] = useState<CatalogAddon[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Plan Edit / Create Modal State
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [planForm, setPlanForm] = useState<PlanFormData>(EMPTY_PLAN_FORM);
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Action States
  const [syncingTier, setSyncingTier] = useState<string | null>(null);
  const [deletingTier, setDeletingTier] = useState<string | null>(null);

  // Addon create form state
  const [addonOpen, setAddonOpen] = useState(false);
  const [addonForm, setAddonForm] = useState({ id: '', name: '', description: '', enabled: true, requires: '' });
  const [addonSubmitting, setAddonSubmitting] = useState(false);
  const [addonError, setAddonError] = useState<string | null>(null);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 4500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, subsRes] = await Promise.all([
        fetch('/api/super-admin/plans'),
        fetch('/api/super-admin/subscriptions'),
      ]);

      const plansJson = await plansRes.json();
      const subsJson = await subsRes.json();

      if (plansJson.success) {
        setPlans(plansJson.data.plans);
        setCatalog(plansJson.data.catalog);
      } else {
        throw new Error(plansJson.message || 'Impossible de charger les formules.');
      }

      if (subsJson.success) {
        setSummary(subsJson.data.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Open Create Modal
  function handleOpenCreate() {
    setIsEditing(false);
    setFormError(null);
    setPlanForm({
      ...EMPTY_PLAN_FORM,
      includedAddons: catalog.filter(a => a.built).map(a => a.addonId),
    });
    setPlanModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(plan: PlanRecord) {
    setIsEditing(true);
    setFormError(null);
    setPlanForm({
      planTier: plan.planTier,
      label: plan.label,
      description: plan.description ?? '',
      maxStudents: plan.maxStudents == null ? '' : String(plan.maxStudents),
      maxStorageMb: plan.maxStorageMb == null ? '' : String(plan.maxStorageMb),
      maxBranches: plan.maxBranches ?? 1,
      priceMonthly: String(plan.priceMonthly ?? 0),
      priceYearly: String(plan.priceYearly ?? 0),
      currency: plan.currency ?? 'MAD',
      trialDays: String(plan.trialDays ?? 0),
      isTrial: plan.isTrial ?? false,
      includedAddons: plan.includedAddons ?? [],
      features: (plan.features ?? []).join('\n'),
      isActive: plan.isActive ?? true,
      isPopular: plan.isPopular ?? false,
      syncToExistingSchools: false,
    });
    setPlanModalOpen(true);
  }

  // Save Plan (Create or Update)
  async function handleSubmitPlan(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingPlan(true);
    setFormError(null);

    try {
      const payload = {
        label: planForm.label.trim(),
        description: planForm.description.trim() || null,
        maxStudents: planForm.maxStudents.trim() === '' ? null : Number(planForm.maxStudents),
        maxStorageMb: planForm.maxStorageMb.trim() === '' ? null : Number(planForm.maxStorageMb),
        maxBranches: Number(planForm.maxBranches) || 1,
        priceMonthly: Number(planForm.priceMonthly) || 0,
        priceYearly: Number(planForm.priceYearly) || 0,
        currency: planForm.currency.trim() || 'MAD',
        trialDays: Number(planForm.trialDays) || 0,
        isTrial: planForm.isTrial,
        includedAddons: planForm.includedAddons,
        features: planForm.features.split('\n').map(s => s.trim()).filter(Boolean),
        isActive: planForm.isActive,
        isPopular: planForm.isPopular,
        syncToExistingSchools: planForm.syncToExistingSchools,
      };

      let res: Response;
      if (isEditing) {
        res = await fetch(`/api/super-admin/plans/${planForm.planTier}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/super-admin/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planTier: planForm.planTier.trim().toLowerCase(),
            ...payload,
          }),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || tCommon('error'));
      }

      flashSuccess(json.message || tCommon('success'));
      setPlanModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setSubmittingPlan(false);
    }
  }

  // Sync modules of a plan to all assigned schools
  async function handleSyncModules(planTier: string) {
    setSyncingTier(planTier);
    try {
      const res = await fetch(`/api/super-admin/plans/${planTier}/sync`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || tCommon('error'));
      }
      flashSuccess(json.message);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setSyncingTier(null);
    }
  }

  // Delete a plan
  async function handleDeletePlan(planTier: string) {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement la formule "${planTier}" ?`)) {
      return;
    }
    setDeletingTier(planTier);
    try {
      const res = await fetch(`/api/super-admin/plans/${planTier}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || tCommon('error'));
      }
      flashSuccess(json.message);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setDeletingTier(null);
    }
  }

  // Toggle single addon in form
  function toggleAddon(addonId: string) {
    setPlanForm(prev => {
      const exists = prev.includedAddons.includes(addonId);
      return {
        ...prev,
        includedAddons: exists
          ? prev.includedAddons.filter(id => id !== addonId)
          : [...prev.includedAddons, addonId],
      };
    });
  }

  // Submit new addon
  async function submitAddon(e: React.FormEvent) {
    e.preventDefault();
    setAddonSubmitting(true);
    setAddonError(null);
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
        throw new Error(json.error?.message || json.message || tCommon('error'));
      }
      flashSuccess(tCommon('success'));
      setAddonForm({ id: '', name: '', description: '', enabled: true, requires: '' });
      setAddonOpen(false);
      await loadData();
    } catch (err) {
      setAddonError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setAddonSubmitting(false);
    }
  }

  const columns: Column<CatalogAddon>[] = [
    {
      key: 'name',
      header: t('moduleCol'),
      cell: a => (
        <div>
          <p className="text-xs font-bold text-[#0F172A]">{a.name}</p>
          <p className="text-[10px] text-slate-400 font-mono">{a.addonId}</p>
        </div>
      ),
    },
    { key: 'description', header: t('descCol'), cell: a => <span className="text-xs text-slate-500">{a.description}</span> },
    { key: 'requires', header: t('requiresCol'), cell: a => <span className="text-xs text-slate-500">{a.requires.length ? a.requires.join(', ') : '—'}</span> },
    {
      key: 'built',
      header: t('statusCol'),
      cell: a => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.built ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {a.built ? t('statusColBuilt') : t('statusColUpcoming')}
        </span>
      ),
    },
  ];

  const trialSchoolsCount = plans.find(p => p.planTier === 'trial')?.schoolCount ?? 0;
  const paidSchoolsCount = plans.filter(p => p.planTier !== 'trial').reduce((acc, p) => acc + p.schoolCount, 0);

  const kpis = [
    { label: t('totalSchoolsStat'), value: summary?.total ?? 0, cls: 'text-[#0F172A]' },
    { label: 'Écoles en Essai Gratuit', value: trialSchoolsCount, cls: 'text-[#0066FF]' },
    { label: t('activeLicensesStat'), value: paidSchoolsCount, cls: 'text-emerald-600' },
    { label: 'Modules au Catalogue', value: catalog.length, cls: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Formules d'Abonnement & Modules</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Gérez les formules commerciales, l'offre d'essai gratuit, les modules inclus et la tarification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-8 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Nouveau Plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAddonError(null);
              setAddonOpen(true);
            }}
            className="h-8 text-xs rounded-xl border-slate-200 text-slate-700 font-bold gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-[#0066FF]" /> Nouveau Module
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
            className="h-8 text-xs rounded-xl border-slate-200 gap-1.5 text-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-bold text-slate-500">{k.label}</p>
            <p className={`text-2xl font-extrabold tracking-tight mt-1 ${k.cls}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Interactive Plan Cards */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-[#0066FF]" />
              Formules & Quotas Actifs ({plans.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Chaque formule définit sa tarification, sa période d'essai et la liste des modules attribués aux écoles.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map(plan => {
            const isSystem = SYSTEM_TIERS.includes(plan.planTier);
            const includedCount = plan.includedAddons?.length ?? 0;
            const isSyncing = syncingTier === plan.planTier;
            const isDeleting = deletingTier === plan.planTier;

            return (
              <Card
                key={plan.planTier}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between shadow-2xs relative ${
                  plan.isPopular
                    ? 'border-[#0066FF] ring-2 ring-[#0066FF]/10'
                    : plan.isTrial
                    ? 'border-sky-300'
                    : 'border-slate-200/80'
                }`}
              >
                {/* Badges bar */}
                <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-extrabold text-[#0F172A]">{plan.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                      {plan.planTier}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {plan.isTrial && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-700">
                        Essai Gratuit
                      </span>
                    )}
                    {plan.isPopular && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Recommandé
                      </span>
                    )}
                  </div>
                </div>

                {/* Plan Content */}
                <div className="p-4 space-y-3 flex-1">
                  {/* Price Tag */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#0F172A]">
                        {plan.isTrial || plan.priceMonthly === 0 ? '0' : plan.priceMonthly}
                      </span>
                      <span className="text-xs font-extrabold text-slate-500">
                        {plan.currency} {plan.priceMonthly > 0 ? '/ mois' : ''}
                      </span>
                    </div>
                    {plan.priceYearly > 0 && (
                      <p className="text-[11px] text-slate-400 font-medium">
                        ou {plan.priceYearly} {plan.currency} / an facturé annuellement
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  {plan.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {plan.description}
                    </p>
                  )}

                  {/* Capacity & Quotas list */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> Élèves max
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {plan.maxStudents ? `${plan.maxStudents} élèves` : 'Illimité'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Stockage
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {plan.maxStorageMb
                          ? plan.maxStorageMb >= 1024
                            ? `${(plan.maxStorageMb / 1024).toFixed(0)} Go`
                            : `${plan.maxStorageMb} Mo`
                          : 'Illimité'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Building className="w-3.5 h-3.5 text-slate-400" /> Campus / Succursales
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {plan.maxBranches > 1 ? `${plan.maxBranches} campus` : '1 principal'}
                      </span>
                    </div>

                    {plan.isTrial && (
                      <div className="flex items-center justify-between text-sky-700 font-semibold bg-sky-50 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-sky-600" /> Durée d'essai
                        </span>
                        <span className="font-bold">{plan.trialDays} jours</span>
                      </div>
                    )}
                  </div>

                  {/* Included Modules Section */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-slate-600">Modules inclus</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 text-[#0066FF]">
                        {includedCount} module(s)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                      {plan.includedAddons.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">Aucun module pré-inclus</span>
                      ) : (
                        plan.includedAddons.map(addonId => {
                          const def = catalog.find(c => c.addonId === addonId);
                          return (
                            <span
                              key={addonId}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                              title={def?.description ?? addonId}
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              {def?.name ?? addonId}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 bg-slate-50/70 border-t border-slate-100 rounded-b-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                    <span>Établissements abonnés :</span>
                    <span className="font-extrabold text-[#0066FF]">{plan.schoolCount} école(s)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(plan)}
                      className="h-7 text-xs rounded-lg border-slate-200 text-slate-700 font-bold gap-1"
                    >
                      <Edit className="w-3 h-3 text-[#0066FF]" /> Modifier
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSyncing || plan.includedAddons.length === 0 || plan.schoolCount === 0}
                      onClick={() => handleSyncModules(plan.planTier)}
                      className="h-7 text-xs rounded-lg border-slate-200 text-slate-700 font-bold gap-1"
                      title="Attribue les modules de cette formule à toutes les écoles qui y sont abonnées"
                    >
                      {isSyncing ? (
                        <Loader2 className="w-3 h-3 animate-spin text-[#0066FF]" />
                      ) : (
                        <RotateCw className="w-3 h-3 text-emerald-600" />
                      )}
                      Sync écoles
                    </Button>
                  </div>

                  {!isSystem && plan.schoolCount === 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => handleDeletePlan(plan.planTier)}
                      className="h-6 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg gap-1 w-full justify-center"
                    >
                      <Trash2 className="w-3 h-3" /> Supprimer ce plan
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Catalog of Modules */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[#0F172A]">{t('moduleCatalogTitle')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('moduleCatalogSubtitle')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAddonError(null);
              setAddonOpen(true);
            }}
            className="h-8 text-xs rounded-xl border-slate-200 text-slate-700 font-bold gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#0066FF]" /> Ajouter au catalogue
          </Button>
        </div>

        <DataTable
          data={catalog}
          columns={columns}
          isLoading={loading}
          emptyTitle={tCommon('empty')}
          emptyDescription={tCommon('empty')}
          defaultPageSize={10}
        />
      </div>

      {/* CREATE / EDIT PLAN DIALOG */}
      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#0F172A] flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-[#0066FF]" />
              {isEditing ? `Modifier la formule "${planForm.label}"` : 'Créer une nouvelle formule'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configurez l'ensemble des règles de cette formule : tarifs, quotas, durée d'essai et modules inclus.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitPlan} className="space-y-4 py-1 text-xs">
            {/* General Section */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
              <h4 className="font-extrabold text-[#0F172A] text-xs flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#0066FF]" />
                Identité & Paramètres de l'Offre
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">
                    Identifiant / Code technique <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={planForm.planTier}
                    onChange={e => setPlanForm({ ...planForm, planTier: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="ex: starter, pro, groupe"
                    disabled={isEditing}
                    className="h-8 text-xs font-mono rounded-lg"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">En minuscules sans espaces (kebab-case).</p>
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-1">
                    Nom public de la formule <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={planForm.label}
                    onChange={e => setPlanForm({ ...planForm, label: e.target.value })}
                    placeholder="ex: Formule Élite / Campus Pro"
                    className="h-8 text-xs rounded-lg font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Description commerciale</label>
                <Textarea
                  value={planForm.description}
                  onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Décrivez à qui s'adresse cette offre..."
                  rows={2}
                  className="text-xs rounded-lg resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planForm.isTrial}
                    onChange={e => setPlanForm({ ...planForm, isTrial: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]"
                  />
                  Offre d'essai gratuit (Trial)
                </label>

                {planForm.isTrial && (
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Durée d'essai (jours)</label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={planForm.trialDays}
                      onChange={e => setPlanForm({ ...planForm, trialDays: e.target.value })}
                      className="h-8 text-xs rounded-lg"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Pricing & Limits Section */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
              <h4 className="font-extrabold text-[#0F172A] text-xs flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-[#0066FF]" />
                Tarification & Quotas Techniques
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Prix mensuel (MAD)</label>
                  <Input
                    type="number"
                    min={0}
                    value={planForm.priceMonthly}
                    onChange={e => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
                    className="h-8 text-xs rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-1">Prix annuel (MAD)</label>
                  <Input
                    type="number"
                    min={0}
                    value={planForm.priceYearly}
                    onChange={e => setPlanForm({ ...planForm, priceYearly: e.target.value })}
                    className="h-8 text-xs rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-1">Campus max</label>
                  <Input
                    type="number"
                    min={1}
                    value={planForm.maxBranches}
                    onChange={e => setPlanForm({ ...planForm, maxBranches: Number(e.target.value) || 1 })}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Élèves max (vide = illimité)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Illimité"
                    value={planForm.maxStudents}
                    onChange={e => setPlanForm({ ...planForm, maxStudents: e.target.value })}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-1">Stockage max en Mo (vide = illimité)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Illimité (ex: 2048 pour 2 Go)"
                    value={planForm.maxStorageMb}
                    onChange={e => setPlanForm({ ...planForm, maxStorageMb: e.target.value })}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Modules Configuration Grid */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-[#0F172A] text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#0066FF]" />
                    Modules & Add-ons Inclus ({planForm.includedAddons.length} / {catalog.length})
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Cochez les modules accordés par défaut aux écoles souscrivant à cette formule.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlanForm({ ...planForm, includedAddons: catalog.map(c => c.addonId) })}
                    className="h-6 text-[10px] px-2 rounded-md font-bold text-[#0066FF]"
                  >
                    Tout cocher
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlanForm({ ...planForm, includedAddons: [] })}
                    className="h-6 text-[10px] px-2 rounded-md text-slate-500"
                  >
                    Tout décocher
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200/70">
                {catalog.map(addon => {
                  const isChecked = planForm.includedAddons.includes(addon.addonId);
                  return (
                    <label
                      key={addon.addonId}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-[#0066FF]/5 border-[#0066FF]/30 text-[#0F172A]'
                          : 'bg-slate-50/50 border-slate-200/60 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAddon(addon.addonId)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs leading-tight">{addon.name}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{addon.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Sync option on update */}
              {isEditing && (
                <div className="pt-2 border-t border-slate-200/60">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.syncToExistingSchools}
                      onChange={e => setPlanForm({ ...planForm, syncToExistingSchools: e.target.checked })}
                      className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                    />
                    Appliquer immédiatement ces modules aux établissements existants sur ce plan
                  </label>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlanModalOpen(false)}
                className="h-8 text-xs rounded-xl border-slate-200"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingPlan}
                className="h-8 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5"
              >
                {submittingPlan && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEditing ? 'Enregistrer les modifications' : 'Créer la formule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADDON CREATE DIALOG */}
      <Dialog open={addonOpen} onOpenChange={setAddonOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#0F172A]">
              Nouveau Module au Catalogue
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAddon} className="space-y-4 py-2">
            {addonError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addonError}</span>
              </div>
            )}
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
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={addonSubmitting}
                className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5"
              >
                {addonSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
