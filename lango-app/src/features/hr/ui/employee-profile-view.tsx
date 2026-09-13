'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertCircle, ArrowLeft, Building2, Calendar, CalendarClock, FileText, History, IdCard, Loader2, Lock, Mail, Pencil, Phone, Save, UserRound, Wallet, X,
} from 'lucide-react';
import { EmployeeDocumentsView } from '@/features/hr/ui/employee-documents-view';
import { IssueCardDialog } from '@/features/cards/ui/issue-card-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CONTRACT_TYPE_LABELS, EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_STYLES, EMPLOYMENT_TYPE_LABELS,
  type BranchOption, type DepartmentRow, type DesignationRow, type EmployeeRow, type EmploymentEventRow,
  type EmploymentStatus, type EmploymentType, type ContractType,
} from '@/features/hr/model/types';

type ApiErrorShape = { code?: string; message?: string };

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

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

function fmtDate(value: string | null, loc = 'fr') {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const resolved = loc.startsWith('ar') ? 'ar-MA' : loc.startsWith('en') ? 'en-US' : 'fr-FR';
  return d.toLocaleDateString(resolved);
}

function fmtTime(value: string | null, loc = 'fr') {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const resolved = loc.startsWith('ar') ? 'ar-MA' : loc.startsWith('en') ? 'en-US' : 'fr-FR';
  return d.toLocaleTimeString(resolved, { hour: '2-digit', minute: '2-digit' });
}

function monthLabel(year: number, month: number, loc = 'fr') {
  const resolved = loc.startsWith('ar') ? 'ar-MA' : loc.startsWith('en') ? 'en-US' : 'fr-FR';
  return new Date(year, month - 1, 1).toLocaleDateString(resolved, { month: 'long', year: 'numeric' });
}

const EVENT_KEYS: Record<string, string> = {
  hired: 'eventHired',
  changed_department: 'eventChangedDept',
  changed_designation: 'eventChangedDesignation',
  changed_manager: 'eventChangedManager',
  employment_status_change: 'eventStatusChange',
  access_granted: 'eventAccessGranted',
  access_revoked: 'eventAccessRevoked',
  offboarded: 'eventOffboarded',
  reactivated: 'eventReactivated',
  archived: 'eventArchived',
  linked_account: 'eventLinkedAccount',
};

const EMPLOYMENT_STATUS_I18N_KEYS: Record<EmploymentStatus, string> = {
  active: 'statusActive',
  probation: 'statusProbation',
  on_leave: 'statusOnLeave',
  offboarded: 'statusOffboarded',
  archived: 'statusArchived',
};

const EMPLOYMENT_TYPE_I18N_KEYS: Record<EmploymentType, string> = {
  permanent: 'typePermanent',
  fixed_term: 'typeFixedTerm',
  part_time: 'typePartTime',
  contractor: 'typeContractor',
  internship: 'typeInternship',
  substitute: 'typeSubstitute',
};

const CONTRACT_TYPE_I18N_KEYS: Record<ContractType, string> = {
  cdi: 'contractCdi',
  cdd: 'contractCdd',
  vacation: 'contractVacation',
};

type Field = 'departmentId' | 'designationId' | 'managerEmployeeId' | 'employmentType' | 'employmentStatus' | 'hireDate' | 'contractStartDate' | 'contractEndDate' | 'workloadHours';

type PayslipRecord = { id: string; year: number; month: number; grossSalary: string; netSalary: string; issuedAt: string | null };
type PunchRecord = { id: string; punchType: string; scannedAt: string; notes: string | null };
type PayrollAttendance = { linked: boolean; payslips: PayslipRecord[]; punches: PunchRecord[] };

export function EmployeeProfileView({ employeeId }: { employeeId: string }) {
  const t = useTranslations('HR');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const { can } = usePermissions();

  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [events, setEvents] = useState<EmploymentEventRow[]>([]);
  const [records, setRecords] = useState<PayrollAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [designations, setDesignations] = useState<DesignationRow[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [issueCardOpen, setIssueCardOpen] = useState(false);
  const [form, setForm] = useState<Record<Field, string>>({
    departmentId: '', designationId: '', managerEmployeeId: '',
    employmentType: '', employmentStatus: '', hireDate: '', contractStartDate: '', contractEndDate: '', workloadHours: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [emp, hist, rec] = await Promise.all([
      api<EmployeeRow>(`/api/hr/employees/${employeeId}`),
      api<EmploymentEventRow[]>(`/api/hr/employees/${employeeId}/history`),
      api<PayrollAttendance>(`/api/hr/employees/${employeeId}/payroll-attendance`),
    ]);
    if (emp.ok && emp.data) setEmployee(emp.data);
    else setError(emp.error?.message ?? t('employeeNotFound'));
    if (hist.ok && Array.isArray(hist.data)) setEvents(hist.data);
    if (rec.ok && rec.data) setRecords(rec.data);
    setLoading(false);
  }, [employeeId, t]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  useEffect(() => {
    Promise.all([
      api<DepartmentRow[]>('/api/hr/departments?status=active'),
      api<DesignationRow[]>('/api/hr/designations?status=active'),
      api<BranchOption[]>('/api/settings/branches'),
      api<EmployeeRow[]>('/api/hr/employees'),
    ]).then(([d, ds, b, e]) => {
      if (d.ok && Array.isArray(d.data)) setDepartments(d.data);
      if (ds.ok && Array.isArray(ds.data)) setDesignations(ds.data);
      if (b.ok && Array.isArray(b.data)) setBranches(b.data);
      if (e.ok && Array.isArray(e.data)) setEmployees(e.data);
    }).catch(() => {});
  }, []);

  const openEdit = () => {
    if (!employee) return;
    setForm({
      departmentId: employee.departmentId ?? '',
      designationId: employee.designationId ?? '',
      managerEmployeeId: employee.managerEmployeeId ?? '',
      employmentType: employee.employmentType ?? '',
      employmentStatus: employee.employmentStatus,
      hireDate: employee.hireDate ?? '',
      contractStartDate: employee.contractStartDate ?? '',
      contractEndDate: employee.contractEndDate ?? '',
      workloadHours: employee.workloadHours != null ? String(employee.workloadHours) : '',
    });
    setEditError(null);
    setEditOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setEditError(null);
    const body: Record<string, unknown> = {
      departmentId: form.departmentId || null,
      designationId: form.designationId || null,
      managerEmployeeId: form.managerEmployeeId || null,
      employmentType: form.employmentType || null,
      employmentStatus: form.employmentStatus,
      hireDate: form.hireDate || null,
      contractStartDate: form.contractStartDate || null,
      contractEndDate: form.contractEndDate || null,
      workloadHours: form.workloadHours ? Number(form.workloadHours) : null,
    };
    const res = await api<EmployeeRow>(`/api/hr/employees/${employeeId}`, { method: 'PATCH', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setEditOpen(false);
      await load();
    } else {
      setEditError(res.error?.message ?? t('loadError'));
    }
  };

  const sensitivePresent = useMemo(
    () => !!employee && (
      employee.salary !== undefined || employee.nationalId !== undefined || employee.bankRib !== undefined
      || employee.cnssNumber !== undefined || employee.amoNumber !== undefined || employee.contractType !== undefined
    ),
    [employee],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-10 text-center">
        <p className="flex items-center justify-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error ?? t('employeeNotFound')}</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/hr/employees')}>{t('backToDirectory')}</Button>
      </div>
    );
  }

  const manager = employees.find(e => e.id === employee.managerEmployeeId);
  const branch = branches.find(b => b.id === employee.branchId);
  const employeeTypes = Object.keys(EMPLOYMENT_TYPE_I18N_KEYS) as EmploymentType[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/hr/employees')} aria-label={t('backToDirectory')}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#16212B]">{t('profileTitle')}</h1>
        </div>
        {can('cards.issue') && employee.userId && (
          <Button variant="outline" onClick={() => setIssueCardOpen(true)}><IdCard className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4" /> {t('btnIssueCard')}</Button>
        )}
        <Button onClick={openEdit}><Pencil className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4" /> {t('btnEdit')}</Button>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar className="h-16 w-16">
            <AvatarImage src={employee.photoUrl ?? undefined} alt={employee.displayName} />
            <AvatarFallback className="bg-[#D1F5E8] text-lg font-semibold text-[#16212B]">{initials(employee.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[#16212B]">{employee.displayName}</h2>
              <Badge className={EMPLOYMENT_STATUS_STYLES[employee.employmentStatus]}>
                {EMPLOYMENT_STATUS_I18N_KEYS[employee.employmentStatus] ? t(EMPLOYMENT_STATUS_I18N_KEYS[employee.employmentStatus] as any) : (EMPLOYMENT_STATUS_LABELS[employee.employmentStatus] ?? employee.employmentStatus)}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="font-mono text-xs">{employee.employeeId || '—'}</span>
              {employee.departmentName && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{employee.departmentName}</span>}
              {employee.designationTitle && <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{employee.designationTitle}</span>}
              {branch && <span className="flex items-center gap-1">{branch.name}</span>}
            </div>
          </div>
          <div className="text-right rtl:text-left">
            {employee.userId ? (
              <>
                <Badge className="bg-[#D1F5E8] text-[#0b5c3a]">{t('linkedAccount')}</Badge>
                <p className="mt-1 text-xs text-slate-500">{employee.accountEmail || employee.accountName}</p>
              </>
            ) : (
              <Badge className="bg-amber-50 text-amber-700">{t('unlinkedAccount')}</Badge>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" className="flex items-center gap-1"><UserRound className="h-4 w-4" /> {t('tabDetails')}</TabsTrigger>
          <TabsTrigger value="sensitive" className="flex items-center gap-1"><Lock className="h-4 w-4" /> {t('tabSensitive')}</TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1"><FileText className="h-4 w-4" /> {t('tabDocuments')}</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1"><History className="h-4 w-4" /> {t('tabHistory')}</TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-1"><Wallet className="h-4 w-4" /> {t('tabFinance')}</TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-1"><CalendarClock className="h-4 w-4" /> {t('tabAttendance')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('sectionContact')}</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-slate-500"><Mail className="h-4 w-4" /> {t('email')}</dt><dd className="text-slate-700">{employee.email || '—'}</dd></div>
                <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-slate-500"><Phone className="h-4 w-4" /> {t('phone')}</dt><dd className="text-slate-700">{employee.phone || '—'}</dd></div>
              </dl>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('sectionEmployment')}</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">{t('labelType')}</dt><dd className="font-medium text-[#16212B]">{employee.employmentType && EMPLOYMENT_TYPE_I18N_KEYS[employee.employmentType] ? t(EMPLOYMENT_TYPE_I18N_KEYS[employee.employmentType] as any) : '—'}</dd></div>
                <div><dt className="text-slate-500">{t('labelManager')}</dt><dd className="font-medium text-[#16212B]">{manager?.displayName ?? '—'}</dd></div>
                <div><dt className="text-slate-500">{t('labelHireDate')}</dt><dd className="font-medium text-[#16212B]">{fmtDate(employee.hireDate, locale)}</dd></div>
                <div><dt className="text-slate-500">{t('labelWorkload')}</dt><dd className="font-medium text-[#16212B]">{employee.workloadHours ?? '—'}</dd></div>
                <div><dt className="text-slate-500">{t('labelContract')}</dt><dd className="font-medium text-[#16212B]">{employee.contractStartDate ? `${fmtDate(employee.contractStartDate, locale)} → ${fmtDate(employee.contractEndDate, locale)}` : '—'}</dd></div>
                <div><dt className="text-slate-500">{t('labelDependants')}</dt><dd className="font-medium text-[#16212B]">{employee.dependantsCount ?? 0}</dd></div>
              </dl>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sensitive">
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            {sensitivePresent ? (
              <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                {employee.cnssNumber !== undefined && (
                  <div><dt className="text-slate-500">{t('labelCnss')}</dt><dd className="font-mono font-medium text-[#16212B]">{employee.cnssNumber ?? '—'}</dd></div>
                )}
                {employee.amoNumber !== undefined && (
                  <div><dt className="text-slate-500">{t('labelAmo')}</dt><dd className="font-mono font-medium text-[#16212B]">{employee.amoNumber ?? '—'}</dd></div>
                )}
                {employee.bankRib !== undefined && (
                  <div><dt className="text-slate-500">{t('labelRib')}</dt><dd className="font-mono font-medium text-[#16212B]">{employee.bankRib ?? '—'}</dd></div>
                )}
                {employee.contractType !== undefined && (
                  <div><dt className="text-slate-500">{t('labelContractType')}</dt><dd className="font-medium text-[#16212B]">{employee.contractType && CONTRACT_TYPE_I18N_KEYS[employee.contractType] ? t(CONTRACT_TYPE_I18N_KEYS[employee.contractType] as any) : '—'}</dd></div>
                )}
                {employee.nationalId !== undefined && (
                  <div><dt className="text-slate-500">{t('labelCin')}</dt><dd className="font-mono font-medium text-[#16212B]">{employee.nationalId ?? '—'}</dd></div>
                )}
                {employee.salary !== undefined && (
                  <div><dt className="text-slate-500">{t('labelSalary')}</dt><dd className="font-medium text-[#16212B]">{employee.salary ? `${employee.salary} MAD` : '—'}</dd></div>
                )}
              </dl>
            ) : (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Lock className="h-4 w-4" /> {t('noSensitivePermission')}
              </p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <EmployeeDocumentsView employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="history">
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            {events.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">{tCommon('empty')}</p>
            ) : (
              <ol className="relative space-y-5 border-l rtl:border-l-0 rtl:border-r border-slate-200 pl-6 rtl:pl-0 rtl:pr-6">
                {events.map(ev => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[29px] rtl:-left-auto rtl:-right-[29px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#0066FF]" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#16212B]">
                        {EVENT_KEYS[ev.eventType] ? t(EVENT_KEYS[ev.eventType] as any) : ev.eventType}
                      </p>
                      <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="h-3.5 w-3.5" />{fmtDate(ev.effectiveAt, locale)}</span>
                    </div>
                    {ev.reason && <p className="mt-1 text-xs text-slate-500">{ev.reason}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">{t('awardedBy', { name: ev.actorName ?? ev.actorId ?? '—' })}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            {!records || records.linked === false ? (
              <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
                <Wallet className="h-4 w-4" /> {t('accessRestrictedDesc')}
              </p>
            ) : records.payslips.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">{t('noPayslipPublished')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead className="border-b text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-4 rtl:pr-0 rtl:pl-4">{t('colDate')}</th>
                      <th className="py-2 px-4 text-right rtl:text-left">{t('gross', { amount: '' })}</th>
                      <th className="py-2 pl-4 rtl:pl-0 rtl:pr-4 text-right rtl:text-left">{t('salary')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.payslips.map(p => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-4 rtl:pr-0 rtl:pl-4 font-medium text-[#16212B]">{monthLabel(p.year, p.month, locale)}</td>
                        <td className="py-2.5 px-4 text-right rtl:text-left text-slate-600">{Number(p.grossSalary).toFixed(2)} MAD</td>
                        <td className="py-2.5 pl-4 rtl:pl-0 rtl:pr-4 text-right rtl:text-left font-semibold text-[#16212B]">{Number(p.netSalary).toFixed(2)} MAD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            {!records || records.linked === false ? (
              <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
                <CalendarClock className="h-4 w-4" /> {t('accessRestrictedDesc')}
              </p>
            ) : records.punches.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">{t('noPunches')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead className="border-b text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-4 rtl:pr-0 rtl:pl-4">{t('labelType')}</th>
                      <th className="py-2 px-4">{t('colDate')}</th>
                      <th className="py-2 pl-4 rtl:pl-0 rtl:pr-4">{t('reason')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.punches.map(p => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-4 rtl:pr-0 rtl:pl-4">
                          <Badge className={p.punchType === 'in' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-600'}>
                            {p.punchType === 'in' ? t('punchIn') : t('punchOut')}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{fmtDate(p.scannedAt, locale)} {fmtTime(p.scannedAt, locale)}</td>
                        <td className="py-2.5 pl-4 rtl:pl-0 rtl:pr-4 text-slate-500">{p.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editEmployeeProfile')} · {employee.displayName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('department')}</Label>
              <Select value={form.departmentId} onValueChange={v => setForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder={tCommon('all')} /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('designation')}</Label>
              <Select value={form.designationId} onValueChange={v => setForm(f => ({ ...f, designationId: v }))}>
                <SelectTrigger><SelectValue placeholder={tCommon('all')} /></SelectTrigger>
                <SelectContent>
                  {designations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('labelManager')}</Label>
              <Select value={form.managerEmployeeId} onValueChange={v => setForm(f => ({ ...f, managerEmployeeId: v }))}>
                <SelectTrigger><SelectValue placeholder={tCommon('all')} /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.id !== employeeId).map(e => <SelectItem key={e.id} value={e.id}>{e.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('labelType')}</Label>
              <Select value={form.employmentType} onValueChange={v => setForm(f => ({ ...f, employmentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employeeTypes.map(et => (
                    <SelectItem key={et} value={et}>
                      {EMPLOYMENT_TYPE_I18N_KEYS[et] ? t(EMPLOYMENT_TYPE_I18N_KEYS[et] as any) : et}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{tCommon('status')}</Label>
              <Select value={form.employmentStatus} onValueChange={v => setForm(f => ({ ...f, employmentStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EMPLOYMENT_STATUS_I18N_KEYS) as EmploymentStatus[]).map(es => (
                    <SelectItem key={es} value={es}>
                      {t(EMPLOYMENT_STATUS_I18N_KEYS[es] as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('labelHireDate')}</Label>
              <Input type="date" value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('startDate')}</Label>
              <Input type="date" value={form.contractStartDate} onChange={e => setForm(f => ({ ...f, contractStartDate: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('endDate')}</Label>
              <Input type="date" value={form.contractEndDate} onChange={e => setForm(f => ({ ...f, contractEndDate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('labelWorkload')}</Label>
              <Input type="number" min={0} max={168} value={form.workloadHours} onChange={e => setForm(f => ({ ...f, workloadHours: e.target.value }))} />
            </div>
            {editError && (
              <p className="flex items-center gap-1 text-sm text-red-600 sm:col-span-2"><AlertCircle className="h-4 w-4" />{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}><X className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4" /> {tCommon('cancel')}</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4 animate-spin" />} <Save className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4" /> {t('saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IssueCardDialog
        open={issueCardOpen}
        onOpenChange={setIssueCardOpen}
        subjectType="employee"
        templateType="employee_id"
        subjectId={employee.userId ?? ''}
        subjectLabel={t('colEmployee')}
        subjectName={employee.displayName}
      />
    </div>
  );
}
