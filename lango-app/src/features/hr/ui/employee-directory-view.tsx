'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, Loader2, Lock, Plus, Search, UserPlus, UserX, Users, UserRoundCheck,
} from 'lucide-react';
import {
  Avatar, AvatarFallback, AvatarImage,
} from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  EMPLOYMENT_STATUS_STYLES,
  type EmployeeRow, type EmploymentStatus, type EmploymentType,
} from '@/features/hr/model/types';

type ApiErrorShape = { code?: string; message?: string };

async function api<T>(url: string): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export function EmployeeDirectoryView() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';
  const t = useTranslations('HR');
  const tCommon = useTranslations('Common');

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addonDisabled, setAddonDisabled] = useState(false);
  const [search, setSearch] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<string>('all');
  const [loginStatus, setLoginStatus] = useState<string>('all');

  const getStatusLabel = (st: EmploymentStatus) => {
    switch (st) {
      case 'active': return t('statusActive');
      case 'probation': return t('statusProbation');
      case 'on_leave': return t('statusOnLeave');
      case 'offboarded': return t('statusOffboarded');
      case 'archived': return t('statusArchived');
      default: return st;
    }
  };

  const getTypeLabel = (tp: EmploymentType) => {
    switch (tp) {
      case 'permanent': return t('typePermanent');
      case 'fixed_term': return t('typeFixedTerm');
      case 'part_time': return t('typePartTime');
      case 'contractor': return t('typeContractor');
      case 'internship': return t('typeInternship');
      case 'substitute': return t('typeSubstitute');
      default: return tp;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAddonDisabled(false);
    const qs = new URLSearchParams();
    if (search.trim()) qs.set('search', search.trim());
    if (employmentStatus !== 'all') qs.set('employmentStatus', employmentStatus);
    if (loginStatus === 'linked' || loginStatus === 'unlinked') qs.set('loginStatus', loginStatus);
    const res = await api<EmployeeRow[]>(`/api/hr/employees?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else {
      if (res.error?.code === 'ADDON_NOT_ACTIVATED') setAddonDisabled(true);
      setError(res.error?.message ?? t('loadError'));
    }
    setLoading(false);
  }, [search, employmentStatus, loginStatus, t]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  if (addonDisabled) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-[#16212B]">{t('moduleDisabled')}</h1>
        <p className="text-sm text-slate-500">
          {t('moduleDisabledDesc')}
        </p>
      </div>
    );
  }

  const counts = rows.reduce((acc, r) => {
    acc.total += 1;
    if (r.employmentStatus === 'active') acc.active += 1;
    if (r.employmentStatus === 'probation') acc.probation += 1;
    if (r.employmentStatus === 'on_leave') acc.onLeave += 1;
    if (!r.userId) acc.unlinked += 1;
    return acc;
  }, { total: 0, active: 0, probation: 0, onLeave: 0, unlinked: 0 });

  const kpis = [
    { label: t('kpiTotalHeadcount'), value: counts.total, icon: Users },
    { label: t('kpiActive'), value: counts.active, icon: UserRoundCheck },
    { label: t('kpiOnLeave'), value: counts.onLeave, icon: UserX },
    { label: t('kpiUnlinked'), value: counts.unlinked, icon: UserPlus },
  ];

  const allStatuses: EmploymentStatus[] = ['active', 'probation', 'on_leave', 'offboarded', 'archived'];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('directoryTitle')}</h1>
          <p className="text-sm text-slate-500">{t('directorySubtitle')}</p>
        </div>
        <Button onClick={() => router.push(`/${locale}/dashboard/hr/employees/new`)} className="cursor-pointer">
          <Plus className="me-2 h-4 w-4" /> {t('btnNewEmployee')}
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

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="ps-9"
            />
          </div>
          <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t('colStatus')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAllStatuses')}</SelectItem>
              {allStatuses.map(s => (
                <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={loginStatus} onValueChange={setLoginStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t('colAccount')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAllAccounts')}</SelectItem>
              <SelectItem value="linked">{t('filterWithAccount')}</SelectItem>
              <SelectItem value="unlinked">{t('filterWithoutAccount')}</SelectItem>
            </SelectContent>
          </Select>
          {error && (
            <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">{t('noEmployeesFound')}</div>
          ) : (
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-start text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-start font-medium">{t('colEmployee')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('colMatricule')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('colDepartment')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('colDesignation')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('colType')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('colStatus')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('colAccount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => router.push(`/${locale}/dashboard/hr/employees/${row.id}`)}
                  >
                    <td className="px-4 py-3 text-start">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={row.photoUrl ?? undefined} alt={row.displayName} />
                          <AvatarFallback className="bg-[#D1F5E8] text-xs font-semibold text-[#16212B]">{initials(row.displayName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-[#16212B]">{row.displayName}</p>
                          <p className="text-xs text-slate-500">{row.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-start text-slate-600">{row.employeeId || '—'}</td>
                    <td className="px-4 py-3 text-start text-slate-600">{row.departmentName || '—'}</td>
                    <td className="px-4 py-3 text-start text-slate-600">{row.designationTitle || '—'}</td>
                    <td className="px-4 py-3 text-start text-slate-600">{row.employmentType ? getTypeLabel(row.employmentType) : '—'}</td>
                    <td className="px-4 py-3 text-start">
                      <Badge className={EMPLOYMENT_STATUS_STYLES[row.employmentStatus]}>
                        {getStatusLabel(row.employmentStatus)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-start">
                      {row.userId ? (
                        <Badge className="bg-slate-100 text-slate-600">{row.accountRole || t('colAccount')}</Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700">{t('kpiUnlinked')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          {t('clickRowHint', { count: rows.length })}
        </div>
      </Card>
    </div>
  );
}
