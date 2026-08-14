'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, Archive, BadgeCheck, Briefcase, Loader2, Pencil, Plus, Search, Users,
} from 'lucide-react';

type DesignationRow = {
  id: string;
  departmentId: string | null;
  title: string;
  code: string | null;
  description: string | null;
  status: string;
  employeeCount: number;
};

type DepartmentRef = { id: string; name: string };

type ApiErrorShape = { code?: string; message?: string };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

export function DesignationsView() {
  const [rows, setRows] = useState<DesignationRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DesignationRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    code: '',
    departmentId: '',
    description: '',
    status: 'active',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (showArchived) qs.set('status', 'archived');
    else qs.set('status', 'active');
    if (search.trim()) qs.set('search', search.trim());
    const res = await api<DesignationRow[]>(`/api/hr/designations?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else setError(res.error?.message ?? 'Chargement impossible.');
    setLoading(false);
  }, [search, showArchived]);

  const loadDepartments = useCallback(async () => {
    const res = await api<DepartmentRef[]>('/api/hr/departments?status=active');
    if (res.ok && Array.isArray(res.data)) setDepartments(res.data);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => { loadDepartments().catch(() => {}); }, [loadDepartments]);

  const total = rows.length;
  const headcount = useMemo(() => rows.reduce((acc, r) => acc + Number(r.employeeCount || 0), 0), [rows]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', code: '', departmentId: '', description: '', status: 'active' });
    setModalOpen(true);
  };

  const openEdit = (row: DesignationRow) => {
    setEditing(row);
    setForm({ title: row.title, code: row.code ?? '', departmentId: row.departmentId ?? '', description: row.description ?? '', status: row.status });
    setModalOpen(true);
  };

  const deptName = (id: string | null) => departments.find(d => d.id === id)?.name ?? '—';

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    const body = {
      title: form.title.trim(),
      code: form.code.trim() || null,
      departmentId: form.departmentId || null,
      description: form.description.trim() || null,
      status: form.status,
    };
    const res = editing
      ? await api(`/api/hr/designations/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/hr/designations', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const archive = async (row: DesignationRow) => {
    setError(null);
    const res = await api(`/api/hr/designations/${row.id}`, { method: 'DELETE' });
    if (res.ok) {
      await load();
    } else {
      setError(res.error?.message ?? 'Archivage impossible.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Postes &amp; fonctions</h1>
          <p className="text-sm text-slate-500">Référentiel des postes. Distinct des permissions applicatives.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouveau poste</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Briefcase className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Postes</p><p className="text-2xl font-bold text-[#16212B]">{total}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Users className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Employés rattachés</p><p className="text-2xl font-bold text-[#16212B]">{headcount}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><BadgeCheck className="h-5 w-5" /></div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-slate-500">Statut</p>
              <button
                type="button"
                onClick={() => setShowArchived(v => !v)}
                className="text-left text-sm font-semibold text-[#2487B8] hover:underline"
              >
                {showArchived ? 'Voir actifs' : 'Voir archivés'}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un poste…"
              className="pl-9"
            />
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun poste trouvé.</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Briefcase className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{row.title}</p>
                    <p className="text-xs text-slate-500">
                      {row.code || '—'} · {deptName(row.departmentId)}
                      {row.description ? ` · ${row.description}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-slate-100 text-slate-600">{row.employeeCount} employé(s)</Badge>
                  <Badge className={row.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {row.status === 'active' ? 'Actif' : 'Archivé'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                  {row.status === 'active' && (
                    <Button variant="ghost" size="icon" onClick={() => archive(row)}><Archive className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le poste' : 'Nouveau poste'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Titre *</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex : Coordinateur pédagogique" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex : COORD" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Département</label>
              <Select value={form.departmentId || 'none'} onValueChange={v => setForm({ ...form, departmentId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
