'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';

type ApiSchoolDetail = {
  id: string;
  name: string;
  slug: string;
  planTier: 'trial' | 'basic' | 'standard' | 'premium';
  subscriptionStatus: 'active' | 'suspended' | 'cancelled';
  isActive: boolean;
  createdAt: string;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
};

type DetailAddon = { addonId: string; name: string; description: string; built: boolean; active: boolean; expiresAt: string | null };
type DetailPayment = { id: string; planTier: string; amount: string; method: string; status: string; transactionRef: string | null; purchasedAt: string | null; expiresAtAtPurchase: string | null; requestedMonths: number | null; createdAt: string | null };
type SubscriptionDetail = {
  tenant: { id: string; name: string; slug: string; planTier: string; subscriptionStatus: string };
  license: { id: string; licenseKey: string; status: string; issuedAt: string | null; expiresAt: string | null; lastUpgradeAt: string | null; notes: string | null } | null;
  licenseStatus: string;
  payments: DetailPayment[];
  addons: DetailAddon[];
};
type PlanLimit = { planTier: string; label: string; maxStudents: number | null; maxStorageMb: number | null };

const PLAN_LABELS: Record<string, string> = { trial: 'Essai', basic: 'Basique', standard: 'Standard', premium: 'Premium' };
const LIC_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  expiring: { label: 'Expire bientôt', cls: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Expirée', cls: 'bg-rose-50 text-rose-700' },
  suspended: { label: 'Suspendue', cls: 'bg-amber-50 text-amber-700' },
  cancelled: { label: 'Annulée', cls: 'bg-rose-50 text-rose-700' },
  none: { label: 'Sans licence', cls: 'bg-slate-100 text-slate-600' },
};
const PAY_STATUS_LABELS: Record<string, string> = { pending: 'En attente', paid: 'Payé', rejected: 'Refusé' };
const METHOD_LABELS: Record<string, string> = { cash: 'Espèces', bank_transfer: 'Virement', card: 'Carte' };
const NO_LICENSE_STATUS = { label: 'Sans licence', cls: 'bg-slate-100 text-slate-600' };

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const fmtAmount = (n: string | number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(Number(n));

export function SuperAdminSchoolDetailView({ locale, schoolId }: { locale: string; schoolId: string }) {
  const [school, setSchool] = useState<ApiSchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Subscription detail (license / addons / payments) — merged into this one screen.
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [planLimits, setPlanLimits] = useState<PlanLimit[]>([]);
  const [busy, setBusy] = useState(false);
  const [issueMonths, setIssueMonths] = useState(12);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, string>>({});

  const flash = (msg: string) => {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const [schoolRes, detailRes, limitsRes] = await Promise.all([
        fetch(`/api/super-admin/schools?id=${schoolId}`),
        fetch(`/api/super-admin/subscriptions/${schoolId}`),
        fetch('/api/super-admin/plan-limits'),
      ]);
      const schoolJson = await schoolRes.json();
      if (!schoolRes.ok || !schoolJson.success) {
        setError(schoolJson.message || 'École introuvable.');
        return;
      }
      setSchool(schoolJson.data);

      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        if (detailJson.success) setDetail(detailJson.data);
      }
      if (limitsRes.ok) {
        const limitsJson = await limitsRes.json();
        if (limitsJson.success) setPlanLimits(Array.isArray(limitsJson.data) ? limitsJson.data : []);
      }
    } catch {
      setError('Connexion impossible.');
    } finally {
      setDetailLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateSchool(patch: Partial<Pick<ApiSchoolDetail, 'planTier' | 'subscriptionStatus' | 'isActive'>>) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/super-admin/schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: schoolId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la mise à jour.');
        return;
      }
      flash('École mise à jour.');
      await load();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function licenseAction(action: 'issue' | 'extend' | 'revoke', months?: number) {
    setBusy(true);
    setError(null);
    try {
      const body = action === 'issue'
        ? { action, months }
        : action === 'extend'
          ? { action, months: 12 }
          : { action };
      const res = await fetch(`/api/super-admin/subscriptions/${schoolId}/license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Échec de l\'opération.');
      flash(action === 'issue' ? 'Licence émise.' : action === 'extend' ? 'Licence prolongée.' : 'Licence révoquée.');
      setConfirmRevoke(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAddon(addonId: string, enable: boolean) {
    setBusy(true);
    setError(null);
    try {
      const url = '/api/super-admin/entitlements';
      const res = enable
        ? await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: schoolId, addonId, isEnabled: true }) })
        : await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: schoolId, addonId }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Échec du basculement du module.');
      flash(enable ? 'Module activé.' : 'Module désactivé.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function decidePayment(paymentId: string, approved: boolean, amount?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/subscriptions/${schoolId}/payments/${paymentId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, amount: approved ? Number(amount ?? 0) : undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Échec de la décision.');
      flash(approved ? 'Demande approuvée — licence prolongée.' : 'Demande refusée.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !school) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-4">
        <Link href={`/${locale}/dashboard/super-admin/schools`} className="inline-flex items-center gap-1 text-xs text-[#0066FF] font-bold">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à la liste des écoles
        </Link>
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="max-w-[1600px] mx-auto py-16 flex items-center justify-center text-xs font-semibold text-slate-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement de l&apos;école...
      </div>
    );
  }

  const tierLimit = planLimits.find(l => l.planTier === school.planTier)?.maxStudents ?? null;
  const license = detail?.license ?? null;
  const licenseStatus = detail?.licenseStatus ?? 'none';
  const payments = detail?.payments ?? [];
  const addons = detail?.addons ?? [];
  const pendingPayments = payments.filter(p => p.status === 'pending');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="pb-3 border-b border-slate-200/80">
        <Link href={`/${locale}/dashboard/super-admin/schools`} className="inline-flex items-center gap-1 text-xs text-[#0066FF] font-bold mb-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour à la liste des écoles</span>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{school.name}</h1>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${school.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {school.isActive ? 'Active' : 'Désactivée'}
          </span>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-0.5 font-mono">{school.slug} • Créée le {new Date(school.createdAt).toLocaleDateString('fr-FR')}</p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Counts + plan capacity */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">Élèves</p>
          <p className="text-xs font-extrabold text-[#0F172A] mt-0.5">{school.studentCount}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">Enseignants</p>
          <p className="text-xs font-extrabold text-[#0F172A] mt-0.5">{school.teacherCount}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">Comptes staff</p>
          <p className="text-xs font-extrabold text-[#0F172A] mt-0.5">{school.staffCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Subscription management */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Gestion de l&apos;abonnement</h3>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Plan tarifaire</label>
            <Select value={school.planTier} onValueChange={v => updateSchool({ planTier: v as ApiSchoolDetail['planTier'] })} disabled={saving}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Essai</SelectItem>
                <SelectItem value="basic">Basique</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Statut de l&apos;abonnement</label>
            <Select value={school.subscriptionStatus} onValueChange={v => updateSchool({ subscriptionStatus: v as ApiSchoolDetail['subscriptionStatus'] })} disabled={saving}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="suspended">Suspendu</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
            <p className="text-[10px] text-slate-400 font-medium">Capacité du plan ({PLAN_LABELS[school.planTier] ?? school.planTier})</p>
            <p className="text-xs font-extrabold text-[#0F172A] mt-0.5">
              {school.studentCount} / {tierLimit ?? 'Illimité'} élèves
              {tierLimit != null && school.studentCount >= tierLimit && <span className="text-rose-600 ml-1">• atteinte</span>}
            </p>
            {tierLimit != null && (
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full ${school.studentCount >= tierLimit ? 'bg-rose-500' : 'bg-[#0066FF]'}`}
                  style={{ width: `${Math.min(100, Math.round((school.studentCount / tierLimit) * 100))}%` }}
                />
              </div>
            )}
          </div>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => updateSchool({ isActive: !school.isActive })}
            className={`w-full text-xs font-bold ${school.isActive ? 'text-rose-600 border-rose-200' : 'text-emerald-600 border-emerald-200'}`}
          >
            {school.isActive ? 'Désactiver cette école' : 'Réactiver cette école'}
          </Button>
        </Card>

        {/* License management */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0066FF]" />
              Licence
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${(LIC_STATUS[licenseStatus] ?? NO_LICENSE_STATUS).cls}`}>
              {(LIC_STATUS[licenseStatus] ?? NO_LICENSE_STATUS).label}
            </span>
          </div>

          {detailLoading ? (
            <div className="space-y-3">
              <div className="h-14 bg-slate-50 rounded-xl animate-pulse" />
            </div>
          ) : license ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div><p className="text-slate-400 font-bold">Clé</p><p className="font-mono text-[#0F172A] font-semibold mt-0.5 break-all">{license.licenseKey}</p></div>
              <div><p className="text-slate-400 font-bold">Émise le</p><p className="text-[#0F172A] font-semibold mt-0.5">{fmtDate(license.issuedAt)}</p></div>
              <div><p className="text-slate-400 font-bold">Expire le</p><p className="text-[#0F172A] font-semibold mt-0.5">{fmtDate(license.expiresAt)}</p></div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Aucune licence émise pour cet établissement.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!license && (
              <>
                <Select value={String(issueMonths)} onValueChange={v => setIssueMonths(Number(v))}>
                  <SelectTrigger className="h-8 text-xs w-32 rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[6, 12, 24, 36].map(m => <SelectItem key={m} value={String(m)}>{m} mois</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={busy} onClick={() => void licenseAction('issue', issueMonths)} className="h-8 text-xs font-bold rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white">
                  Émettre la licence
                </Button>
              </>
            )}
            {license && license.status === 'active' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void licenseAction('extend')} className="h-8 text-xs font-bold rounded-lg border-slate-200">
                Prolonger de 12 mois
              </Button>
            )}
            {license && license.status !== 'cancelled' && (
              confirmRevoke ? (
                <>
                  <Button size="sm" disabled={busy} onClick={() => void licenseAction('revoke')} className="h-8 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white">
                    Confirmer la révocation
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmRevoke(false)} className="h-8 text-xs font-bold rounded-lg border-slate-200">
                    Annuler
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmRevoke(true)} className="h-8 text-xs font-bold rounded-lg border-rose-200 text-rose-600">
                  Révoquer
                </Button>
              )
            )}
          </div>
        </Card>
      </div>

      {/* Addon toggles */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Activation des modules</h3>
          <span className="text-[10px] text-slate-400">{addons.length} module(s)</span>
        </div>
        <p className="text-xs text-slate-400">Un module activé devient immédiatement disponible pour les utilisateurs de l&apos;école.</p>
        {detailLoading ? (
          <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
        ) : addons.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun module enregistré.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {addons.map(a => (
              <div key={a.addonId} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <div className="flex-1 pr-3">
                  <p className="text-xs font-bold text-[#0F172A]">{a.name}</p>
                  <p className="text-[10px] text-slate-400">{a.description}</p>
                </div>
                <Switch
                  checked={a.active}
                  disabled={busy}
                  onCheckedChange={(on) => void toggleAddon(a.addonId, on)}
                  className={a.active ? 'bg-[#0066FF]' : ''}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payment history + pending decisions */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h3 className="text-sm font-extrabold text-[#0F172A]">Historique des paiements</h3>
        {detailLoading ? (
          <div className="h-16 bg-slate-50 rounded-xl animate-pulse" />
        ) : payments.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun paiement enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 font-bold border-b border-slate-100">
                  <th className="py-1.5 pr-3">Date</th>
                  <th className="py-1.5 pr-3">Plan</th>
                  <th className="py-1.5 pr-3">Mois</th>
                  <th className="py-1.5 pr-3">Montant</th>
                  <th className="py-1.5 pr-3">Méthode</th>
                  <th className="py-1.5">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="py-1.5 pr-3 text-slate-500">{fmtDate(p.purchasedAt ?? p.createdAt)}</td>
                    <td className="py-1.5 pr-3 font-bold text-[#0F172A]">{PLAN_LABELS[p.planTier] ?? p.planTier}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{p.requestedMonths ? `${p.requestedMonths} mois` : '—'}</td>
                    <td className="py-1.5 pr-3 font-bold text-[#0F172A]">{fmtAmount(p.amount)}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{METHOD_LABELS[p.method] ?? p.method}</td>
                    <td className="py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'paid' ? 'bg-[#DDF5EC] text-[#17A673]' : p.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>
                        {PAY_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pendingPayments.length > 0 && (
          <div className="space-y-2 pt-1">
            {pendingPayments.map(p => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50/60 border border-amber-200/60 p-2.5">
                <span className="text-xs font-bold text-amber-800 flex-1">
                  Demande de renouvellement — {p.requestedMonths ?? 1} mois ({fmtDate(p.createdAt)})
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Montant MAD"
                  value={pendingAmounts[p.id] ?? ''}
                  onChange={e => setPendingAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                  className="h-8 w-32 text-xs rounded-lg bg-white border-slate-200"
                />
                <Button size="sm" disabled={busy} onClick={() => void decidePayment(p.id, true, pendingAmounts[p.id])} className="h-8 text-xs font-bold rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white">
                  Approuver
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void decidePayment(p.id, false)} className="h-8 text-xs font-bold rounded-lg border-slate-200">
                  Refuser
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
