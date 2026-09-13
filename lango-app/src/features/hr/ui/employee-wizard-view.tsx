'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Save } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  type BranchOption, type DepartmentRow, type DesignationRow, type EmployeeRow,
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

type Step = 'identity' | 'employment' | 'sensitive';

export function EmployeeWizardView() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';
  const t = useTranslations('HR');
  const tCommon = useTranslations('Common');

  const [step, setStep] = useState<Step>('identity');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeId: '',
    employmentType: 'permanent' as EmploymentType,
    employmentStatus: 'active' as EmploymentStatus,
    hireDate: '',
    branchId: '',
    departmentId: '',
    designationId: '',
    managerEmployeeId: '',
    workloadHours: '',
    dependantsCount: '0',
    cnssNumber: '',
    amoNumber: '',
    bankRib: '',
    contractType: 'cdi' as ContractType,
    nationalId: '',
    salary: '',
  });

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [designations, setDesignations] = useState<DesignationRow[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);

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

  const managerOptions = useMemo(
    () => employees.filter(x => x.id !== form.managerEmployeeId && x.employmentStatus === 'active'),
    [employees, form.managerEmployeeId],
  );

  const set = (key: keyof typeof form) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const stepValid: Record<Step, boolean> = {
    identity: form.firstName.trim().length > 0,
    employment: true,
    sensitive: true,
  };

  const next = () => {
    if (step === 'identity') setStep('employment');
    else if (step === 'employment') setStep('sensitive');
  };

  const back = () => {
    if (step === 'employment') setStep('identity');
    else if (step === 'sensitive') setStep('employment');
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

  const getContractLabel = (ct: ContractType) => {
    switch (ct) {
      case 'cdi': return t('contractCdi');
      case 'cdd': return t('contractCdd');
      case 'vacation': return t('contractVacation');
      default: return ct;
    }
  };

  const getStatusLabel = (st: EmploymentStatus) => {
    switch (st) {
      case 'active': return t('statusActive');
      case 'probation': return t('statusProbation');
      default: return st;
    }
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      firstName: form.firstName.trim() || null,
      lastName: form.lastName.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      employeeId: form.employeeId.trim() || null,
      employmentType: form.employmentType,
      employmentStatus: form.employmentStatus,
      hireDate: form.hireDate || null,
      branchId: form.branchId || null,
      departmentId: form.departmentId || null,
      designationId: form.designationId || null,
      managerEmployeeId: form.managerEmployeeId || null,
      workloadHours: form.workloadHours ? Number(form.workloadHours) : null,
      dependantsCount: Number(form.dependantsCount || 0),
      cnssNumber: form.cnssNumber.trim() || null,
      amoNumber: form.amoNumber.trim() || null,
      bankRib: form.bankRib.trim() || null,
      contractType: form.contractType,
      nationalId: form.nationalId.trim() || null,
      salary: form.salary.trim() || null,
    };
    const res = await api<EmployeeRow>('/api/hr/employees', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok && res.data?.id) {
      router.push(`/${locale}/dashboard/hr/employees/${res.data.id}`);
    } else {
      setError(res.error?.message ?? tCommon('error'));
    }
  };

  const steps: Array<{ key: Step; label: string }> = [
    { key: 'identity', label: t('stepIdentity') },
    { key: 'employment', label: t('stepEmployment') },
    { key: 'sensitive', label: t('stepSensitive') },
  ];

  const employmentTypes: EmploymentType[] = ['permanent', 'fixed_term', 'part_time', 'contractor', 'internship', 'substitute'];
  const contractTypes: ContractType[] = ['cdi', 'cdd', 'vacation'];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/dashboard/hr/employees`)} className="cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('wizardTitle')}</h1>
          <p className="text-sm text-slate-500">{t('wizardSubtitle')}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {steps.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => stepValid[s.key] && setStep(s.key)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
              step === s.key ? 'border-[#0066FF] bg-[#0066FF]/5 text-[#0066FF]' : 'border-slate-200 text-slate-500'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        {step === 'identity' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('firstName')} *</Label>
              <Input value={form.firstName} onChange={e => set('firstName')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('lastName')}</Label>
              <Input value={form.lastName} onChange={e => set('lastName')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('email')}</Label>
              <Input type="email" value={form.email} onChange={e => set('email')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('phone')}</Label>
              <Input value={form.phone} onChange={e => set('phone')(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('employeeId')}</Label>
              <Input value={form.employeeId} onChange={e => set('employeeId')(e.target.value)} />
            </div>
          </div>
        )}

        {step === 'employment' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('colType')}</Label>
              <Select value={form.employmentType} onValueChange={set('employmentType')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employmentTypes.map(typeItem => <SelectItem key={typeItem} value={typeItem}>{getTypeLabel(typeItem)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('colStatus')}</Label>
              <Select value={form.employmentStatus} onValueChange={set('employmentStatus')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['active', 'probation'] as EmploymentStatus[]).map(statusItem => (
                    <SelectItem key={statusItem} value={statusItem}>{getStatusLabel(statusItem)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('hireDate')}</Label>
              <Input type="date" value={form.hireDate} onChange={e => set('hireDate')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Succursale</Label>
              <Select value={form.branchId} onValueChange={set('branchId')}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('department')}</Label>
              <Select value={form.departmentId} onValueChange={set('departmentId')}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('designation')}</Label>
              <Select value={form.designationId} onValueChange={set('designationId')}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {designations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('manager')}</Label>
              <Select value={form.managerEmployeeId} onValueChange={set('managerEmployeeId')}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {managerOptions.map(e => <SelectItem key={e.id} value={e.id}>{e.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('workload')}</Label>
              <Input type="number" min={0} max={168} value={form.workloadHours} onChange={e => set('workloadHours')(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('dependants')}</Label>
              <Input type="number" min={0} max={20} value={form.dependantsCount} onChange={e => set('dependantsCount')(e.target.value)} />
            </div>
          </div>
        )}

        {step === 'sensitive' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('cnss')}</Label>
              <Input value={form.cnssNumber} onChange={e => set('cnssNumber')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('amo')}</Label>
              <Input value={form.amoNumber} onChange={e => set('amoNumber')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('rib')}</Label>
              <Input value={form.bankRib} onChange={e => set('bankRib')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('colType')}</Label>
              <Select value={form.contractType} onValueChange={set('contractType')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {contractTypes.map(c => <SelectItem key={c} value={c}>{getContractLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('nationalId')}</Label>
              <Input value={form.nationalId} onChange={e => set('nationalId')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('salary')}</Label>
              <Input value={form.salary} onChange={e => set('salary')(e.target.value)} />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" onClick={back} disabled={step === 'identity'} className="cursor-pointer">
            <ArrowLeft className="me-2 h-4 w-4" /> {t('btnPrevious')}
          </Button>
          {step === 'sensitive' ? (
            <Button onClick={submit} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />} <Save className="me-2 h-4 w-4" /> {t('btnSaveEmployee')}
            </Button>
          ) : (
            <Button onClick={next} disabled={!stepValid[step]} className="cursor-pointer">
              {t('btnNext')} <ArrowRight className="ms-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
