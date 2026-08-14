'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, Archive, Loader2, Pencil, Plus, Ruler, Search,
} from 'lucide-react';

type Row = { id: string; name: string; abbreviation: string | null; status: string };

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

export function UnitsView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', abbreviation: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    qs.set('status', showArchived ? 'archived' : 'active');
    if (search.trim()) qs.set('search', search.trim());
    const res = await api<Row[]>(`/api/addons/inventory/units?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else setError(res.error?.message ?? 'Chargement impossible.');
    setLoading(false);
  }, [search, showArchived]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', abbreviation: '' });
    setModalOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({ name: row.name, abbreviation: row.abbreviation ?? '' });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const body = { name: form.name.trim(), abbreviation: form.abbreviation.trim() || null };
    const res = editing
      ? await api(`/api/addons/inventory/units/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/addons/inventory/units', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const archive = async (row: Row) => {
    setError(null);
    const res = await api(`/api/addons/inventory/units/${row.id}`, { method: 'DELETE' });
    if (res.ok) await load();
    else setError(res.error?.message ?? 'Archivage impossible.');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Unités</h1>
          <p className="text-sm text-slate-500">Unités de mesure pour les achats et les ventes.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouvelle unité</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Ruler className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Unités actives</p><p className="text-2xl font-bold text-[#16212B]">{rows.length}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Archive className="h-5 w-5" /></div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-slate-500">Statut</p>
              <button
                type="button"
                onClick={() => setShowArchived(v => !v)}
                className="text-left text-sm font-semibold text-[#2487B8] hover:underline"
              >
                {showArchived ? 'Voir actives' : 'Voir archivées'}
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
              placeholder="Rechercher une unité…"
              className="pl-9"
            />
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucune unité trouvée.</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Ruler className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{row.name}</p>
                    {row.abbreviation && <p className="text-xs text-slate-500">Abréviation : {row.abbreviation}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>{row.status === 'active' ? 'Actif' : 'Archivé'}</Badge>
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
          <DialogHeader><DialogTitle>{editing ? 'Modifier l\'unité' : 'Nouvelle unité'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nom *</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : Kilogramme" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Abréviation</label>
              <Input value={form.abbreviation} onChange={e => setForm({ ...form, abbreviation: e.target.value })} placeholder="Ex : KG" />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
