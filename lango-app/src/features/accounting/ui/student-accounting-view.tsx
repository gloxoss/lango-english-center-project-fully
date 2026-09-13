'use client';

import { AlertCircle, CheckCircle2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Mapping = {
  id: string;
  sourceModule: string;
  sourceKeyType: string;
  sourceKey: string | null;
  accountId: string;
  accountCode?: string;
  accountName?: string;
};

type AdapterException = {
  id: string;
  sourceModule: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  version: number;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  resolutionNote: string | null;
};

type ReconRow = {
  sourceModule: string;
  documentType: string;
  documentId: string;
  number: string;
  amount: string;
  state: 'posted' | 'blocked' | 'pending';
  entryNumber: string | null;
  reason: string | null;
};

type Recon = {
  rows: ReconRow[];
  summary: { sourceTotal: string; postedTotal: string; blockedTotal: string; pendingTotal: string; drift: string };
  counts: { posted: number; blocked: number; pending: number };
};

type Account = { id: string; code: string; name: string; accountType: string; isActive: boolean };

export function StudentAccountingView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');
  const activeLocale = useLocale();

  const [tab, setTab] = useState<'mappings' | 'exceptions' | 'reconciliation'>('mappings');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [exceptions, setExceptions] = useState<AdapterException[]>([]);
  const [recon, setRecon] = useState<Recon | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    sourceModule: 'student_invoice',
    sourceKeyType: 'fee_category',
    sourceKey: '',
    accountId: '',
  });

  const getKeyTypeLabel = (kt: string) => {
    switch (kt) {
      case 'fee_category':
        return t('keyTypeFeeCategory');
      case 'payment_method':
        return t('keyTypePaymentMethod');
      case 'student':
        return t('keyTypeStudent');
      default:
        return kt;
    }
  };

  const getModuleLabel = (mod: string) => {
    switch (mod) {
      case 'student_invoice':
        return t('moduleStudentInvoice');
      case 'student_payment':
        return t('moduleStudentPayment');
      default:
        return mod;
    }
  };

  const getStateLabel = (st: string) => {
    switch (st) {
      case 'posted':
        return t('statePosted');
      case 'blocked':
        return t('stateBlocked');
      case 'pending':
        return t('statePending');
      default:
        return st;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, e, r, a] = await Promise.all([
        fetch('/api/finance/accounting/student-accounting/mappings').then(r2 => r2.json()),
        fetch('/api/finance/accounting/student-accounting/exceptions').then(r2 => r2.json()),
        fetch('/api/finance/accounting/student-accounting/reconcile').then(r2 => r2.json()),
        fetch('/api/finance/accounting/accounts?pageSize=100').then(r2 => r2.json()),
      ]);
      if (!m.success) throw new Error(m.error?.message ?? t('loadingFailed'));
      if (!e.success) throw new Error(e.error?.message ?? t('loadingFailed'));
      if (!r.success) throw new Error(r.error?.message ?? t('loadingFailed'));
      setMappings(m.data);
      setExceptions(e.data);
      setRecon(r.data);
      setAccounts(a.success ? a.data : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('loadingFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const api = async (url: string, init: RequestInit): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await fetch(url, init);
      const json = await res.json();
      if (!res.ok) return { ok: false, message: json.error?.message ?? t('actionFailed') };
      return { ok: true };
    } catch (cause) {
      return { ok: false, message: cause instanceof Error ? cause.message : t('actionFailed') };
    }
  };

  const createMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    const outcome = await api('/api/finance/accounting/student-accounting/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceModule: form.sourceModule,
        sourceKeyType: form.sourceKeyType,
        sourceKey: form.sourceKey.trim() || null,
        accountId: form.accountId,
      }),
    });
    if (outcome.ok) {
      setNotice(tCommon('success'));
      setShowCreate(false);
      setForm(f => ({ ...f, sourceKey: '', accountId: '' }));
      load();
    } else {
      setError(outcome.message ?? t('actionFailed'));
    }
  };

  const deleteMapping = async (id: string) => {
    const outcome = await api(`/api/finance/accounting/student-accounting/mappings/${id}`, { method: 'DELETE' });
    if (outcome.ok) {
      setNotice(tCommon('success'));
      load();
    } else {
      setError(outcome.message ?? t('actionFailed'));
    }
  };

  const setExceptionStatus = async (id: string, action: 'resolve' | 'dismiss') => {
    const outcome = await api(`/api/finance/accounting/student-accounting/exceptions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (outcome.ok) {
      setNotice(tCommon('success'));
      load();
    } else {
      setError(outcome.message ?? t('actionFailed'));
    }
  };

  const accountFor = (mapping: Mapping) => accounts.find(a => a.id === mapping.accountId);

  const fmtDate = (d: string) => {
    try {
      const dateLocale = activeLocale === 'ar' ? 'ar-MA' : activeLocale === 'en' ? 'en-US' : 'fr-FR';
      return new Date(d).toLocaleDateString(dateLocale);
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('studentAccountingTitle')}</h1>
          <p className="text-sm text-slate-500">{t('studentAccountingSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {tCommon('refresh')}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold">
        {(['mappings', 'exceptions', 'reconciliation'] as const).map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 transition-colors ${
              tab === key ? 'bg-[#2487B8] text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {key === 'mappings'
              ? t('tabAccountMappings')
              : key === 'exceptions'
                ? `${t('tabAdapterExceptions')} (${exceptions.filter(x => x.status === 'open').length})`
                : t('tabReconciliation')}
          </button>
        ))}
      </div>

      {tab === 'mappings' && (
        <Card className="p-0 overflow-hidden rounded-2xl border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 text-start">
            <h3 className="font-bold text-slate-900">{t('tabAccountMappings')}</h3>
            <Button
              onClick={() => setShowCreate(v => !v)}
              className="bg-[#2487B8] text-white hover:bg-[#1B6C93] text-xs h-8"
            >
              {showCreate ? tCommon('close') : tCommon('add')}
            </Button>
          </div>
          {showCreate && (
            <form onSubmit={createMapping} className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-5 text-start">
              <select
                value={form.sourceModule}
                onChange={e => setForm(f => ({ ...f, sourceModule: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-xs bg-white"
              >
                <option value="student_invoice">{t('moduleStudentInvoice')}</option>
                <option value="student_payment">{t('moduleStudentPayment')}</option>
              </select>
              <select
                value={form.sourceKeyType}
                onChange={e => setForm(f => ({ ...f, sourceKeyType: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-xs bg-white"
              >
                <option value="fee_category">{t('keyTypeFeeCategory')}</option>
                <option value="payment_method">{t('keyTypePaymentMethod')}</option>
                <option value="student">{t('keyTypeStudent')}</option>
              </select>
              <Input
                placeholder={t('searchPlaceholder')}
                value={form.sourceKey}
                onChange={e => setForm(f => ({ ...f, sourceKey: e.target.value }))}
                className="text-xs h-9"
              />
              <select
                value={form.accountId}
                onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-xs bg-white"
              >
                <option value="">— {t('accountCol')} —</option>
                {accounts
                  .filter(a => a.isActive)
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
              </select>
              <Button type="submit" disabled={!form.accountId || loading} className="bg-[#2487B8] text-white h-9 text-xs">
                {tCommon('save')}
              </Button>
            </form>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t('colSourceModule')}</th>
                  <th className="px-4 py-3 text-start">{t('keyTypeFeeCategory')}</th>
                  <th className="px-4 py-3 text-start">{t('referenceLabel')}</th>
                  <th className="px-4 py-3 text-start">{t('accountCol')}</th>
                  <th className="px-4 py-3 text-end" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {mappings.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">{getModuleLabel(m.sourceModule)}</td>
                    <td className="px-4 py-3">{getKeyTypeLabel(m.sourceKeyType)}</td>
                    <td className="px-4 py-3">
                      {m.sourceKey ?? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          {tCommon('default') || 'Default'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {accountFor(m)?.code} · {accountFor(m)?.name}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button
                        onClick={() => deleteMapping(m.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title={tCommon('delete')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {mappings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      {tCommon('empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'exceptions' && (
        <Card className="p-0 overflow-hidden rounded-2xl border-slate-200/80">
          <div className="border-b border-slate-200 p-4 text-start">
            <h3 className="font-bold text-slate-900">{t('tabAdapterExceptions')}</h3>
            <p className="text-xs text-slate-500">{t('studentAccountingSubtitle')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-start">{tCommon('status')}</th>
                  <th className="px-4 py-3 text-start">{t('colSourceModule')}</th>
                  <th className="px-4 py-3 text-start">{tCommon('reason')}</th>
                  <th className="px-4 py-3 text-start">{tCommon('details')}</th>
                  <th className="px-4 py-3 text-start">{tCommon('createdAt')}</th>
                  <th className="px-4 py-3 text-end" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {exceptions.map(x => (
                  <tr key={x.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                          x.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {x.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getModuleLabel(x.sourceModule)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{x.reason}</td>
                    <td className="px-4 py-3 text-slate-500">{x.detail ?? '—'}</td>
                    <td className="px-4 py-3">{fmtDate(x.createdAt)}</td>
                    <td className="px-4 py-3 text-end">
                      {x.status === 'open' && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => setExceptionStatus(x.id, 'resolve')}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs h-7"
                          >
                            {tCommon('resolve') || 'Resolve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExceptionStatus(x.id, 'dismiss')}
                            className="text-slate-600 text-xs h-7"
                          >
                            {tCommon('dismiss') || 'Dismiss'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {exceptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      {tCommon('empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-5 text-start">
            {[
              ['Source', recon?.summary.sourceTotal, 'text-slate-900'],
              [t('statePosted'), recon?.summary.postedTotal, 'text-emerald-600'],
              [t('stateBlocked'), recon?.summary.blockedTotal, 'text-red-600'],
              [t('statePending'), recon?.summary.pendingTotal, 'text-amber-600'],
              [t('driftAmountLabel'), recon?.summary.drift, 'text-slate-500'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
                <div className={`mt-1 text-lg font-extrabold ${color}`}>{loading ? '...' : value}</div>
              </div>
            ))}
          </div>
          <Card className="p-0 overflow-hidden rounded-2xl border-slate-200/80">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-start">{tCommon('status')}</th>
                    <th className="px-4 py-3 text-start">{t('referenceLabel')}</th>
                    <th className="px-4 py-3 text-start">{t('voucherTypeLabel')}</th>
                    <th className="px-4 py-3 text-start">{tCommon('amount')}</th>
                    <th className="px-4 py-3 text-start">{t('colEntryNumber')}</th>
                    <th className="px-4 py-3 text-start">{tCommon('reason')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {recon?.rows.map(r => (
                    <tr key={`${r.sourceModule}:${r.documentId}`} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                            r.state === 'posted'
                              ? 'bg-emerald-100 text-emerald-700'
                              : r.state === 'blocked'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {r.state === 'blocked' && <XCircle className="size-3" />}
                          {getStateLabel(r.state)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{r.number}</td>
                      <td className="px-4 py-3">
                        {r.documentType === 'invoice' ? t('moduleStudentInvoice') : t('moduleStudentPayment')}
                      </td>
                      <td className="px-4 py-3 font-bold">{r.amount} MAD</td>
                      <td className="px-4 py-3 text-slate-500">{r.entryNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-red-600">{r.reason ?? '—'}</td>
                    </tr>
                  ))}
                  {recon?.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        {tCommon('empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
