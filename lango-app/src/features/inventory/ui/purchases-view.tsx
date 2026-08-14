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
  AlertCircle, ArrowDownToLine, CalendarDays, Loader2, Package, Plus, Search, Truck, Undo2, Wallet,
} from 'lucide-react';

type Row = {
  id: string; purchaseNumber: string; supplierId: string; supplierName: string;
  storeId: string; storeName: string; status: 'ordered' | 'received' | 'reversed';
  orderDate: string; receivedAt: string | null; netAmount: number; paidAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'check' | null;
  paymentReference: string | null;
  expenseId: string | null; notes: string | null;
};

type SupplierRef = { id: string; name: string; status: string };
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

const fmtPrice = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toLocaleString('fr-FR')} DH`);
const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');

const STATUS_LABEL: Record<Row['status'], string> = { ordered: 'Commandée', received: 'Réceptionnée', reversed: 'Annulée' };
const STATUS_VARIANT: Record<Row['status'], 'warning' | 'success' | 'neutral'> = { ordered: 'warning', received: 'success', reversed: 'neutral' };
const PAY_LABEL: Record<Row['paymentStatus'], string> = { unpaid: 'Impayée', partial: 'Partielle', paid: 'Payée' };
const PAY_VARIANT: Record<Row['paymentStatus'], 'danger' | 'warning' | 'success'> = { unpaid: 'danger', partial: 'warning', paid: 'success' };
const PAY_METHOD_LABEL: Record<string, string> = { cash: 'Espèces', card: 'Carte', transfer: 'Virement', check: 'Chèque' };

type LineForm = { productId: string; qtyInPurchaseUnit: string; unitCost: string };

export function PurchasesView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRef[]>([]);
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplierId: '', storeId: '', orderDate: new Date().toISOString().slice(0, 10), notes: '',
    paidAmount: '', paymentMethod: '', paymentReference: '',
  });
  const [lines, setLines] = useState<LineForm[]>([{ productId: '', qtyInPurchaseUnit: '1', unitCost: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    const res = await api<Row[]>(`/api/addons/inventory/purchases?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) {
      setRows(
        search.trim()
          ? res.data.filter(r => `${r.purchaseNumber} ${r.supplierName} ${r.storeName}`.toLowerCase().includes(search.trim().toLowerCase()))
          : res.data,
      );
    } else setError(res.error?.message ?? 'Chargement impossible.');
    setLoading(false);
  }, [search, statusFilter]);

  const loadRefs = useCallback(async () => {
    const [supRes, storeRes, prodRes] = await Promise.all([
      api<SupplierRef[]>('/api/addons/inventory/suppliers?status=active'),
      api<StoreRef[]>('/api/addons/inventory/stores?status=active'),
      api<ProductRef[]>('/api/addons/inventory/products?status=active'),
    ]);
    if (supRes.ok && Array.isArray(supRes.data)) setSuppliers(supRes.data);
    if (storeRes.ok && Array.isArray(storeRes.data)) setStores(storeRes.data);
    if (prodRes.ok && Array.isArray(prodRes.data)) setProducts(prodRes.data);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => { loadRefs().catch(() => {}); }, [loadRefs]);

  const counts = useMemo(() => ({
    total: rows.length,
    received: rows.filter(r => r.status === 'received').length,
    ordered: rows.filter(r => r.status === 'ordered').length,
    unpaidTotal: rows.filter(r => r.status === 'received' && r.paymentStatus === 'unpaid').length,
  }), [rows]);

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const openCreate = () => {
    setForm({ supplierId: '', storeId: '', orderDate: new Date().toISOString().slice(0, 10), notes: '', paidAmount: '', paymentMethod: '', paymentReference: '' });
    setLines([{ productId: '', qtyInPurchaseUnit: '1', unitCost: '' }]);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.supplierId || !form.storeId || !form.orderDate) return;
    const validLines = lines.filter(l => l.productId && l.qtyInPurchaseUnit.trim() && l.unitCost.trim() !== '');
    if (validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const body = {
      supplierId: form.supplierId,
      storeId: form.storeId,
      orderDate: form.orderDate,
      notes: form.notes.trim() || null,
      paidAmount: form.paidAmount.trim() === '' ? null : Number(form.paidAmount),
      paymentMethod: form.paymentMethod || null,
      paymentReference: form.paymentReference.trim() || null,
      lines: validLines.map(l => ({ productId: l.productId, qtyInPurchaseUnit: l.qtyInPurchaseUnit.trim(), unitCost: Number(l.unitCost) })),
    };
    const res = await api('/api/addons/inventory/purchases', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const receive = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/purchases/${row.id}/receive`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) await load();
    else setError(res.error?.message ?? 'Réception impossible.');
  };

  const reverse = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/purchases/${row.id}/reverse`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) await load();
    else setError(res.error?.message ?? 'Annulation impossible.');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Achats</h1>
          <p className="text-sm text-slate-500">Commandes fournisseur : le stock n&apos;entre qu&apos;à la réception.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouvel achat</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Truck className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Commandes</p><p className="text-2xl font-bold text-[#16212B]">{counts.total}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><ArrowDownToLine className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Réceptionnées</p><p className="text-2xl font-bold text-[#16212B]">{counts.received}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><CalendarDays className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">En attente</p><p className="text-2xl font-bold text-[#16212B]">{counts.ordered}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Wallet className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Réceptions impayées</p><p className="text-2xl font-bold text-[#16212B]">{counts.unpaidTotal}</p></div>
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
                placeholder="Rechercher (N°, fournisseur, magasin)…"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="ordered">Commandée</SelectItem>
                <SelectItem value="received">Réceptionnée</SelectItem>
                <SelectItem value="reversed">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucune commande trouvée.</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Truck className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#16212B]">
                      {row.purchaseNumber}
                      <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                      <Badge variant={PAY_VARIANT[row.paymentStatus]}>{PAY_LABEL[row.paymentStatus]}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.supplierName} · {row.storeName} · Commande du {fmtDate(row.orderDate)}
                      {row.receivedAt && ` · Reçue le ${fmtDate(row.receivedAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#16212B]">{fmtPrice(row.netAmount)}</p>
                    <p className="text-xs text-slate-400">
                      {row.paymentMethod ? PAY_METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod : '—'}
                      {row.paymentReference ? ` · ${row.paymentReference}` : ''}
                    </p>
                  </div>
                  {row.status === 'ordered' && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => reverse(row)} disabled={busyId === row.id}>
                        {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="mr-1 h-4 w-4" />} Annuler
                      </Button>
                      <Button size="sm" onClick={() => receive(row)} disabled={busyId === row.id}>
                        {busyId === row.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-1 h-4 w-4" />} Réceptionner
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouvel achat</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fournisseur *</label>
                <Select value={form.supplierId} onValueChange={v => setForm({ ...form, supplierId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Magasin *</label>
                <Select value={form.storeId} onValueChange={v => setForm({ ...form, storeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date de commande *</label>
              <Input type="date" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} />
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
                    <Input
                      type="number" min={0} step="0.001" className="w-24" placeholder="Qté"
                      value={line.qtyInPurchaseUnit}
                      onChange={e => updateLine(i, { qtyInPurchaseUnit: e.target.value })}
                    />
                    <Input
                      type="number" min={0} step="0.01" className="w-28" placeholder="Coût unit."
                      value={line.unitCost}
                      onChange={e => updateLine(i, { unitCost: e.target.value })}
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
                  onClick={() => setLines(prev => [...prev, { productId: '', qtyInPurchaseUnit: '1', unitCost: '' }])}
                >
                  <Plus className="mr-1 h-4 w-4" /> Ajouter une ligne
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Paiement (DH)</label>
                <Input type="number" min={0} step="0.01" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Moyen</label>
                <Select value={form.paymentMethod || 'none'} onValueChange={v => setForm({ ...form, paymentMethod: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="card">Carte</SelectItem>
                    <SelectItem value="transfer">Virement</SelectItem>
                    <SelectItem value="check">Chèque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Réf. paiement</label>
                <Input value={form.paymentReference} onChange={e => setForm({ ...form, paymentReference: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={save}
              disabled={saving || !form.supplierId || !form.storeId || !form.orderDate || !lines.some(l => l.productId && l.qtyInPurchaseUnit.trim() && l.unitCost.trim() !== '')}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Créer la commande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
