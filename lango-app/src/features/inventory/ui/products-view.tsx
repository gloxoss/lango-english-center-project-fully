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
  AlertCircle, Archive, Box, Loader2, Package, Pencil, Plus, Search, TriangleAlert,
} from 'lucide-react';

type StockByStore = { productId: string; storeId: string; storeName: string; storeCode: string; quantity: string };

type Row = {
  id: string; name: string; code: string; categoryId: string | null;
  purchaseUnitId: string | null; saleUnitId: string | null; unitRatio: string;
  purchasePrice: number | null; salePrice: number | null; remarks: string | null; isActive: boolean;
  stockByStore: StockByStore[]; totalStock: string; marginWarning: boolean;
};

type CategoryRef = { id: string; name: string };
type UnitRef = { id: string; name: string; abbreviation: string | null };

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

const fmtPrice = (v: number | null) => (v === null || v === undefined ? '—' : `${v.toLocaleString('fr-FR')} DH`);

export function ProductsView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [units, setUnits] = useState<UnitRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', code: '', categoryId: '', purchaseUnitId: '', saleUnitId: '',
    unitRatio: '1', purchasePrice: '', salePrice: '', remarks: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (showArchived) qs.set('archived', 'true');
    if (categoryFilter) qs.set('categoryId', categoryFilter);
    if (search.trim()) qs.set('search', search.trim());
    const res = await api<Row[]>(`/api/addons/inventory/products?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else setError(res.error?.message ?? 'Chargement impossible.');
    setLoading(false);
  }, [search, categoryFilter, showArchived]);

  const loadRefs = useCallback(async () => {
    const [catRes, unitRes] = await Promise.all([
      api<CategoryRef[]>('/api/addons/inventory/categories?status=active'),
      api<UnitRef[]>('/api/addons/inventory/units?status=active'),
    ]);
    if (catRes.ok && Array.isArray(catRes.data)) setCategories(catRes.data);
    if (unitRes.ok && Array.isArray(unitRes.data)) setUnits(unitRes.data);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => { loadRefs().catch(() => {}); }, [loadRefs]);

  const totalStockMilli = useMemo(() => rows.reduce((acc, r) => acc + Number(r.totalStock || 0), 0), [rows]);
  const lowStock = useMemo(() => rows.filter(r => (Number(r.totalStock || 0) <= 0)).length, [rows]);

  const catName = (id: string | null) => categories.find(c => c.id === id)?.name ?? '—';
  const unitName = (id: string | null) => {
    const u = units.find(u => u.id === id);
    return u ? (u.abbreviation || u.name) : '—';
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', categoryId: '', purchaseUnitId: '', saleUnitId: '', unitRatio: '1', purchasePrice: '', salePrice: '', remarks: '' });
    setModalOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      name: row.name, code: row.code, categoryId: row.categoryId ?? '', purchaseUnitId: row.purchaseUnitId ?? '',
      saleUnitId: row.saleUnitId ?? '', unitRatio: row.unitRatio || '1',
      purchasePrice: row.purchasePrice === null || row.purchasePrice === undefined ? '' : String(row.purchasePrice),
      salePrice: row.salePrice === null || row.salePrice === undefined ? '' : String(row.salePrice),
      remarks: row.remarks ?? '',
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
      categoryId: form.categoryId || null,
      purchaseUnitId: form.purchaseUnitId || null,
      saleUnitId: form.saleUnitId || null,
      unitRatio: form.unitRatio.trim() || '1',
      purchasePrice: form.purchasePrice.trim() === '' ? null : Number(form.purchasePrice),
      salePrice: form.salePrice.trim() === '' ? null : Number(form.salePrice),
      remarks: form.remarks.trim() || null,
    };
    const res = editing
      ? await api(`/api/addons/inventory/products/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/addons/inventory/products', { method: 'POST', body: JSON.stringify(body) });
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
    const res = await api(`/api/addons/inventory/products/${row.id}`, { method: 'DELETE' });
    if (res.ok) await load();
    else setError(res.error?.message ?? 'Archivage impossible.');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Produits</h1>
          <p className="text-sm text-slate-500">Catalogue des produits : le stock ne vit que dans le journal (voir Stock).</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouveau produit</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Package className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Produits</p><p className="text-2xl font-bold text-[#16212B]">{rows.length}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Box className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Stock total (unités)</p><p className="text-2xl font-bold text-[#16212B]">{totalStockMilli}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><TriangleAlert className="h-5 w-5" /></div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-slate-500">Ruptures</p>
              <button
                type="button"
                onClick={() => setShowArchived(v => !v)}
                className="text-left text-sm font-semibold text-[#2487B8] hover:underline"
              >
                {showArchived ? 'Voir actifs' : `Voir archivés (${lowStock})`}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un produit…"
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter || 'all'} onValueChange={v => setCategoryFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Toutes les catégories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun produit trouvé.</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Package className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#16212B]">
                      {row.name}
                      {row.marginWarning && (
                        <Badge variant="warning" className="gap-1"><TriangleAlert className="h-3 w-3" />Marge</Badge>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.code} · {catName(row.categoryId)}
                      {row.purchaseUnitId && row.saleUnitId && ` · ${unitName(row.purchaseUnitId)} → ${unitName(row.saleUnitId)}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      Achat {fmtPrice(row.purchasePrice)} · Vente {fmtPrice(row.salePrice)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={Number(row.totalStock || 0) > 0 ? 'info' : 'neutral'}>
                      Stock total : {row.totalStock || '0'}
                    </Badge>
                    <Badge variant={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Actif' : 'Archivé'}</Badge>
                  </div>
                  {row.stockByStore.length > 0 && (
                    <p className="max-w-md truncate text-right text-xs text-slate-400">
                      {row.stockByStore.map(b => `${b.storeName}: ${b.quantity}`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                  {row.isActive && (
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
          <DialogHeader><DialogTitle>{editing ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nom *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : Ramettes A4 80g" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Code *</label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex : PRD-001" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Catégorie</label>
              <Select value={form.categoryId || 'none'} onValueChange={v => setForm({ ...form, categoryId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Unité d&apos;achat</label>
                <Select value={form.purchaseUnitId || 'none'} onValueChange={v => setForm({ ...form, purchaseUnitId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Unité de vente</label>
                <Select value={form.saleUnitId || 'none'} onValueChange={v => setForm({ ...form, saleUnitId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ratio (vte/achat)</label>
                <Input value={form.unitRatio} onChange={e => setForm({ ...form, unitRatio: e.target.value })} placeholder="Ex : 1" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Prix d&apos;achat (DH)</label>
                <Input type="number" min={0} step="0.01" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} placeholder="Ex : 45.00" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Prix de vente (DH)</label>
                <Input type="number" min={0} step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} placeholder="Ex : 60.00" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Remarques</label>
              <Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} />
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
