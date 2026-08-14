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
  AlertCircle, Boxes, ClipboardList, Loader2, Minus, Plus, Search, Trash2, ArrowLeftRight,
} from 'lucide-react';

type Row = {
  id: string; adjustmentNumber: string; storeId: string; storeName: string;
  type: 'count_correction' | 'damage' | 'loss' | 'donation' | 'write_off';
  reason: string | null; note: string | null; status: string;
  createdById: string | null; createdAt: string; updatedAt: string;
};

type StoreRef = { id: string; name: string; code: string | null; status: string };
type ProductRef = { id: string; name: string; code: string; salePrice: number | null };

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

const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');

const TYPE_LABEL: Record<Row['type'], string> = {
  count_correction: 'Correction de stock', damage: 'Abîmé', loss: 'Perte', donation: 'Don', write_off: 'Mise au rebut',
};
const TYPE_VARIANT: Record<Row['type'], 'info' | 'warning' | 'danger' | 'success' | 'neutral'> = {
  count_correction: 'info', damage: 'warning', loss: 'danger', donation: 'success', write_off: 'neutral',
};
const DIRECTION_LABEL: Record<string, string> = { in: 'Entrée', out: 'Sortie' };

type LineForm = { productId: string; direction: 'in' | 'out'; qty: string };

export function AdjustmentsView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    storeId: '', type: 'count_correction', reason: '', note: '',
  });
  const [lines, setLines] = useState<LineForm[]>([{ productId: '', direction: 'in', qty: '1' }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (typeFilter) qs.set('type', typeFilter);
    const res = await api<Row[]>(`/api/addons/inventory/adjustments?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) {
      setRows(
        search.trim()
          ? res.data.filter(r => `${r.adjustmentNumber} ${r.storeName} ${r.reason ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
          : res.data,
      );
    } else setError(res.error?.message ?? 'Chargement impossible.');
    setLoading(false);
  }, [search, typeFilter]);

  const loadRefs = useCallback(async () => {
    const [storeRes, prodRes] = await Promise.all([
      api<StoreRef[]>('/api/addons/inventory/stores?status=active'),
      api<ProductRef[]>('/api/addons/inventory/products?status=active'),
    ]);
    if (storeRes.ok && Array.isArray(storeRes.data)) setStores(storeRes.data);
    if (prodRes.ok && Array.isArray(prodRes.data)) setProducts(prodRes.data);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => { loadRefs().catch(() => {}); }, [loadRefs]);

  const counts = useMemo(() => ({
    total: rows.length,
    inventory: rows.filter(r => r.type === 'count_correction').length,
    losses: rows.filter(r => r.type === 'loss' || r.type === 'damage').length,
    others: rows.filter(r => r.type === 'donation' || r.type === 'write_off').length,
  }), [rows]);

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const openCreate = () => {
    setForm({ storeId: '', type: 'count_correction', reason: '', note: '' });
    setLines([{ productId: '', direction: 'in', qty: '1' }]);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.storeId) return;
    const validLines = lines.filter(l => l.productId && l.qty.trim());
    if (validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const body = {
      storeId: form.storeId,
      type: form.type,
      reason: form.reason.trim() || null,
      note: form.note.trim() || null,
      lines: validLines.map(l => ({ productId: l.productId, direction: l.direction, qty: l.qty.trim() })),
    };
    const res = await api('/api/addons/inventory/adjustments', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Ajustements de stock</h1>
          <p className="text-sm text-slate-500">Corrections d&apos;inventaire, pertes, dons et mises au rebut — appliquées immédiatement.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouvel ajustement</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><ClipboardList className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Ajustements</p><p className="text-2xl font-bold text-[#16212B]">{counts.total}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Boxes className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Inventaires</p><p className="text-2xl font-bold text-[#16212B]">{counts.inventory}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Trash2 className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Pertes / Abîmés</p><p className="text-2xl font-bold text-[#16212B]">{counts.losses}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><ArrowLeftRight className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Dons / Rebuts</p><p className="text-2xl font-bold text-[#16212B]">{counts.others}</p></div>
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
                placeholder="Rechercher (N°, magasin, motif)…"
                className="pl-9"
              />
            </div>
            <Select value={typeFilter || 'all'} onValueChange={v => setTypeFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Tous les types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="count_correction">Correction de stock</SelectItem>
                <SelectItem value="damage">Abîmé</SelectItem>
                <SelectItem value="loss">Perte</SelectItem>
                <SelectItem value="donation">Don</SelectItem>
                <SelectItem value="write_off">Mise au rebut</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun ajustement trouvé.</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><ClipboardList className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#16212B]">
                      {row.adjustmentNumber}
                      <Badge variant={TYPE_VARIANT[row.type]}>{TYPE_LABEL[row.type]}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.storeName} · {fmtDate(row.createdAt)}
                      {row.reason && ` · ${row.reason}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{row.note ?? '—'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouvel ajustement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Magasin *</label>
                <Select value={form.storeId} onValueChange={v => setForm({ ...form, storeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Type *</label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count_correction">Correction de stock</SelectItem>
                    <SelectItem value="damage">Abîmé</SelectItem>
                    <SelectItem value="loss">Perte</SelectItem>
                    <SelectItem value="donation">Don</SelectItem>
                    <SelectItem value="write_off">Mise au rebut</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Raison</label>
                <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Raison de l'ajustement" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
                <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Note complémentaire" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Lignes *</label>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={line.productId} onValueChange={v => updateLine(i, { productId: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Produit" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={line.direction} onValueChange={v => updateLine(i, { direction: v as 'in' | 'out' })}>
                      <SelectTrigger className="w-32">
                        <SelectValue>{line.direction === 'in' ? <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Entrée</span> : <span className="flex items-center gap-1"><Minus className="h-3 w-3" /> Sortie</span>}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">Entrée (+)</SelectItem>
                        <SelectItem value="out">Sortie (−)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" min={0} step="0.001" className="w-24" placeholder="Qté"
                      value={line.qty}
                      onChange={e => updateLine(i, { qty: e.target.value })}
                    />
                    <Button
                      variant="ghost" size="icon" disabled={lines.length === 1}
                      onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm"
                  onClick={() => setLines(prev => [...prev, { productId: '', direction: 'in', qty: '1' }])}
                >
                  <Plus className="mr-1 h-4 w-4" /> Ajouter une ligne
                </Button>
              </div>
            </div>

            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={save}
              disabled={saving || !form.storeId || !lines.some(l => l.productId && l.qty.trim())}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Appliquer l&apos;ajustement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
