'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, BedDouble, Building2, Loader2, Pencil, Plus, Search, Users,
} from 'lucide-react';
import Link from 'next/link';
import { api, errMessage } from './api';

type HostelRow = {
  id: string;
  branchId: string | null;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  genderPolicy: 'mixed' | 'male_only' | 'female_only';
  ageMin: number | null;
  ageMax: number | null;
  wardenEmployeeId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: string;
  branchName?: string | null;
};

const GENDER_LABELS: Record<string, string> = {
  mixed: 'Mixte',
  male_only: 'Garçons',
  female_only: 'Filles',
};

export function HostelsView() {
  const [rows, setRows] = useState<HostelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HostelRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    genderPolicy: 'mixed',
    ageMin: '',
    ageMax: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    status: 'active',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<HostelRow[]>('/api/addons/hostel/hostels');
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const filtered = rows.filter(r =>
    !search.trim() || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '', name: '', address: '', phone: '', email: '',
      genderPolicy: 'mixed', ageMin: '', ageMax: '',
      emergencyContactName: '', emergencyContactPhone: '', status: 'active',
    });
    setModalOpen(true);
  };

  const openEdit = (row: HostelRow) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      address: row.address ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      genderPolicy: row.genderPolicy,
      ageMin: row.ageMin != null ? String(row.ageMin) : '',
      ageMax: row.ageMax != null ? String(row.ageMax) : '',
      emergencyContactName: row.emergencyContactName ?? '',
      emergencyContactPhone: row.emergencyContactPhone ?? '',
      status: row.status,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      genderPolicy: form.genderPolicy,
      ageMin: form.ageMin ? Number(form.ageMin) : null,
      ageMax: form.ageMax ? Number(form.ageMax) : null,
      emergencyContactName: form.emergencyContactName.trim() || null,
      emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      status: form.status,
    };
    const res = editing
      ? await api(`/api/addons/hostel/hostels/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/addons/hostel/hostels', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(errMessage(res));
    }
  };

  const totalBeds = rows.reduce((acc, r) => acc + Number((r as HostelRow & { capacity?: number }).capacity ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Résidences</h1>
          <p className="text-sm text-slate-500">Bâtiments d&apos;internat, politique de genre et contacts d&apos;urgence.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouvelle résidence</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Building2 className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Résidences</p><p className="text-2xl font-bold text-[#16212B]">{rows.length}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Capacité totale</p><p className="text-2xl font-bold text-[#16212B]">{totalBeds}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Users className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Résidences actives</p><p className="text-2xl font-bold text-[#16212B]">{rows.filter(r => r.status === 'active').length}</p></div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une résidence…" className="pl-9" />
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucune résidence trouvée.</div>
          ) : (
            filtered.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Building2 className="h-5 w-5" /></div>
                  <div>
                    <Link href={`/dashboard/hostel/hostels/${row.id}`} className="font-semibold text-[#16212B] hover:text-[#2487B8] hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {row.code} · {GENDER_LABELS[row.genderPolicy] ?? row.genderPolicy}
                      {row.branchName ? ` · ${row.branchName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={row.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {row.status === 'active' ? 'Actif' : row.status === 'inactive' ? 'Inactif' : 'Archivé'}
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
            <DialogTitle>{editing ? `Modifier ${editing.name}` : 'Nouvelle résidence'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Code *</label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex : HST-A" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nom *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : Résidence Atlas" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Adresse</label>
              <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Téléphone</label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Politique de genre</label>
                <Select value={form.genderPolicy} onValueChange={v => setForm({ ...form, genderPolicy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixte</SelectItem>
                    <SelectItem value="male_only">Garçons uniquement</SelectItem>
                    <SelectItem value="female_only">Filles uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                    <SelectItem value="archived">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Âge min.</label>
                <Input type="number" value={form.ageMin} onChange={e => setForm({ ...form, ageMin: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Âge max.</label>
                <Input type="number" value={form.ageMax} onChange={e => setForm({ ...form, ageMax: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Contact urgence (nom)</label>
                <Input value={form.emergencyContactName} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Contact urgence (tél.)</label>
                <Input value={form.emergencyContactPhone} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} />
              </div>
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.code.trim() || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
