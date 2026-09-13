'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Award, Ban, Calendar, Clock, Download, DollarSign, FileText,
  FolderDown, Loader2, LogIn, PiggyBank, ShieldAlert, User, UserCheck,
} from 'lucide-react';

type ApiResult<T> = { success: boolean; data?: T; error?: { code?: string; message?: string } };

type HomeData = {
  leaveBalances: {
    categoryId: string; categoryName: string; daysPerYear: number | null;
    accruedDays: number; usedDays: number; remainingDays: number;
  }[];
  totalRemaining: number;
  latestPayslip: {
    id: string; issuedAt: string | null; year: number | null; month: number | null;
    grossSalary: string; netSalary: string;
  } | null;
  punch: { id: string; punchType: string; scannedAt: string } | null;
  todaySchedule: {
    dayOfWeek: string; startTime: string; endTime: string; roomLabel: string | null;
    className: string; sectionName: string; subjectName: string;
  }[];
};

type ProfileData = {
  user: {
    name: string; email: string; firstName: string | null; lastName: string | null;
    phone: string | null; dateOfBirth: string | null; gender: string | null; address: string | null;
  } | null;
  employee: {
    id: string; cnssNumber: string | null; amoNumber: string | null; bankRib: string | null;
    contractType: string; dependantsCount: number; name: string; email: string; role: string;
  };
};

type LeaveRow = {
  id: string; categoryName: string; startDate: string; endDate: string; daysRequested: string;
  status: string; reason: string | null; createdAt: string;
};

type TimeData = {
  punches: { id: string; punchType: string; scannedAt: string; notes: string | null }[];
  sessions: { in: string; out: string; durationMinutes: number }[];
  openSession: { in: string } | null;
  todayTotalMinutes: number;
};

type PayrollData = {
  payslips: {
    id: string; year: number | null; month: number | null; issuedAt: string | null;
    grossSalary: string; netSalary: string; employeeName: string;
  }[];
  annualSummaries: { year: number; count: number; totalNet: number }[];
};

type AdvanceData = {
  advances: {
    id: string; requestedAmount: number; approvedAmount: number | null; repaidAmount: number;
    remainingBalance: number; monthlyInstallment: number | null; reason: string | null;
    status: string; requestedAt: string; approvedAt: string | null; rejectionReason: string | null;
  }[];
  transactions: {
    id: string; advanceId: string; type: string; amount: number; transactionDate: string; notes: string | null;
  }[];
};

type AwardRow = {
  id: string; title: string; category: string; monetaryReward: number; giftDescription: string | null;
  awardDate: string; summary: string | null; presentedBy: string | null; status: string;
};

type DocumentRow = {
  id: string; documentType: string; originalName: string; mimeType: string; fileSize: number;
  issuedAt: string | null; expiryDate: string | null; visibility: string; createdAt: string;
};

type ProfileRequestRow = {
  id: string; requestType: string; proposedChanges: Record<string, string>; reason: string | null;
  status: string; reauthenticatedAt: string; reviewedAt: string | null; rejectionReason: string | null; createdAt: string;
};

type SectionKey = 'home' | 'profile' | 'leave' | 'advances' | 'time' | 'payroll' | 'awards' | 'documents' | 'requests';

async function fetchJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    const json = await res.json().catch(() => ({}));
    return { ...json, status: res.status } as ApiResult<T> & { status: number };
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

function money(n: string | number, loc = 'fr'): string {
  const resolved = loc.startsWith('ar') ? 'ar-MA' : loc.startsWith('en') ? 'en-US' : 'fr-FR';
  return `${Number(n).toLocaleString(resolved, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function monthLabel(year: number | null, month: number | null, loc = 'fr'): string {
  if (!year || !month) return '—';
  const resolved = loc.startsWith('ar') ? 'ar-MA' : loc.startsWith('en') ? 'en-US' : 'fr-FR';
  return new Date(year, month - 1, 1).toLocaleDateString(resolved, { month: 'long', year: 'numeric' });
}

function formatDate(iso: string | null, loc = 'fr'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const resolved = loc.startsWith('ar') ? 'ar-MA' : loc.startsWith('en') ? 'en-US' : 'fr-FR';
  return d.toLocaleDateString(resolved);
}

const STATUS_I18N_KEYS: Record<string, { key: string; cls: string }> = {
  pending: { key: 'statusPending', cls: 'bg-amber-100 text-amber-700' },
  approved: { key: 'statusApproved', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  granted: { key: 'statusGranted', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  rejected: { key: 'statusRejected', cls: 'bg-rose-100 text-rose-600' },
  cancelled: { key: 'statusCancelled', cls: 'bg-slate-100 text-slate-500' },
  fully_repaid: { key: 'statusFullyRepaid', cls: 'bg-emerald-100 text-emerald-700' },
};

function StatusBadgeItem({ status }: { status: string }) {
  const t = useTranslations('HR');
  const s = STATUS_I18N_KEYS[status];
  const label = s ? t(s.key as any) : status;
  const cls = s?.cls ?? 'bg-slate-100 text-slate-600';
  return <Badge className={`border-none text-[9px] font-bold ${cls}`}>{label}</Badge>;
}

const NAV: { key: SectionKey; labelKey: string }[] = [
  { key: 'home', labelKey: 'navHome' },
  { key: 'profile', labelKey: 'navProfile' },
  { key: 'leave', labelKey: 'navLeave' },
  { key: 'advances', labelKey: 'navAdvances' },
  { key: 'time', labelKey: 'navTime' },
  { key: 'payroll', labelKey: 'navPayroll' },
  { key: 'awards', labelKey: 'navAwards' },
  { key: 'documents', labelKey: 'navDocuments' },
  { key: 'requests', labelKey: 'navRequests' },
];

export function EmployeePortalView() {
  const t = useTranslations('HR');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  const [status, setStatus] = useState<'loading' | 'notEmployee' | 'error' | 'ready'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [section, setSection] = useState<SectionKey>('home');
  const [home, setHome] = useState<HomeData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [leave, setLeave] = useState<LeaveRow[]>([]);
  const [time, setTime] = useState<TimeData | null>(null);
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [advances, setAdvances] = useState<AdvanceData | null>(null);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [requests, setRequests] = useState<ProfileRequestRow[]>([]);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    const [h, p, l, tRes, pay, adv, aw, doc, req] = await Promise.all([
      fetchJson<HomeData>('/api/employee/me/home'),
      fetchJson<ProfileData>('/api/employee/me/profile'),
      fetchJson<LeaveRow[]>('/api/employee/me/leave'),
      fetchJson<TimeData>('/api/employee/me/time'),
      fetchJson<PayrollData>('/api/employee/me/payroll'),
      fetchJson<AdvanceData>('/api/employee/me/advances'),
      fetchJson<AwardRow[]>('/api/employee/me/awards'),
      fetchJson<DocumentRow[]>('/api/employee/me/documents'),
      fetchJson<ProfileRequestRow[]>('/api/employee/me/requests'),
    ]);

    const anyErr = [h, p, l, tRes, pay].find(r => !r.success);
    if (anyErr?.error?.code === 'NOT_AN_EMPLOYEE' || (anyErr as ApiResult<unknown> & { status?: number })?.status === 403) {
      setStatus('notEmployee');
      return;
    }
    if (anyErr) {
      setStatus('error');
      setErrorMsg(anyErr.error?.message ?? t('loadError'));
      return;
    }
    setHome(h.data ?? null);
    setProfile(p.data ?? null);
    setLeave(l.data ?? []);
    setTime(tRes.data ?? null);
    setPayroll(pay.data ?? null);
    setAdvances(adv.data ?? null);
    setAwards(aw.data ?? []);
    setDocuments(doc.data ?? []);
    setRequests(req.data ?? []);
    setStatus('ready');
  }, [t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshLeave = useCallback(async () => {
    const r = await fetchJson<LeaveRow[]>('/api/employee/me/leave');
    if (r.success) setLeave(r.data ?? []);
  }, []);

  const refreshAdvances = useCallback(async () => {
    const r = await fetchJson<AdvanceData>('/api/employee/me/advances');
    if (r.success) setAdvances(r.data ?? null);
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2 rtl:mr-0 rtl:ml-2" /> {t('portalLoading')}
      </div>
    );
  }

  if (status === 'notEmployee') {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-extrabold text-[#16212B]">{t('accessRestricted')}</h1>
          <p className="text-xs text-slate-500">
            {t('accessRestrictedDesc')}
          </p>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-extrabold text-[#16212B]">{t('loadErrorTitle')}</h1>
          <p className="text-xs text-slate-500">{errorMsg}</p>
          <Button onClick={loadAll} className="mx-auto">{tCommon('retry')}</Button>
        </Card>
      </div>
    );
  }

  const pendingCount = leave.filter(r => r.status === 'pending').length + (requests.filter(r => r.status === 'pending').length);
  const isClockedIn = time?.openSession != null;

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('portalTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('portalSubtitle')}</p>
        </div>
        <Button onClick={loadAll} variant="outline" size="sm" className="h-8 text-xs font-bold border-slate-200 text-[#2487B8]">
          {t('btnRefresh')}
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('kpiLeaveBalance')}</span>
          <span className="text-lg font-extrabold text-[#16212B]">{t('kpiAvailableDays', { count: home?.totalRemaining ?? 0 })}</span>
          <span className="text-[9px] font-semibold text-slate-500 block">{t('kpiCategoriesCount', { count: home?.leaveBalances.length ?? 0 })}</span>
        </Card>
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('kpiLatestPayslip')}</span>
          <span className="text-sm font-extrabold text-[#16212B]">{home?.latestPayslip ? money(home.latestPayslip.netSalary, locale) : '—'}</span>
          <span className="text-[9px] font-semibold text-slate-500 block">{home?.latestPayslip ? monthLabel(home.latestPayslip.year, home.latestPayslip.month, locale) : t('noPayslipIssued')}</span>
        </Card>
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('kpiClockStatus')}</span>
          <span className={`text-lg font-extrabold ${isClockedIn ? 'text-[#17A673]' : 'text-slate-400'}`}>{isClockedIn ? t('clockInService') : t('clockOffService')}</span>
          <span className="text-[9px] font-semibold text-slate-500 block">{isClockedIn ? formatDate(time?.openSession?.in ?? null, locale) : '—'}</span>
        </Card>
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('kpiPendingRequests')}</span>
          <span className="text-lg font-extrabold text-amber-700">{pendingCount}</span>
          <span className="text-[9px] font-semibold text-slate-500 block">{t('pendingSubtext')}</span>
        </Card>
      </div>

      {/* Section nav */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {NAV.map(n => (
          <button
            key={n.key}
            onClick={() => setSection(n.key)}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-colors cursor-pointer ${section === n.key ? 'bg-[#2487B8] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {t(n.labelKey as any)}
          </button>
        ))}
      </div>

      {section === 'home' && <HomeSection home={home} leave={leave} locale={locale} />}
      {section === 'profile' && <ProfileSection profile={profile} onSaved={loadAll} />}
      {section === 'leave' && <LeaveSection balances={home?.leaveBalances ?? []} rows={leave} onChanged={refreshLeave} locale={locale} />}
      {section === 'advances' && <AdvancesSection data={advances} onChanged={refreshAdvances} locale={locale} />}
      {section === 'time' && <TimeSection time={time} locale={locale} />}
      {section === 'payroll' && <PayrollSection payroll={payroll} locale={locale} />}
      {section === 'awards' && <AwardsSection awards={awards} locale={locale} />}
      {section === 'documents' && <DocumentsSection docs={documents} locale={locale} />}
      {section === 'requests' && <RequestsSection requests={requests} locale={locale} />}
    </div>
  );
}

function HomeSection({ home, leave, locale }: { home: HomeData | null; leave: LeaveRow[]; locale: string }) {
  const t = useTranslations('HR');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-5 space-y-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#16212B]">{t('leaveBalancesTitle')}</h2>
            <Calendar className="w-4 h-4 text-[#2487B8]" />
          </div>
          {home && home.leaveBalances.length > 0 ? (
            <div className="space-y-2">
              {home.leaveBalances.map(b => (
                <div key={b.categoryId} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#16212B] text-[11px]">{b.categoryName}</p>
                    <p className="text-[10px] text-slate-400">{t('leaveAccruedUsed', { accrued: b.accruedDays, used: b.usedDays })}</p>
                  </div>
                  <span className="font-mono font-extrabold text-[#2487B8] text-[11px]">{t('daysRemaining', { count: b.remainingDays })}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">{t('noLeaveConfigured')}</p>
          )}
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#16212B]">{t('recentRequestsTitle')}</h2>
            <FileText className="w-4 h-4 text-[#2487B8]" />
          </div>
          {leave.length > 0 ? (
            <div className="space-y-2">
              {leave.slice(0, 4).map(r => (
                <div key={r.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#16212B] text-[11px]">{r.categoryName}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(r.startDate, locale)} → {formatDate(r.endDate, locale)} ({t('daysCount', { count: r.daysRequested })})</p>
                  </div>
                  <StatusBadgeItem status={r.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">{t('noLeaveRequests')}</p>
          )}
        </Card>
      </div>

      <div className="xl:col-span-7 space-y-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#16212B]">{t('todayScheduleTitle')}</h2>
            <Clock className="w-4 h-4 text-[#2487B8]" />
          </div>
          {home && home.todaySchedule.length > 0 ? (
            <div className="space-y-2">
              {home.todaySchedule.map((s, i) => (
                <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-[#2487B8] text-[10px] bg-[#DCEBF4] px-1.5 py-0.5 rounded">{s.startTime}–{s.endTime}</span>
                    <div>
                      <p className="font-bold text-[#16212B] text-[11px]">{s.subjectName}</p>
                      <p className="text-[10px] text-slate-500">{s.className} — {s.sectionName}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">{s.roomLabel ?? '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">{t('noScheduleToday')}</p>
          )}
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#16212B]">{t('kpiLatestPayslip')}</h2>
            <DollarSign className="w-4 h-4 text-[#2487B8]" />
          </div>
          {home?.latestPayslip ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#16212B] text-[11px]">{monthLabel(home.latestPayslip.year, home.latestPayslip.month, locale)}</p>
                <p className="text-[10px] text-slate-400">{t('issuedOn', { date: formatDate(home.latestPayslip.issuedAt, locale) })}</p>
              </div>
              <span className="font-mono font-extrabold text-[#16212B] text-[11px]">{money(home.latestPayslip.netSalary, locale)}</span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">{t('noPayslipPublished')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function ProfileSection({ profile, onSaved }: { profile: ProfileData | null; onSaved: () => void }) {
  const t = useTranslations('HR');

  const [firstName, setFirstName] = useState(profile?.user?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.user?.lastName ?? '');
  const [phone, setPhone] = useState(profile?.user?.phone ?? '');
  const [address, setAddress] = useState(profile?.user?.address ?? '');
  const [dependantsCount, setDependantsCount] = useState(profile?.employee?.dependantsCount ?? 0);

  const [rib, setRib] = useState(profile?.employee?.bankRib ?? '');
  const [cnss, setCnss] = useState(profile?.employee?.cnssNumber ?? '');
  const [amo, setAmo] = useState(profile?.employee?.amoNumber ?? '');
  const [ribPassword, setRibPassword] = useState('');
  const [ribOpen, setRibOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/employee/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phone, address, dependantsCount }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setSaving(false);
    if (json.success) {
      setMsg({ ok: true, text: t('saveChanges') });
      onSaved();
    } else {
      setMsg({ ok: false, text: json.error?.message ?? t('loadError') });
    }
  };

  const saveSensitive = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/employee/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankRib: rib, cnssNumber: cnss, amoNumber: amo, currentPassword: ribPassword }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setSaving(false);
    if (json.success) {
      setMsg({ ok: true, text: json.data?.pendingApproval ? t('bankingSocialNotice') : t('saveChanges') });
      setRibOpen(false);
      setRibPassword('');
      onSaved();
    } else {
      setMsg({ ok: false, text: json.error?.message ?? t('loadError') });
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-7 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">{t('myInfoTitle')}</h2>
          <User className="w-4 h-4 text-[#2487B8]" />
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div><span className="text-[10px] font-bold text-slate-400 uppercase block">{t('fullName')}</span><span className="font-bold text-[#16212B]">{profile.user?.name ?? '—'}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 uppercase block">{t('email')}</span><span className="font-bold text-[#16212B]">{profile.employee.email}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 uppercase block">{t('role')}</span><span className="font-bold text-[#16212B]">{profile.employee.role}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 uppercase block">{t('labelContractType')}</span><span className="font-bold text-[#16212B] uppercase">{profile.employee.contractType}</span></div>
        </div>

        <div className="pt-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('firstName')} value={firstName} onChange={setFirstName} />
            <Field label={t('lastName')} value={lastName} onChange={setLastName} />
          </div>
          <Field label={t('phone')} value={phone} onChange={setPhone} />
          <Field label={t('address')} value={address} onChange={setAddress} />
          <label className="block text-[10px] font-bold text-slate-400 uppercase">{t('dependantsCount')}</label>
          <input
            type="number" min={0} max={20}
            value={dependantsCount}
            onChange={e => setDependantsCount(Math.max(0, Math.min(20, Number(e.target.value))))}
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30"
          />
          {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-[#17A673]' : 'text-rose-600'}`}>{msg.text}</p>}
          <Button onClick={saveProfile} disabled={saving} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs px-4 cursor-pointer">
            {saving ? t('savingChanges') : t('saveMyInfo')}
          </Button>
        </div>
      </Card>

      <Card className="xl:col-span-5 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">{t('bankingSocialTitle')}</h2>
          <ShieldAlert className="w-4 h-4 text-amber-500" />
        </div>
        <p className="text-[10px] text-slate-400">{t('bankingSocialNotice')}</p>
        {!ribOpen ? (
          <div className="space-y-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">{t('labelRib')}</span><span className="font-mono font-extrabold text-[#16212B]">{profile.employee.bankRib ?? t('notProvided')}</span></div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">{t('labelCnss')}</span><span className="font-extrabold text-[#16212B]">{profile.employee.cnssNumber ?? t('notProvided')}</span></div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">{t('labelAmo')}</span><span className="font-extrabold text-[#16212B]">{profile.employee.amoNumber ?? t('notProvided')}</span></div>
            </div>
            <Button onClick={() => setRibOpen(true)} variant="outline" className="w-full h-8 text-xs font-bold rounded-xl border-slate-200 text-[#2487B8]">
              {t('proposeEdit')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label={t('newRib')} value={rib} onChange={setRib} />
            <Field label={t('labelCnss')} value={cnss} onChange={setCnss} />
            <Field label={t('labelAmo')} value={amo} onChange={setAmo} />
            <Field label={t('confirmPassword')} value={ribPassword} onChange={setRibPassword} type="password" />
            <div className="flex gap-2">
              <Button onClick={saveSensitive} disabled={saving || !ribPassword} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs px-4 cursor-pointer">
                {t('submitToHr')}
              </Button>
              <Button onClick={() => { setRibOpen(false); setRibPassword(''); }} variant="outline" className="h-8 text-xs font-bold rounded-xl border-slate-200 text-slate-500">
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-[10px] font-bold text-slate-400 uppercase">{label}
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30"
      />
    </label>
  );
}

function LeaveSection({ balances, rows, onChanged, locale }: { balances: HomeData['leaveBalances']; rows: LeaveRow[]; onChanged: () => void; locale: string }) {
  const t = useTranslations('HR');
  const tCommon = useTranslations('Common');

  const [categoryId, setCategoryId] = useState(balances[0]?.categoryId ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/employee/me/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, startDate, endDate, reason }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setBusy(false);
    if (json.success) {
      setMsg({ ok: true, text: t('sendRequest') });
      setStartDate(''); setEndDate(''); setReason('');
      onChanged();
    } else {
      setMsg({ ok: false, text: json.error?.message ?? t('loadError') });
    }
  };

  const cancel = async (id: string) => {
    await fetch(`/api/employee/me/leave/${id}/cancel`, { method: 'POST' });
    onChanged();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-4 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">{t('newLeaveRequest')}</h2>
        {balances.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">{t('noLeaveCategory')}</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase">{t('category')}
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="mt-1 w-full h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-[#16212B]">
                {balances.map(b => (
                  <option key={b.categoryId} value={b.categoryId}>{b.categoryName} — {t('daysRemaining', { count: b.remainingDays })}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('startDate')} value={startDate} onChange={setStartDate} />
              <Field label={t('endDate')} value={endDate} onChange={setEndDate} />
            </div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">{t('reason')}
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#16212B] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30" />
            </label>
            {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-[#17A673]' : 'text-rose-600'}`}>{msg.text}</p>}
            <Button onClick={submit} disabled={busy || !categoryId || !startDate || !endDate} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs px-4 cursor-pointer">
              {busy ? t('sending') : t('sendRequest')}
            </Button>
          </div>
        )}
      </Card>

      <Card className="xl:col-span-8 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">{t('myLeaveRequests', { count: rows.length })}</h2>
        {rows.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">{t('noLeaveRequests')}</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#16212B] text-xs">{r.categoryName}</p>
                    <StatusBadgeItem status={r.status} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(r.startDate, locale)} → {formatDate(r.endDate, locale)} ({t('daysCount', { count: r.daysRequested })}){r.reason ? ` — ${r.reason}` : ''}</p>
                </div>
                {r.status === 'pending' && (
                  <Button onClick={() => cancel(r.id)} variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold rounded-lg border-slate-200 text-slate-500">
                    <Ban className="w-3 h-3 rtl:mr-0 rtl:ml-1" /> {tCommon('cancel')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AdvancesSection({ data, onChanged, locale }: { data: AdvanceData | null; onChanged: () => void; locale: string }) {
  const t = useTranslations('HR');

  const [requestedAmount, setRequestedAmount] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submitAdvance = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/employee/me/advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestedAmount: Number(requestedAmount),
        monthlyInstallment: monthlyInstallment ? Number(monthlyInstallment) : undefined,
        reason: reason || undefined,
      }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setBusy(false);
    if (json.success) {
      setMsg({ ok: true, text: t('submitAdvance') });
      setRequestedAmount(''); setMonthlyInstallment(''); setReason('');
      onChanged();
    } else {
      setMsg({ ok: false, text: json.error?.message ?? t('loadError') });
    }
  };

  const advances = data?.advances ?? [];
  const transactions = data?.transactions ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-4 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">{t('requestAdvanceTitle')}</h2>
          <PiggyBank className="w-4 h-4 text-[#2487B8]" />
        </div>
        <div className="space-y-3">
          <Field label={t('requestedAmountDh')} value={requestedAmount} onChange={setRequestedAmount} type="number" />
          <Field label={t('monthlyInstallmentDh')} value={monthlyInstallment} onChange={setMonthlyInstallment} type="number" />
          <label className="block text-[10px] font-bold text-slate-400 uppercase">{t('advanceReason')}
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#16212B] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30" />
          </label>
          {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-[#17A673]' : 'text-rose-600'}`}>{msg.text}</p>}
          <Button onClick={submitAdvance} disabled={busy || !requestedAmount} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs px-4 cursor-pointer">
            {busy ? t('sending') : t('submitAdvance')}
          </Button>
        </div>
      </Card>

      <div className="xl:col-span-8 space-y-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h2 className="text-xs font-extrabold text-[#16212B]">{t('myAdvances', { count: advances.length })}</h2>
          {advances.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">{t('noAdvances')}</p>
          ) : (
            <div className="space-y-2">
              {advances.map(a => (
                <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#16212B] text-xs">{money(a.requestedAmount, locale)}</p>
                      <StatusBadgeItem status={a.status} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('requestDate', { date: formatDate(a.requestedAt, locale) })}{a.reason ? ` — ${a.reason}` : ''}</p>
                  </div>
                  <div className="text-right rtl:text-left">
                    <span className="font-mono font-extrabold text-[#16212B] text-[11px] block">{t('remainingBalance', { amount: money(a.remainingBalance, locale) })}</span>
                    <span className="text-[9px] text-slate-400">{t('repaidAmount', { amount: money(a.repaidAmount, locale) })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {transactions.length > 0 && (
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h2 className="text-xs font-extrabold text-[#16212B]">{t('repaymentHistory')}</h2>
            <div className="space-y-2">
              {transactions.map(tr => (
                <div key={tr.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#16212B] uppercase">{tr.type}</span>
                    <span className="text-[10px] text-slate-400 block">{formatDate(tr.transactionDate, locale)}</span>
                  </div>
                  <span className="font-mono font-extrabold text-[#17A673]">{money(tr.amount, locale)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function TimeSection({ time, locale }: { time: TimeData | null; locale: string }) {
  const t = useTranslations('HR');

  if (!time) return null;
  const h = Math.floor(time.todayTotalMinutes / 60);
  const m = time.todayTotalMinutes % 60;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-5 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">{t('todaySectionTitle')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('totalWorked')}</span>
            <span className="text-lg font-extrabold text-[#16212B]">{h}h{m.toString().padStart(2, '0')}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('kpiClockStatus')}</span>
            <span className={`text-lg font-extrabold ${time.openSession ? 'text-[#17A673]' : 'text-slate-400'}`}>
              {time.openSession ? t('clockInService') : t('clockOffService')}
            </span>
          </div>
        </div>
        {time.openSession && (
          <div className="p-2.5 bg-[#DDF5EC] rounded-xl border border-emerald-100 flex items-center gap-2">
            <LogIn className="w-3.5 h-3.5 text-[#17A673]" />
            <p className="text-[11px] font-bold text-[#17A673]">{t('clockSessionOpen', { time: time.openSession.in.slice(11, 16) })}</p>
          </div>
        )}
        <h2 className="text-xs font-extrabold text-[#16212B] pt-2">{t('workSessions', { count: time.sessions.length })}</h2>
        {time.sessions.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">{t('noWorkSessions')}</p>
        ) : (
          <div className="space-y-2">
            {time.sessions.slice(0, 8).map((s, i) => (
              <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#16212B]">{s.in.slice(0, 10)} · {s.in.slice(11, 16)} → {s.out.slice(11, 16)}</span>
                <span className="font-mono text-[11px] font-extrabold text-[#2487B8]">{Math.floor(s.durationMinutes / 60)}h{(s.durationMinutes % 60).toString().padStart(2, '0')}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="xl:col-span-7 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">{t('punchHistory', { count: time.punches.length })}</h2>
        {time.punches.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">{t('noPunches')}</p>
        ) : (
          <div className="space-y-1.5">
            {time.punches.slice(0, 20).map(p => (
              <div key={p.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold ${p.punchType === 'in' ? 'text-[#17A673]' : 'text-rose-500'}`}>
                  {p.punchType === 'in' ? <LogIn className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                  {p.punchType === 'in' ? t('punchIn') : t('punchOut')}
                </span>
                <span className="text-[11px] font-bold text-[#16212B]">{formatDate(p.scannedAt, locale)} {t('atTime', { time: p.scannedAt.slice(11, 16) })}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PayrollSection({ payroll, locale }: { payroll: PayrollData | null; locale: string }) {
  const t = useTranslations('HR');

  if (!payroll) return null;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-8 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">{t('myPayslips', { count: payroll.payslips.length })}</h2>
          <FileText className="w-4 h-4 text-[#2487B8]" />
        </div>
        {payroll.payslips.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">{t('noPayslipPublished')}</p>
        ) : (
          <div className="space-y-2">
            {payroll.payslips.map(ps => (
              <div key={ps.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#16212B] text-xs">{monthLabel(ps.year, ps.month, locale)}</p>
                  <p className="text-[10px] text-slate-400">{t('issuedOn', { date: formatDate(ps.issuedAt, locale) })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right rtl:text-left">
                    <span className="font-mono font-extrabold text-[#16212B] text-[11px] block">{money(ps.netSalary, locale)}</span>
                    <span className="text-[9px] text-slate-400 font-medium">{t('gross', { amount: money(ps.grossSalary, locale) })}</span>
                  </div>
                  <a href={`/api/employee/me/payroll/${ps.id}/download`} className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#2487B8] cursor-pointer" title={t('actionDownload')} aria-label={t('actionDownload')}>
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="xl:col-span-4 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">{t('annualSummary')}</h2>
        {payroll.annualSummaries.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">{t('noDataMatch')}</p>
        ) : (
          <div className="space-y-2">
            {payroll.annualSummaries.map(s => (
              <div key={s.year} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#16212B] text-[11px]">{t('yearLabel', { year: s.year })}</p>
                  <p className="text-[10px] text-slate-400">{t('payslipsCount', { count: s.count })}</p>
                </div>
                <span className="font-mono font-extrabold text-[#16212B] text-[11px]">{money(s.totalNet, locale)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AwardsSection({ awards, locale }: { awards: AwardRow[]; locale: string }) {
  const t = useTranslations('HR');

  return (
    <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold text-[#16212B]">{t('myAwards', { count: awards.length })}</h2>
        <Award className="w-4 h-4 text-amber-500" />
      </div>
      {awards.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">{t('noAwards')}</p>
      ) : (
        <div className="space-y-2">
          {awards.map(a => (
            <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#16212B] text-xs">{a.title}</p>
                  <Badge className="bg-amber-100 text-amber-700 text-[9px] font-bold border-none">{a.category}</Badge>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('awardedOn', { date: formatDate(a.awardDate, locale) })}{a.presentedBy ? ` ${t('awardedBy', { name: a.presentedBy })}` : ''}</p>
                {a.summary && <p className="text-[10px] text-slate-600 mt-1">{a.summary}</p>}
              </div>
              {a.monetaryReward > 0 && (
                <span className="font-mono font-extrabold text-[#17A673] text-xs">{money(a.monetaryReward, locale)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DocumentsSection({ docs, locale }: { docs: DocumentRow[]; locale: string }) {
  const t = useTranslations('HR');

  return (
    <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold text-[#16212B]">{t('myHrDocuments', { count: docs.length })}</h2>
        <FolderDown className="w-4 h-4 text-[#2487B8]" />
      </div>
      {docs.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">{t('noAdminDocuments')}</p>
      ) : (
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#16212B] text-xs">{d.originalName}</p>
                <p className="text-[10px] text-slate-400">{d.documentType.toUpperCase()} · {t('depositedOn', { date: formatDate(d.createdAt, locale) })}</p>
              </div>
              <a href={`/api/employee/me/documents/${d.id}/download`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-[#2487B8] hover:bg-slate-100">
                <Download className="h-3.5 w-3.5" /> {t('actionDownload')}
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RequestsSection({ requests, locale }: { requests: ProfileRequestRow[]; locale: string }) {
  const t = useTranslations('HR');

  return (
    <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold text-[#16212B]">{t('requestsHistory', { count: requests.length })}</h2>
        <UserCheck className="w-4 h-4 text-[#2487B8]" />
      </div>
      {requests.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">{t('noModificationRequests')}</p>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#16212B] text-xs">{t('requestNumber', { id: r.id.slice(0, 8) })}</p>
                  <StatusBadgeItem status={r.status} />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('submittedOn', { date: formatDate(r.createdAt, locale) })} · {t('labelType')}: {r.requestType}</p>
                {r.rejectionReason && <p className="text-[10px] text-rose-600 font-bold mt-1">{t('rejectionReason', { reason: r.rejectionReason })}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
