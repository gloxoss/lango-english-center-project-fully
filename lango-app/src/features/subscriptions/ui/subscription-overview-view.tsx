'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DataTable, Column } from '@/components/shared/data-table';
import { ShieldCheck, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

type Payment = {
  id: string;
  planTier: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  transactionRef: string | null;
  purchasedAt: string | null;
  expiresAtAtPurchase: string | null;
  requestedMonths: number | null;
  createdAt: string | null;
};

type Addon = {
  addonId: string;
  name: string;
  description: string;
  built: boolean;
  active: boolean;
  expiresAt: string | null;
};

type ApiData = {
  tenant: { id: string; name: string; slug: string; planTier: string; subscriptionStatus: string; isActive: boolean; createdAt: string };
  license: { id: string; licenseKey: string; status: string; issuedAt: string | null; expiresAt: string | null; lastUpgradeAt: string | null; notes: string | null } | null;
  licenseStatus: string;
  payments: Payment[];
  addons: Addon[];
};

const PLAN_LABELS: Record<string, string> = { trial: 'Essai', basic: 'Basique', standard: 'Standard', premium: 'Premium' };
const LIC_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  expiring: { label: 'Expire bientôt', cls: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Expirée', cls: 'bg-rose-50 text-rose-700' },
  suspended: { label: 'Suspendue', cls: 'bg-amber-50 text-amber-700' },
  cancelled: { label: 'Annulée', cls: 'bg-rose-50 text-rose-700' },
  none: { label: 'Aucune licence', cls: 'bg-slate-100 text-slate-600' },
};
const SUB_STATUS_LABELS: Record<string, string> = { active: 'Licence Valide', suspended: 'Licence Suspendue', cancelled: 'Licence Annulée' };
const METHOD_LABELS: Record<string, string> = { cash: 'Espèces', bank_transfer: 'Virement', card: 'Carte' };
const PAY_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Payé', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  rejected: { label: 'Refusé', cls: 'bg-rose-50 text-rose-700' },
};
const RENEWAL_OPTIONS = [3, 6, 12, 18, 24, 36];
const NO_LICENSE_STATUS = { label: 'Aucune licence', cls: 'bg-slate-100 text-slate-600' };

const formatMad = (n: string | number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(Number(n));
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export function SubscriptionOverviewView({ locale }: { locale: string }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewMonths, setRenewMonths] = useState(12);
  const [renewNote, setRenewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/subscription');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Impossible de charger l\'abonnement.');
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitRenewal() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/subscription/renewal-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: renewMonths, note: renewNote.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'La demande a échoué.');
      setSuccess(`Demande de renouvellement (${renewMonths} mois) envoyée. Elle sera traitée par l\'administrateur.`);
      setRenewOpen(false);
      setRenewNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  const activeAddons = data?.addons.filter(a => a.active) ?? [];
  const pendingCount = data?.payments.filter(p => p.status === 'pending').length ?? 0;

  const paymentColumns: Column<Payment>[] = [
    { key: 'plan', header: 'Plan', cell: p => <span className="text-xs font-bold text-[#0F172A]">{PLAN_LABELS[p.planTier] ?? p.planTier}</span> },
    { key: 'date', header: 'Date', cell: p => <span className="text-xs text-slate-500">{fmtDate(p.purchasedAt ?? p.createdAt)}</span> },
    { key: 'expiry', header: 'Expiration', cell: p => <span className="text-xs text-slate-500">{fmtDate(p.expiresAtAtPurchase)}</span> },
    { key: 'ref', header: 'Référence', cell: p => <span className="text-xs font-mono text-slate-500">{p.transactionRef ?? '—'}</span> },
    { key: 'amount', header: 'Montant', cell: p => <span className="text-xs font-bold text-[#0F172A]">{formatMad(p.amount)}</span> },
    { key: 'method', header: 'Méthode', cell: p => <span className="text-xs text-slate-500">{METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      key: 'status', header: 'Statut',
      cell: p => {
        const s = PAY_STATUS_LABELS[p.status] ?? { label: p.status, cls: 'bg-slate-100 text-slate-600' };
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
      },
    },
  ];

  const lic = data?.license;
  const licStatus = LIC_STATUS[data?.licenseStatus ?? 'none'] ?? NO_LICENSE_STATUS;
  const earliestExpiry = data?.addons
    .filter(a => a.active && a.expiresAt)
    .map(a => new Date(a.expiresAt as string).getTime())
    .sort((a, b) => a - b)[0];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Abonnement & Licence</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Détails de votre abonnement, historique des paiements et modules souscrits.</p>
        </div>
        <Button onClick={() => { setError(null); setSuccess(null); setRenewOpen(true); }} className="bg-[#0066FF] hover:bg-[#0052CC] text-white gap-2 text-xs font-bold h-9 rounded-xl">
          <Sparkles className="w-3.5 h-3.5" />
          Demander le renouvellement
        </Button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void load()} className="h-7 text-xs rounded-lg"><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Status band */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-[#0F172A]">
                  {PLAN_LABELS[data?.tenant.planTier ?? ''] ?? 'Offre SchoolOS'}
                </h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${licStatus.cls}`}>{licStatus.label}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lic?.licenseKey ? <span className="font-mono">{lic.licenseKey}</span> : 'Aucune licence émise'} • Établissement: <strong className="text-slate-700">{data?.tenant.name}</strong>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Statut abonnement: <strong className="text-slate-700">{SUB_STATUS_LABELS[data?.tenant.subscriptionStatus ?? ''] ?? '—'}</strong>
                {lic?.expiresAt ? <> • Expire le <strong className="text-slate-700">{fmtDate(lic.expiresAt)}</strong></> : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 text-xs">
            <div>
              <p className="text-slate-400 font-bold">Modules actifs</p>
              <p className="font-extrabold text-[#0F172A] text-sm">{activeAddons.length}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold">Paiements</p>
              <p className="font-extrabold text-[#0F172A] text-sm">{data?.payments.length ?? 0}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold">Demandes en attente</p>
              <p className={`font-extrabold text-sm ${pendingCount > 0 ? 'text-amber-600' : 'text-[#0F172A]'}`}>{pendingCount}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold">Prochaine expiration module</p>
              <p className="font-extrabold text-[#0F172A] text-sm">{earliestExpiry ? new Date(earliestExpiry).toLocaleDateString('fr-FR') : '—'}</p>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="h-24 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
          <div className="h-40 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
        </div>
      ) : data ? (
        <>
          {/* Payment history */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-[#0F172A]">Historique des paiements</h3>
              <p className="text-xs text-slate-400 mt-0.5">Paiements et demandes liés à votre licence.</p>
            </div>
            <DataTable
              data={data.payments}
              columns={paymentColumns}
              isLoading={false}
              emptyTitle="Aucun paiement enregistré"
              emptyDescription="Vos paiements et demandes de renouvellement apparaîtront ici."
              defaultPageSize={10}
            />
          </div>

          {/* Addons summary */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">Modules & Extensions</h3>
                <p className="text-xs text-slate-400 mt-0.5">Vos modules actifs. L&apos;activation d&apos;un module relève de l&apos;administrateur de la plateforme.</p>
              </div>
              <Link href={`/${locale}/dashboard/settings/entitlements`}>
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold rounded-xl border-slate-200">
                  Gérer les modules
                </Button>
              </Link>
            </div>
            {activeAddons.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeAddons.map(a => (
                  <span key={a.addonId} className="px-3 py-1.5 rounded-xl bg-[#DCEBF4] text-[#1B6C93] text-xs font-bold">{a.name}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Aucun module activé pour le moment. Les modules optionnels sont activés par l&apos;administrateur.</p>
            )}
          </div>
        </>
      ) : null}

      {/* Renewal dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Demander le renouvellement</DialogTitle>
            <DialogDescription>
              Votre demande est transmise à l&apos;administrateur de la plateforme, qui la validera et prolongera votre licence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Durée de la prolongation</label>
              <Select value={String(renewMonths)} onValueChange={v => setRenewMonths(Number(v))}>
                <SelectTrigger className="text-xs w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RENEWAL_OPTIONS.map(m => (
                    <SelectItem key={m} value={String(m)}>{m} mois</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Note (facultatif)</label>
              <Input
                value={renewNote}
                onChange={e => setRenewNote(e.target.value)}
                placeholder="Précisez le contexte de votre demande..."
                className="h-9 text-xs rounded-xl bg-slate-50 border-none"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)} disabled={submitting} className="h-9 text-xs font-bold rounded-xl border-slate-200">
              Annuler
            </Button>
            <Button onClick={submitRenewal} disabled={submitting} className="h-9 text-xs font-bold rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white">
              {submitting ? 'Envoi...' : 'Envoyer la demande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
