'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Save } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, CONTRACT_TYPE_LABELS,
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

const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[];
const CONTRACT_TYPES = Object.keys(CONTRACT_TYPE_LABELS) as ContractType[];

export function EmployeeWizardView() {
  const router = useRouter();
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
      router.push(`/dashboard/hr/employees/${res.data.id}`);
    } else {
      setError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const steps: Array<{ key: Step; label: string }> = [
    { key: 'identity', label: 'Identité' },
    { key: 'employment', label: 'Emploi' },
    { key: 'sensitive', label: 'Données sensibles' },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/hr/employees')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Nouvel employé</h1>
          <p className="text-sm text-slate-500">Créez un dossier personnel. Le compte utilisateur peut être lié ultérieurement.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {steps.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => stepValid[s.key] && setStep(s.key)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
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
              <Label className="mb-1 block text-sm font-medium text-slate-700">Prénom *</Label>
              <Input value={form.firstName} onChange={e => set('firstName')(e.target.value)} placeholder="Ex : Salma" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Nom</Label>
              <Input value={form.lastName} onChange={e => set('lastName')(e.target.value)} placeholder="Ex : Benali" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email')(e.target.value)} placeholder="prenom.nom@etablissement.ma" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Téléphone</Label>
              <Input value={form.phone} onChange={e => set('phone')(e.target.value)} placeholder="+212 6 00 00 00 00" />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm font-medium text-slate-700">Matricule (optionnel)</Label>
              <Input value={form.employeeId} onChange={e => set('employeeId')(e.target.value)} placeholder="Laissé vide = généré automatiquement" />
            </div>
          </div>
        )}

        {step === 'employment' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Type de contrat</Label>
              <Select value={form.employmentType} onValueChange={set('employmentType')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Statut</Label>
              <Select value={form.employmentStatus} onValueChange={set('employmentStatus')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EMPLOYMENT_STATUS_LABELS) as EmploymentStatus[])
                    .filter(s => s === 'active' || s === 'probation')
                    .map(s => <SelectItem key={s} value={s}>{EMPLOYMENT_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Date d&apos;embauche</Label>
              <Input type="date" value={form.hireDate} onChange={e => set('hireDate')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Succursale</Label>
              <Select value={form.branchId} onValueChange={set('branchId')}>
                <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Département</Label>
              <Select value={form.departmentId} onValueChange={set('departmentId')}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Poste</Label>
              <Select value={form.designationId} onValueChange={set('designationId')}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {designations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Responsable hiérarchique</Label>
              <Select value={form.managerEmployeeId} onValueChange={set('managerEmployeeId')}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {managerOptions.map(e => <SelectItem key={e.id} value={e.id}>{e.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Heures hebdomadaires</Label>
              <Input type="number" min={0} max={168} value={form.workloadHours} onChange={e => set('workloadHours')(e.target.value)} placeholder="Ex : 35" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Personnes à charge</Label>
              <Input type="number" min={0} max={20} value={form.dependantsCount} onChange={e => set('dependantsCount')(e.target.value)} />
            </div>
          </div>
        )}

        {step === 'sensitive' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">N° CNSS</Label>
              <Input value={form.cnssNumber} onChange={e => set('cnssNumber')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">N° AMO</Label>
              <Input value={form.amoNumber} onChange={e => set('amoNumber')(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">RIB bancaire</Label>
              <Input value={form.bankRib} onChange={e => set('bankRib')(e.target.value)} placeholder="xx xxx xxx xxx xxxxxxxx xx" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Type de contrat</Label>
              <Select value={form.contractType} onValueChange={set('contractType')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map(t => <SelectItem key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">CIN</Label>
              <Input value={form.nationalId} onChange={e => set('nationalId')(e.target.value)} placeholder="Ex : AB123456" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Salaire mensuel (MAD)</Label>
              <Input value={form.salary} onChange={e => set('salary')(e.target.value)} placeholder="Ex : 8500.00" />
            </div>
            <p className="flex items-start gap-2 text-xs text-slate-500 sm:col-span-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Ces données ne sont visibles que par les profils disposant de la permission de lecture des données sensibles.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />{error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" onClick={back} disabled={step === 'identity'}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Button>
          {step === 'sensitive' ? (
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} <Save className="mr-2 h-4 w-4" /> Enregistrer
            </Button>
          ) : (
            <Button onClick={next} disabled={!stepValid[step]}>
              Suivant <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
