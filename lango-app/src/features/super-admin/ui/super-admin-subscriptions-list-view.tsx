'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { DataTable, Column } from '@/components/shared/data-table';
import { AlertCircle, Search, RefreshCw, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';

type SchoolRow = {
  id: string; name: string; slug: string; planTier: string; subscriptionStatus: string;
  isActive: boolean;
  license: { id: string; licenseKey: string; status: string; issuedAt: string | null; expiresAt: string | null; lastUpgradeAt: string | null } | null;
  licenseStatus: string;
  pendingPaymentsCount: number;
};
type Summary = { total: number; active: number; expiring: number; expired: number; suspended: number; cancelled: number; none: number; pendingPayments: number };
type ListData = { schools: SchoolRow[]; summary: Summary };

type DetailAddon = { addonId: string; name: string; description: string; built: boolean; active: boolean; expiresAt: string | null };
type DetailPayment = { id: string; planTier: string; amount: string; method: string; status: string; transactionRef: string | null; purchasedAt: string | null; expiresAtAtPurchase: string | null; requestedMonths: number | null; createdAt: string | null };
type DetailData = {
  tenant: { id: string; name: string; slug: string; planTier: string; subscriptionStatus: string };
  license: { id: string; licenseKey: string; status: string; issuedAt: string | null; expiresAt: string | null; lastUpgradeAt: string | null; notes: string | null } | null;
  licenseStatus: string;
  payments: DetailPayment[];
  addons: DetailAddon[];
};

export function SuperAdminSubscriptionsListView({ locale: propLocale }: { locale?: string }) {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');
  const hookLocale = useLocale();
  const locale = propLocale || hookLocale || 'fr';

  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, string>>({});

  // Per-school detail dialog
  const [detailSchoolId, setDetailSchoolId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issueMonths, setIssueMonths] = useState(12);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const planLabels: Record<string, string> = {
    trial: locale === 'ar' ? 'تجريبي' : locale === 'en' ? 'Trial' : 'Essai',
    basic: locale === 'ar' ? 'أساسي' : locale === 'en' ? 'Basic' : 'Basique',
    standard: locale === 'ar' ? 'قياسي' : 'Standard',
    premium: locale === 'ar' ? 'مميز' : 'Premium',
  };

  const licStatus: Record<string, { label: string; cls: string }> = {
    active: { label: t('tabActiveLicenses'), cls: 'bg-[#DDF5EC] text-[#17A673]' },
    expiring: { label: t('tabExpiringLicenses'), cls: 'bg-amber-50 text-amber-700' },
    expired: { label: t('tabExpiredLicenses'), cls: 'bg-rose-50 text-rose-700' },
    suspended: { label: t('tabSuspendedLicenses'), cls: 'bg-amber-50 text-amber-700' },
    cancelled: { label: t('tabCancelledLicenses'), cls: 'bg-rose-50 text-rose-700' },
    none: { label: t('tabNoLicenses'), cls: 'bg-slate-100 text-slate-600' },
  };

  const noLicenseStatus = { label: t('tabNoLicenses'), cls: 'bg-slate-100 text-slate-600' };

  const payStatusLabels: Record<string, string> = {
    pending: locale === 'ar' ? 'قيد الانتظار' : locale === 'en' ? 'Pending' : 'En attente',
    paid: locale === 'ar' ? 'مدفوع' : locale === 'en' ? 'Paid' : 'Payé',
    rejected: locale === 'ar' ? 'مرفوض' : locale === 'en' ? 'Rejected' : 'Refusé',
  };

  const methodLabels: Record<string, string> = {
    cash: t('paymentMethodCash'),
    bank_transfer: t('paymentMethodBank'),
    card: t('paymentMethodCard'),
  };

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR') : '—';

  const fmtAmount = (n: string | number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR', {
      style: 'currency',
      currency: 'MAD',
      maximumFractionDigits: 2,
    }).format(Number(n));

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/subscriptions');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || tCommon('error'));
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  useEffect(() => { void loadList(); }, [loadList]);

  const loadDetail = useCallback(async (schoolId: string) => {
    setDetailLoading(true);
    setDetail(null);
    setConfirmRevoke(false);
    try {
      const res = await fetch(`/api/super-admin/subscriptions/${schoolId}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || tCommon('error'));
      setDetail(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setDetailLoading(false);
    }
  }, [tCommon]);

  function openDetail(schoolId: string) {
    setDetailSchoolId(schoolId);
    void loadDetail(schoolId);
  }

  const flash = (msg: string) => {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 4000);
  };

  async function updateSchool(schoolId: string, patch: { planTier?: string; subscriptionStatus?: string; isActive?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: schoolId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || tCommon('error'));
      flash(tCommon('success'));
      await loadDetail(schoolId);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setBusy(false);
    }
  }

  async function licenseAction(action: 'issue' | 'extend' | 'revoke', schoolId: string, months?: number) {
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
      if (!res.ok || !json.success) throw new Error(json.message || tCommon('error'));
      flash(tCommon('success'));
      await loadDetail(schoolId);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAddon(schoolId: string, addonId: string, enable: boolean) {
    setBusy(true);
    setError(null);
    try {
      const url = '/api/super-admin/entitlements';
      const res = enable
        ? await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: schoolId, addonId, isEnabled: true }) })
        : await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: schoolId, addonId }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || tCommon('error'));
      flash(tCommon('success'));
      await loadDetail(schoolId);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setBusy(false);
    }
  }

  async function decidePayment(schoolId: string, paymentId: string, approved: boolean, amount?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/subscriptions/${schoolId}/payments/${paymentId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, amount: approved ? Number(amount ?? 0) : undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || tCommon('error'));
      flash(tCommon('success'));
      await loadList();
      if (detailSchoolId === schoolId) await loadDetail(schoolId);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setBusy(false);
    }
  }

  const schools = data?.schools ?? [];
  const filtered = schools.filter(s => {
    const matchSearch = (s.name ?? '').toLowerCase().includes(search.trim().toLowerCase());
    const matchStatus = statusFilter === 'all' || s.licenseStatus === statusFilter;
    return matchSearch && matchStatus;
  });
  const summary = data?.summary;
  const pendingRequests = schools
    .filter(s => s.pendingPaymentsCount > 0)
    .map(s => ({ school: s, count: s.pendingPaymentsCount }));

  const statusFilters = [
    { id: 'all', label: t('tabAll') },
    { id: 'active', label: t('tabActiveLicenses') },
    { id: 'expiring', label: t('tabExpiringLicenses') },
    { id: 'expired', label: t('tabExpiredLicenses') },
    { id: 'suspended', label: t('tabSuspendedLicenses') },
    { id: 'cancelled', label: t('tabCancelledLicenses') },
    { id: 'none', label: t('tabNoLicenses') },
  ];

  const columns: Column<SchoolRow>[] = [
    {
      key: 'school', header: t('schoolCol'),
      cell: s => (
        <button onClick={() => openDetail(s.id)} className="text-left rtl:text-right group">
          <p className="text-xs font-bold text-[#0F172A] group-hover:text-[#0066FF]">{s.name}</p>
          <p className="text-[10px] text-slate-400 font-mono">{s.slug}</p>
        </button>
      ),
    },
    { key: 'plan', header: t('planCol'), cell: s => <span className="text-xs font-bold text-[#0F172A]">{planLabels[s.planTier] ?? s.planTier}</span> },
    {
      key: 'status', header: t('licenseStatusCol'),
      cell: s => {
        const st = licStatus[s.licenseStatus] ?? noLicenseStatus;
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.label}</span>;
      },
    },
    { key: 'expiry', header: t('expirationCol'), cell: s => <span className="text-xs text-slate-500">{fmtDate(s.license?.expiresAt)}</span> },
    { key: 'key', header: t('licenseKeyCol'), cell: s => <span className="text-[10px] font-mono text-slate-400">{s.license?.licenseKey ?? '—'}</span> },
    {
      key: 'pending', header: t('pendingRequestsCol'),
      cell: s => s.pendingPaymentsCount > 0
        ? <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">{s.pendingPaymentsCount}</span>
        : <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: 'actions', header: tCommon('actions'),
      cell: s => (
        <Button size="sm" variant="outline" onClick={() => openDetail(s.id)} className="h-7 text-[11px] font-bold rounded-lg border-slate-200 gap-1">
          <KeyRound className="w-3 h-3 text-[#0066FF]" /> {t('actionManage')}
        </Button>
      ),
    },
  ];

  const kpis = [
    { label: t('totalSchoolsStat'), value: summary?.total ?? 0, cls: 'text-[#0F172A]' },
    { label: t('activeLicensesStat'), value: (summary?.active ?? 0) + (summary?.expiring ?? 0), cls: 'text-emerald-600' },
    { label: t('expiringSoonStat'), value: summary?.expiring ?? 0, cls: 'text-amber-600' },
    { label: t('expiredOrNoneStat'), value: (summary?.expired ?? 0) + (summary?.none ?? 0), cls: 'text-rose-600' },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{t('subscriptionsManagementTitle')}</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">{t('subscriptionsManagementSubtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => { void loadList(); }} className="h-7 text-xs rounded-lg"><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
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

      {/* Pending renewal requests */}
      {pendingRequests.length > 0 && (
        <Card className="p-4 bg-white rounded-2xl border border-amber-200/80 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-extrabold text-[#0F172A]">{t('pendingRenewalsTitle')}</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{summary?.pendingPayments ?? 0}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingRequests.map(({ school }) => (
              <div key={school.id} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2">
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">{school.name}</p>
                  <p className="text-[10px] text-slate-400">{school.pendingPaymentsCount} • {fmtDate(school.license?.expiresAt)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openDetail(school.id)} className="h-7 text-[11px] font-bold rounded-lg border-slate-200">
                  {t('actionProcess')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Schools table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('searchSchool')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rtl:pl-3 rtl:pr-9 h-9 text-xs bg-slate-50 border-none rounded-xl"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${statusFilter === f.id ? 'bg-[#0066FF] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          isLoading={loading}
          emptyTitle={t('emptySchoolsTitle')}
          emptyDescription={t('emptySchoolsDesc')}
          defaultPageSize={10}
        />
      </div>

      {/* Per-school detail dialog */}
      <Dialog open={detailSchoolId !== null} onOpenChange={(open) => { if (!open) setDetailSchoolId(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0066FF]" />
              {detail?.tenant.name ?? t('schoolCol')}
            </DialogTitle>
            <DialogDescription>
              {detail ? `${detail.tenant.slug} • ${planLabels[detail.tenant.planTier] ?? detail.tenant.planTier} • ${detail.license?.licenseKey ?? t('noLicense')}` : ''}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3">
              <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
              <div className="h-40 bg-slate-50 rounded-xl animate-pulse" />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              {/* License management */}
              <div className="rounded-2xl border border-slate-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-[#0F172A]">{t('licenseHeading')}</h4>
                  {detail.license && (() => {
                    const st = licStatus[detail.licenseStatus] ?? noLicenseStatus;
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-400 font-bold shrink-0">{t('licenseType')}</p>
                  <Select value={detail.tenant.planTier} onValueChange={v => void updateSchool(detail.tenant.id, { planTier: v })} disabled={busy}>
                    <SelectTrigger className="h-8 text-xs w-40 rounded-lg border-slate-200">
                      <SelectValue placeholder={planLabels[detail.tenant.planTier]}>{planLabels[detail.tenant.planTier]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">{planLabels.trial}</SelectItem>
                      <SelectItem value="basic">{planLabels.basic}</SelectItem>
                      <SelectItem value="standard">{planLabels.standard}</SelectItem>
                      <SelectItem value="premium">{planLabels.premium}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {detail.license ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div><p className="text-slate-400 font-bold">{t('licenseKeyCol')}</p><p className="font-mono text-[#0F172A] font-semibold mt-0.5 break-all">{detail.license.licenseKey}</p></div>
                    <div><p className="text-slate-400 font-bold">{t('issuedOn')}</p><p className="text-[#0F172A] font-semibold mt-0.5">{fmtDate(detail.license.issuedAt)}</p></div>
                    <div><p className="text-slate-400 font-bold">{t('expiresOn')}</p><p className="text-[#0F172A] font-semibold mt-0.5">{fmtDate(detail.license.expiresAt)}</p></div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{t('noLicenseIssuedNotice')}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {!detail.license && (
                    <>
                      <Select value={String(issueMonths)} onValueChange={v => setIssueMonths(Number(v))}>
                        <SelectTrigger className="h-8 text-xs w-32 rounded-lg border-slate-200">
                          <SelectValue placeholder={t('monthsCount', { count: issueMonths })}>{t('monthsCount', { count: issueMonths })}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {[6, 12, 24, 36].map(m => <SelectItem key={m} value={String(m)}>{t('monthsCount', { count: m })}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={busy} onClick={() => void licenseAction('issue', detail.tenant.id, issueMonths)} className="h-8 text-xs font-bold rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white">
                        {t('issueLicenseBtn')}
                      </Button>
                    </>
                  )}
                  {detail.license && detail.license.status === 'active' && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void licenseAction('extend', detail.tenant.id, 12)} className="h-8 text-xs font-bold rounded-lg border-slate-200">
                      {t('extend12MonthsBtn')}
                    </Button>
                  )}
                  {detail.license && detail.license.status === 'cancelled' && (
                    <Button size="sm" disabled={busy} onClick={() => void licenseAction('extend', detail.tenant.id, 12)} className="h-8 text-xs font-bold rounded-lg bg-[#17A673] hover:bg-[#128a5f] text-white">
                      {t('reactivateLicenseBtn')}
                    </Button>
                  )}
                  {detail.license && detail.license.status !== 'cancelled' && (
                    confirmRevoke ? (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => { void licenseAction('revoke', detail.tenant.id); setConfirmRevoke(false); }} className="h-8 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white">
                          {t('confirmRevokeBtn')}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmRevoke(false)} className="h-8 text-xs font-bold rounded-lg border-slate-200">
                          {tCommon('cancel')}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmRevoke(true)} className="h-8 text-xs font-bold rounded-lg border-rose-200 text-rose-600">
                        {t('revokeLicenseBtn')}
                      </Button>
                    )
                  )}
                </div>
              </div>

              {/* Addon toggles */}
              <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2">
                <h4 className="text-sm font-extrabold text-[#0F172A]">{t('modulesActivationTitle')}</h4>
                <p className="text-xs text-slate-400">{t('modulesActivationSubtitle')}</p>
                <div className="space-y-1.5">
                  {detail.addons.map(a => (
                    <div key={a.addonId} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <div className="flex-1 pr-3 rtl:pr-0 rtl:pl-3">
                        <p className="text-xs font-bold text-[#0F172A]">{a.name}</p>
                        <p className="text-[10px] text-slate-400">{a.description}</p>
                      </div>
                      <Switch
                        checked={a.active}
                        disabled={busy}
                        onCheckedChange={(on) => void toggleAddon(detail.tenant.id, a.addonId, on)}
                        className={a.active ? 'bg-[#0066FF]' : ''}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment history */}
              <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2">
                <h4 className="text-sm font-extrabold text-[#0F172A]">{t('paymentHistoryTitle')}</h4>
                {detail.payments.length === 0 ? (
                  <p className="text-xs text-slate-500">{t('noPaymentsRecorded')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left rtl:text-right text-slate-400 font-bold border-b border-slate-100">
                          <th className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3">{tCommon('date')}</th>
                          <th className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3">{t('planCol')}</th>
                          <th className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3">{locale === 'ar' ? 'الأشهر' : 'Mois'}</th>
                          <th className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3">{locale === 'ar' ? 'المبلغ' : 'Montant'}</th>
                          <th className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3">{locale === 'ar' ? 'الطريقة' : 'Méthode'}</th>
                          <th className="py-1.5">{tCommon('status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {detail.payments.map(p => (
                          <tr key={p.id}>
                            <td className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3 text-slate-500">{fmtDate(p.purchasedAt ?? p.createdAt)}</td>
                            <td className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3 font-bold text-[#0F172A]">{planLabels[p.planTier] ?? p.planTier}</td>
                            <td className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3 text-slate-500">{p.requestedMonths ? t('monthsCount', { count: p.requestedMonths }) : '—'}</td>
                            <td className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3 font-bold text-[#0F172A]">{fmtAmount(p.amount)}</td>
                            <td className="py-1.5 pr-3 rtl:pr-0 rtl:pl-3 text-slate-500">{methodLabels[p.method] ?? p.method}</td>
                            <td className="py-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'paid' ? 'bg-[#DDF5EC] text-[#17A673]' : p.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>
                                {payStatusLabels[p.status] ?? p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {detail.payments.filter(p => p.status === 'pending').length > 0 && (
                  <div className="space-y-2 pt-1">
                    {detail.payments.filter(p => p.status === 'pending').map(p => (
                      <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50/60 border border-amber-200/60 p-2.5">
                        <span className="text-xs font-bold text-amber-800 flex-1">
                          {t('renewalRequestLabel', { months: p.requestedMonths ?? 1, date: fmtDate(p.createdAt) })}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={t('amountMadPlaceholder')}
                          value={pendingAmounts[p.id] ?? ''}
                          onChange={e => setPendingAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className="h-8 w-32 text-xs rounded-lg bg-white border-slate-200"
                        />
                        <Button size="sm" disabled={busy} onClick={() => void decidePayment(detail.tenant.id, p.id, true, pendingAmounts[p.id])} className="h-8 text-xs font-bold rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white">
                          {t('approveBtn')}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void decidePayment(detail.tenant.id, p.id, false)} className="h-8 text-xs font-bold rounded-lg border-slate-200">
                          {t('rejectBtn')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">{tCommon('error')}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
