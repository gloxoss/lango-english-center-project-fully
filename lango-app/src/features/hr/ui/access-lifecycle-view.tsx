'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle, KeyRound, Loader2, LogIn, RotateCcw, UserRoundX,
} from 'lucide-react';
import {
  EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_STYLES,
  type EmployeeRow, type EmploymentStatus,
} from '@/features/hr/model/types';

type ApiErrorShape = { code?: string; message?: string };

type CandidateRow = { id: string; name: string; email: string; role: string };
type AccessData = { employees: EmployeeRow[]; candidates: CandidateRow[] };

type Filter = 'all' | 'linked' | 'unlinked' | 'offboarded';

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

type Action = 'link' | 'offboard' | 'reactivate' | null;

export function AccessLifecycleView() {
  const t = useTranslations('HR');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const [action, setAction] = useState<Action>(null);
  const [target, setTarget] = useState<EmployeeRow | null>(null);
  const [candidateId, setCandidateId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const getRoleLabel = useCallback((role: string) => {
    switch (role) {
      case 'super_admin': return t('roleSuperAdmin');
      case 'school_admin': return t('roleSchoolAdmin');
      case 'teacher': return t('roleTeacher');
      case 'accountant': return t('roleAccountant');
      case 'student': return t('roleStudent');
      case 'alumni': return t('roleAlumni');
      case 'parent': return t('roleParent');
      case 'receptionist': return t('roleReceptionist');
      case 'guard': return t('roleGuard');
      default: return role;
    }
  }, [t]);

  const getStatusLabel = useCallback((status: string) => {
    switch (status) {
      case 'active': return t('statusActive');
      case 'probation': return t('statusProbation');
      case 'on_leave': return t('statusOnLeave');
      case 'offboarded': return t('statusOffboarded');
      case 'archived': return t('statusArchived');
      default: return EMPLOYMENT_STATUS_LABELS[status as EmploymentStatus] ?? status;
    }
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<AccessData>('/api/hr/access');
    if (res.ok && res.data) setData(res.data);
    else setError(res.error?.message ?? t('accessErrorLoad'));
    setLoading(false);
  }, [t]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const openAction = (a: Action, row: EmployeeRow) => {
    setAction(a);
    setTarget(row);
    setCandidateId('');
    setReason('');
    setActionError(null);
  };

  const submit = async () => {
    if (!action || !target) return;
    setBusy(true);
    setActionError(null);
    let res: { ok: boolean; error?: ApiErrorShape };
    if (action === 'link') {
      if (!candidateId) {
        setActionError(t('accessErrorSelectAccount'));
        setBusy(false);
        return;
      }
      res = await api(`/api/hr/employees/${target.id}/link-account`, {
        method: 'POST', body: JSON.stringify({ userId: candidateId }),
      });
    } else if (action === 'offboard') {
      res = await api(`/api/hr/employees/${target.id}/offboard`, {
        method: 'POST', body: JSON.stringify({ reason: reason || null }),
      });
    } else {
      res = await api(`/api/hr/employees/${target.id}/reactivate`, {
        method: 'POST', body: JSON.stringify({ reason: reason || null }),
      });
    }
    setBusy(false);
    if (res.ok) {
      setAction(null);
      await load();
    } else {
      setActionError(res.error?.message ?? t('accessErrorOperation'));
    }
  };

  const counts = useMemo(() => {
    const list = data?.employees ?? [];
    return {
      total: list.length,
      linked: list.filter(e => e.userId).length,
      unlinked: list.filter(e => !e.userId).length,
      offboarded: list.filter(e => e.employmentStatus === 'offboarded').length,
    };
  }, [data]);

  const rows = useMemo(() => {
    const list = data?.employees ?? [];
    if (filter === 'linked') return list.filter(e => e.userId);
    if (filter === 'unlinked') return list.filter(e => !e.userId);
    if (filter === 'offboarded') return list.filter(e => e.employmentStatus === 'offboarded');
    return list;
  }, [data, filter]);

  const kpis: Array<{ label: string; value: number; cls?: string }> = [
    { label: t('kpiTotalHeadcount'), value: counts.total },
    { label: t('filterWithAccount'), value: counts.linked, cls: 'text-[#0b5c3a]' },
    { label: t('filterWithoutAccount'), value: counts.unlinked, cls: 'text-amber-600' },
    { label: t('statusOffboarded'), value: counts.offboarded, cls: 'text-red-600' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('accessTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('accessSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/hr/employees/new')}>
          <LogIn className="me-2 h-4 w-4 rtl:rotate-180" /> {t('btnNewEmployee')}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label} className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs ${k.cls ?? ''}`}>
            <p className="text-sm text-slate-500">{k.label}</p>
            <p className="mt-1 text-3xl font-bold text-[#16212B]">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="w-48">
          <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon('all')}</SelectItem>
              <SelectItem value="linked">{t('filterWithAccount')}</SelectItem>
              <SelectItem value="unlinked">{t('filterWithoutAccount')}</SelectItem>
              <SelectItem value="offboarded">{t('statusOffboarded')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-slate-500">{t('accessFilterCount', { count: rows.length })}</p>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        {loading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}</p>
        ) : error ? (
          <p className="flex items-center gap-1 p-6 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">{t('accessEmptyFilter')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-start text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pe-4 text-start font-medium">{t('colEmployee')}</th>
                  <th className="py-2 pe-4 text-start font-medium">{tCommon('status')}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t('colAccount')}</th>
                  <th className="py-2 text-end font-medium">{tCommon('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => (
                  <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-3 pe-4 text-start">
                      <button className="text-start" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}>
                        <p className="font-medium text-[#16212B]">{emp.displayName}</p>
                        <p className="font-mono text-xs text-slate-400">{emp.employeeId || '—'}</p>
                      </button>
                    </td>
                    <td className="py-3 pe-4 text-start">
                      <Badge className={EMPLOYMENT_STATUS_STYLES[emp.employmentStatus]}>
                        {getStatusLabel(emp.employmentStatus)}
                      </Badge>
                    </td>
                    <td className="py-3 pe-4 text-start">
                      {emp.userId ? (
                        <div>
                          <span className="flex items-center gap-1 text-[#0b5c3a]"><KeyRound className="h-3.5 w-3.5" /> {t('linkedAccount')}</span>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{emp.accountEmail || emp.accountName}</p>
                        </div>
                      ) : (
                        <span className="text-amber-600">{t('unlinkedAccount')}</span>
                      )}
                    </td>
                    <td className="py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        {!emp.userId && emp.employmentStatus !== 'offboarded' && (
                          <Button size="sm" variant="outline" onClick={() => openAction('link', emp)}>
                            <KeyRound className="me-1.5 h-3.5 w-3.5" /> {t('btnLinkAccount')}
                          </Button>
                        )}
                        {emp.employmentStatus === 'offboarded' ? (
                          <Button size="sm" variant="outline" className="text-[#0b5c3a]" onClick={() => openAction('reactivate', emp)}>
                            <RotateCcw className="me-1.5 h-3.5 w-3.5" /> {t('btnReactivate')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => openAction('offboard', emp)}>
                            <UserRoundX className="me-1.5 h-3.5 w-3.5" /> {t('btnOffboard')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={action !== null} onOpenChange={o => { if (!o && !busy) setAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'link' && t('accessDialogLinkTitle')}
              {action === 'offboard' && `${t('btnOffboard')} : ${target?.displayName ?? ''}`}
              {action === 'reactivate' && `${t('btnReactivate')} : ${target?.displayName ?? ''}`}
            </DialogTitle>
          </DialogHeader>

          {action === 'link' && (
            <div className="space-y-3 text-start">
              <p className="text-sm text-slate-500">
                {t('accessDialogLinkDesc')}
              </p>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">{t('accessSelectUserAccount')}</Label>
                <Select value={candidateId} onValueChange={setCandidateId}>
                  <SelectTrigger><SelectValue placeholder={t('accessSelectPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {(data?.candidates ?? []).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.email} ({getRoleLabel(c.role)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(data?.candidates ?? []).length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">{t('accessNoUnlinkedAccounts')}</p>
                )}
              </div>
            </div>
          )}

          {action !== 'link' && (
            <div className="text-start">
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('accessReasonOptional')}</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder={t('accessReasonPlaceholder')} />
              <p className="mt-2 text-xs text-slate-500">
                {action === 'offboard' ? t('accessOffboardDesc') : t('accessReactivateDesc')}
              </p>
            </div>
          )}

          {actionError && (
            <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{actionError}</p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setAction(null)}>{tCommon('cancel')}</Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {action === 'link' && t('btnLinkAccount')}
              {action === 'offboard' && t('accessConfirmOffboard')}
              {action === 'reactivate' && t('accessConfirmReactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
