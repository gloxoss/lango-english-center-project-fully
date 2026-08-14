'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, BedDouble, Loader2, Pencil, Plus, Search,
} from 'lucide-react';
import { api, errMessage } from './api';

type CategoryRow = {
  id: string;
  name: string;
  code: string;
  defaultCapacity: number | null;
  eligibleGenderPolicy: 'mixed' | 'male_only' | 'female_only';
  baseCharge: string;
  depositAmount: string;
  priority: number;
  isAccessible: boolean;
  status: 'active' | 'archived';
};

const GENDER_LABELS: Record<string, string> = {
  mixed: 'Mixte',
  male_only: 'Garçons',
  female_only: 'Filles',
};

const emptyForm = {
  name: '',
  code: '',
  defaultCapacity: '',
  eligibleGenderPolicy: 'mixed',
  baseCharge: '0',
  depositAmount: '0',
  priority: '0',
  isAccessible: false,
  status: 'active',
};

export function CategoriesView() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<CategoryRow[]>('/api/addons/hostel/categories');
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const filtered = rows.filter(r =>
    !search.trim() || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: CategoryRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code,
      defaultCapacity: row.defaultCapacity != null ? String(row.defaultCapacity) : '',
      eligibleGenderPolicy: row.eligibleGenderPolicy,
      baseCharge: row.baseCharge,
      depositAmount: row.depositAmount,
      priority: String(row.priority),
      isAccessible: row.isAccessible,
      status: row.status,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    setError(null);
    const body = {
      name: form.name.trim(),
      code: form.code.trim(),
      defaultCapacity: form.defaultCapacity ? Number(form.defaultCapacity) : null,
      eligibleGenderPolicy: form.eligibleGenderPolicy,
      baseCharge: form.baseCharge.trim() || '0',
      depositAmount: form.depositAmount.trim() || '0',
      priority: Number(form.priority) || 0,
      isAccessible: form.isAccessible,
      status: form.status,
    };
    const res = editing
      ? await api(`/api/addons/hostel/categories/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/addons/hostel/categories', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(errMessage(res));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Catégories de chambres</h1>
          <p className="text-sm text-slate-500">Catégories, politique de genre, capacité et tarifs de référence.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouvelle catégorie</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Catégories</p><p className="text-2xl font-bold text-[#16212B]">{rows.length}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Catégories actives</p><p className="text-2xl font-bold text-[#16212B]">{rows.filter(r => r.status === 'active').length}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Accessibles PMR</p><p className="text-2xl font-bold text-[#16212B]">{rows.filter(r => r.isAccessible).length}</p></div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une catégorie…" className="pl-9" />
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucune catégorie trouvée.</div>
          ) : (
            filtered.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><BedDouble className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.code} · {GENDER_LABELS[row.eligibleGenderPolicy] ?? row.eligibleGenderPolicy}
                      {row.defaultCapacity ? ` · capacité ${row.defaultCapacity}` : ''}
                      {row.isAccessible ? ' · PMR' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-[#16212B]">{Number(row.baseCharge).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 })}</p>
                  <Badge className={row.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {row.status === 'active' ? 'Actif' : 'Archivé'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier ${editing.name}` : 'Nouvelle catégorie'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nom *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : Standard" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Code *</label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex : STD" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Capacité par défaut</label>
                <Input type="number" value={form.defaultCapacity} onChange={e => setForm({ ...form, defaultCapacity: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Priorité</label>
                <Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Politique de genre</label>
                <Select value={form.eligibleGenderPolicy} onValueChange={v => setForm({ ...form, eligibleGenderPolicy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixte</SelectItem>
                    <SelectItem value="male_only">Garçons</SelectItem>
                    <SelectItem value="female_only">Filles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tarif base (MAD)</label>
                <Input value={form.baseCharge} onChange={e => setForm({ ...form, baseCharge: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Caution (MAD)</label>
                <Input value={form.depositAmount} onChange={e => setForm({ ...form, depositAmount: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="accessible" checked={form.isAccessible} onCheckedChange={(v) => setForm({ ...form, isAccessible: v === true })} />
              <label htmlFor="accessible" className="text-sm text-slate-700">Chambre accessible (PMR)</label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.name.trim() || !form.code.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
