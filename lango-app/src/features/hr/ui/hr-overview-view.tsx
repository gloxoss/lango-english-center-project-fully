'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, CalendarCheck2, Download, FileClock, Loader2, Lock,
  UserMinus, UserPlus, Users, UsersRound,
} from 'lucide-react';

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
  const t = useTranslations('HR');
  const tCommon = useTranslations('Common');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';
  const numLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR';

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addonDisabled, setAddonDisabled] = useState(false);

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'active': return t('statusActive');
      case 'probation': return t('statusProbation');
      case 'on_leave': return t('statusOnLeave');
      case 'offboarded': return t('statusOffboarded');
      case 'archived': return t('statusArchived');
      default: return st;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAddonDisabled(false);
    const res = await api<OverviewData>('/api/hr/overview');
    if (res.ok && res.data) setData(res.data);
    else {
      if (res.error?.code === 'ADDON_NOT_ACTIVATED') setAddonDisabled(true);
      setError(res.error?.message ?? t('loadError'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  if (addonDisabled) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-[#16212B]">{t('moduleDisabled')}</h1>
        <p className="text-sm text-slate-500">{t('moduleDisabledDesc')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400">
        <Loader2 className="me-2 h-5 w-5 animate-spin" /> {tCommon('loading')}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-[#16212B]">{t('loadError')}</h1>
        <p className="text-sm text-slate-500">{error}</p>
        <Button variant="outline" onClick={() => load().catch(() => {})} className="cursor-pointer">{tCommon('retry')}</Button>
      </div>
    );
  }

  const hc = data.headcount;
  const kpis = [
    { label: t('kpiTotalHeadcount'), value: hc.total ?? 0, icon: Users },
    { label: t('kpiActive'), value: hc.active ?? 0, icon: UsersRound },
    { label: t('kpiOnLeave'), value: hc.on_leave ?? 0, icon: UserMinus },
    { label: t('kpiProbation'), value: hc.probation ?? 0, icon: UserPlus },
    { label: t('kpiHiresMonth'), value: data.hiresThisMonth, icon: CalendarCheck2 },
    { label: t('kpiDeparturesMonth'), value: data.departuresThisMonth, icon: UserMinus },
    { label: t('kpiUnlinked'), value: data.unlinkedAccounts, icon: UserPlus },
  ];

  const statusBreakdown = Object.entries(hc).filter(([k]) => k !== 'total');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Button onClick={() => { window.location.href = '/api/hr/export'; }} className="cursor-pointer">
          <Download className="me-2 h-4 w-4" /> {t('exportCsv')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]">
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
          <h2 className="mb-3 text-sm font-semibold text-[#16212B]">{t('statusBreakdown')}</h2>
          <div className="space-y-2">
            {statusBreakdown.map(([status, value]) => (
              <div key={status} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">{getStatusLabel(status)}</span>
                <Badge variant="neutral">{value}</Badge>
              </div>
            ))}
          </div>
          {data.salaryTotal !== undefined && (
            <div className="mt-4 rounded-xl border border-[#D1F5E8] bg-[#D1F5E8]/40 px-3 py-2">
              <p className="text-xs text-slate-500">{t('payrollMass')}</p>
              <p className="text-lg font-bold text-[#16212B]">{Number(data.salaryTotal).toLocaleString(numLocale, { style: 'currency', currency: 'MAD' })}</p>
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-[#16212B]">{t('expiringDocsTitle')}</h2>
          {data.expiringDocuments.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{t('noExpiringDocs')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-start text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pe-3 text-start font-medium">{t('colEmployee')}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t('colDocType')}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t('colFile')}</th>
                    <th className="py-2 text-start font-medium">{t('colExpiresOn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiringDocuments.map(doc => (
                    <tr key={`${doc.employeeId}-${doc.originalName}`} className="border-b border-slate-50">
                      <td className="py-2 pe-3 text-start font-medium text-[#16212B]">{doc.employeeName ?? '—'}</td>
                      <td className="py-2 pe-3 text-start text-slate-600">{doc.documentType}</td>
                      <td className="py-2 pe-3 text-start text-slate-500">
                        <span className="flex items-center gap-1">
                          <FileClock className="h-3.5 w-3.5 text-amber-500 shrink-0" /> {doc.originalName ?? '—'}
                        </span>
                      </td>
                      <td className="py-2 text-start">
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
