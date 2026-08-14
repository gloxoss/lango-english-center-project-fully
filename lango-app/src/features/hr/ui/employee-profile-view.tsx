'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertCircle, ArrowLeft, Building2, Calendar, FileText, History, Loader2, Lock, Mail, Pencil, Phone, Save, UserRound, X,
} from 'lucide-react';
import { EmployeeDocumentsView } from '@/features/hr/ui/employee-documents-view';
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
  type EmploymentStatus, type EmploymentType,
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

function fmtDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-MA');
}

const EVENT_LABELS: Record<string, string> = {
  hired: 'Embauche',
  changed_department: 'Changement de département',
  changed_designation: 'Changement de poste',
  changed_manager: 'Changement de responsable',
  employment_status_change: 'Changement de statut',
  access_granted: 'Accès accordé',
  access_revoked: 'Accès révoqué',
  offboarded: 'Désactivation',
  reactivated: 'Réactivation',
  archived: 'Archivage',
  linked_account: 'Compte lié',
};

type Field = 'departmentId' | 'designationId' | 'managerEmployeeId' | 'employmentType' | 'employmentStatus' | 'hireDate' | 'contractStartDate' | 'contractEndDate' | 'workloadHours';

export function EmployeeProfileView({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [events, setEvents] = useState<EmploymentEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [designations, setDesignations] = useState<DesignationRow[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<Field, string>>({
    departmentId: '', designationId: '', managerEmployeeId: '',
    employmentType: '', employmentStatus: '', hireDate: '', contractStartDate: '', contractEndDate: '', workloadHours: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [emp, hist] = await Promise.all([
      api<EmployeeRow>(`/api/hr/employees/${employeeId}`),
      api<EmploymentEventRow[]>(`/api/hr/employees/${employeeId}/history`),
    ]);
    if (emp.ok && emp.data) setEmployee(emp.data);
    else setError(emp.error?.message ?? 'Employé introuvable.');
    if (hist.ok && Array.isArray(hist.data)) setEvents(hist.data);
    setLoading(false);
  }, [employeeId]);

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
      setEditError(res.error?.message ?? 'Enregistrement impossible.');
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
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-10 text-center">
        <p className="flex items-center justify-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error ?? 'Employé introuvable.'}</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/hr/employees')}>Retour à l&apos;annuaire</Button>
      </div>
    );
  }

  const manager = employees.find(e => e.id === employee.managerEmployeeId);
  const branch = branches.find(b => b.id === employee.branchId);
  const employeeTypes = Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/hr/employees')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#16212B]">Dossier employé</h1>
        </div>
        <Button onClick={openEdit}><Pencil className="mr-2 h-4 w-4" /> Modifier</Button>
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
                {EMPLOYMENT_STATUS_LABELS[employee.employmentStatus]}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="font-mono text-xs">{employee.employeeId || '—'}</span>
              {employee.departmentName && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{employee.departmentName}</span>}
              {employee.designationTitle && <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{employee.designationTitle}</span>}
              {branch && <span className="flex items-center gap-1">{branch.name}</span>}
            </div>
          </div>
          <div className="text-right">
            {employee.userId ? (
              <>
                <Badge className="bg-[#D1F5E8] text-[#0b5c3a]">Compte lié</Badge>
                <p className="mt-1 text-xs text-slate-500">{employee.accountEmail || employee.accountName}</p>
              </>
            ) : (
              <Badge className="bg-amber-50 text-amber-700">Sans compte</Badge>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" className="flex items-center gap-1"><UserRound className="h-4 w-4" /> Détails</TabsTrigger>
          <TabsTrigger value="sensitive" className="flex items-center gap-1"><Lock className="h-4 w-4" /> Données sensibles</TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1"><FileText className="h-4 w-4" /> Documents</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1"><History className="h-4 w-4" /> Chronologie</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Contact</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-slate-500"><Mail className="h-4 w-4" /> Email</dt><dd className="text-slate-700">{employee.email || '—'}</dd></div>
                <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-slate-500"><Phone className="h-4 w-4" /> Téléphone</dt><dd className="text-slate-700">{employee.phone || '—'}</dd></div>
              </dl>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Emploi</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">Type</dt><dd className="font-medium text-[#16212B]">{employee.employmentType ? EMPLOYMENT_TYPE_LABELS[employee.employmentType] : '—'}</dd></div>
                <div><dt className="text-slate-500">Responsable</dt><dd className="font-medium text-[#16212B]">{manager?.displayName ?? '—'}</dd></div>
                <div><dt className="text-slate-500">Embauche</dt><dd className="font-medium text-[#16212B]">{fmtDate(employee.hireDate)}</dd></div>
                <div><dt className="text-slate-500">Heures / sem.</dt><dd className="font-medium text-[#16212B]">{employee.workloadHours ?? '—'}</dd></div>
                <div><dt className="text-slate-500">Contrat</dt><dd className="font-medium text-[#16212B]">{employee.contractStartDate ? `${fmtDate(employee.contractStartDate)} → ${fmtDate(employee.contractEndDate)}` : '—'}</dd></div>
                <div><dt className="text-slate-500">À charge</dt><dd className="font-medium text-[#16212B]">{employee.dependantsCount ?? 0}</dd></div>
              </dl>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sensitive">
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            {sensitivePresent ? (
              <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                {employee.cnssNumber !== undefined && (
                  <div><dt className="text-slate-500">N° CNSS</dt><dd className="font-mono font-medium text-[#16212B]">{employee.cnssNumber ?? '—'}</dd></div>
                )}
                {employee.amoNumber !== undefined && (
                  <div><dt className="text-slate-500">N° AMO</dt><dd className="font-mono font-medium text-[#16212B]">{employee.amoNumber ?? '—'}</dd></div>
                )}
                {employee.bankRib !== undefined && (
                  <div><dt className="text-slate-500">RIB bancaire</dt><dd className="font-mono font-medium text-[#16212B]">{employee.bankRib ?? '—'}</dd></div>
                )}
                {employee.contractType !== undefined && (
                  <div><dt className="text-slate-500">Type de contrat</dt><dd className="font-medium text-[#16212B]">{employee.contractType ? CONTRACT_TYPE_LABELS[employee.contractType] : '—'}</dd></div>
                )}
                {employee.nationalId !== undefined && (
                  <div><dt className="text-slate-500">CIN</dt><dd className="font-mono font-medium text-[#16212B]">{employee.nationalId ?? '—'}</dd></div>
                )}
                {employee.salary !== undefined && (
                  <div><dt className="text-slate-500">Salaire mensuel</dt><dd className="font-medium text-[#16212B]">{employee.salary ? `${employee.salary} MAD` : '—'}</dd></div>
                )}
              </dl>
            ) : (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Lock className="h-4 w-4" /> Vous ne disposez pas de la permission de lecture des données sensibles.
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
              <p className="p-6 text-center text-sm text-slate-500">Aucun événement enregistré.</p>
            ) : (
              <ol className="relative space-y-5 border-l border-slate-200 pl-6">
                {events.map(ev => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[29px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#0066FF]" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#16212B]">{EVENT_LABELS[ev.eventType] ?? ev.eventType}</p>
                      <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="h-3.5 w-3.5" />{fmtDate(ev.effectiveAt)}</span>
                    </div>
                    {ev.reason && <p className="mt-1 text-xs text-slate-500">{ev.reason}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">Par {ev.actorName ?? ev.actorId}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier {employee.displayName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Département</Label>
              <Select value={form.departmentId} onValueChange={v => setForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Poste</Label>
              <Select value={form.designationId} onValueChange={v => setForm(f => ({ ...f, designationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {designations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Responsable</Label>
              <Select value={form.managerEmployeeId} onValueChange={v => setForm(f => ({ ...f, managerEmployeeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.id !== employeeId).map(e => <SelectItem key={e.id} value={e.id}>{e.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Type</Label>
              <Select value={form.employmentType} onValueChange={v => setForm(f => ({ ...f, employmentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employeeTypes.map(t => <SelectItem key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Statut</Label>
              <Select value={form.employmentStatus} onValueChange={v => setForm(f => ({ ...f, employmentStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EMPLOYMENT_STATUS_LABELS) as EmploymentStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{EMPLOYMENT_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Embauche</Label>
              <Input type="date" value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Début contrat</Label>
              <Input type="date" value={form.contractStartDate} onChange={e => setForm(f => ({ ...f, contractStartDate: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Fin contrat</Label>
              <Input type="date" value={form.contractEndDate} onChange={e => setForm(f => ({ ...f, contractEndDate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm font-medium text-slate-700">Heures hebdomadaires</Label>
              <Input type="number" min={0} max={168} value={form.workloadHours} onChange={e => setForm(f => ({ ...f, workloadHours: e.target.value }))} />
            </div>
            {editError && (
              <p className="flex items-center gap-1 text-sm text-red-600 sm:col-span-2"><AlertCircle className="h-4 w-4" />{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}><X className="mr-2 h-4 w-4" /> Annuler</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} <Save className="mr-2 h-4 w-4" /> Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
