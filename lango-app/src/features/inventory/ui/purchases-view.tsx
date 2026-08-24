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
  AlertCircle,
  ArrowDownToLine,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Truck,
  Undo2,
  Wallet,
  Wand2,
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

type SuggestionItem = {
  productId: string;
  productName: string;
  productCode: string;
  currentStock: number;
  reorderThreshold: number;
  suggestedQuantity: number;
  unitCost: number;
  estimatedTotal: number;
  defaultSupplierId: string | null;
  defaultSupplierName: string | null;
  targetStoreId: string | null;
  targetStoreName: string | null;
};

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
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Auto-Purchase suggestions state (§14.3)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [generatingPos, setGeneratingPos] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, boolean>>({});

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

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    const res = await api<{ suggestions: SuggestionItem[] }>('/api/addons/inventory/purchases/suggestions');
    if (res.ok && res.data?.suggestions) {
      setSuggestions(res.data.suggestions);
      const initialMap: Record<string, boolean> = {};
      for (const s of res.data.suggestions) initialMap[s.productId] = true;
      setSelectedSuggestions(initialMap);
    }
    setSuggestionsLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => { loadRefs().catch(() => {}); }, [loadRefs]);
  useEffect(() => { loadSuggestions().catch(() => {}); }, [loadSuggestions]);

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
      setSuccessBanner('Commande d\'achat créée avec succès.');
      setTimeout(() => setSuccessBanner(null), 4000);
      await load();
      await loadSuggestions();
    } else {
      setError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const receive = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/purchases/${row.id}/receive`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) {
      setSuccessBanner(`Commande ${row.purchaseNumber} réceptionnée et intégrée au stock.`);
      setTimeout(() => setSuccessBanner(null), 4000);
      await load();
      await loadSuggestions();
    } else setError(res.error?.message ?? 'Réception impossible.');
  };

  const reverse = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/purchases/${row.id}/reverse`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) await load();
    else setError(res.error?.message ?? 'Annulation impossible.');
  };

  // Generate Draft Purchase Orders from Suggestions (§14.3)
  const handleGenerateDraftPOs = async () => {
    const activeSuggestions = suggestions.filter(s => selectedSuggestions[s.productId]);
    if (activeSuggestions.length === 0) return;

    setGeneratingPos(true);
    setError(null);

    // Group active suggestions by (supplierId, storeId)
    const grouped = new Map<string, { supplierId: string; storeId: string; lines: Array<{ productId: string; qtyInPurchaseUnit: string; unitCost: number }> }>();

    for (const s of activeSuggestions) {
      const supId = s.defaultSupplierId || suppliers[0]?.id;
      const stId = s.targetStoreId || stores[0]?.id;
      if (!supId || !stId) continue;

      const key = `${supId}__${stId}`;
      const group = grouped.get(key) || { supplierId: supId, storeId: stId, lines: [] };
      group.lines.push({
        productId: s.productId,
        qtyInPurchaseUnit: String(s.suggestedQuantity),
        unitCost: s.unitCost,
      });
      grouped.set(key, group);
    }

    const orders = Array.from(grouped.values());

    const res = await api<{ message: string; createdCount: number }>('/api/addons/inventory/purchases/suggestions', {
      method: 'POST',
      body: JSON.stringify({ orders }),
    });

    setGeneratingPos(false);
    if (res.ok) {
      setSuggestionsOpen(false);
      setSuccessBanner(res.data?.message || `${orders.length} bon(s) de commande de réapprovisionnement généré(s).`);
      setTimeout(() => setSuccessBanner(null), 5000);
      await load();
      await loadSuggestions();
    } else {
      setError(res.error?.message ?? 'Échec de la génération des bons de commande.');
    }
  };

  const updateSuggestionQty = (productId: string, qty: number) => {
    setSuggestions(prev => prev.map(s => s.productId === productId ? { ...s, suggestedQuantity: qty, estimatedTotal: qty * s.unitCost } : s));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Achats &amp; Approvisionnements</h1>
          <p className="text-sm text-slate-500">Commandes fournisseur, réapprovisionnement automatique et réceptions en stock.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => setSuggestionsOpen(true)}
            variant="outline"
            className="h-9 text-xs rounded-xl border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-[#0066FF] font-bold gap-1.5 shadow-2xs"
          >
            <Sparkles className="h-4 w-4" />
            Réapprovisionnement auto (§14.3)
            {suggestions.length > 0 && (
              <Badge className="bg-rose-500 text-white border-none text-[10px] ml-1 px-1.5 py-0.5">
                {suggestions.length}
              </Badge>
            )}
          </Button>
          <Button onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-2xs">
            <Plus className="h-4 w-4" /> Nouvel achat
          </Button>
        </div>
      </div>

      {successBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successBanner}
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">
            Fermer
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DDF5EC] text-[#17A673]"><Truck className="h-5 w-5" /></div>
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
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><CalendarDays className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">En attente</p><p className="text-2xl font-bold text-amber-700">{counts.ordered}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Wallet className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Réceptions impayées</p><p className="text-2xl font-bold text-purple-700">{counts.unpaidTotal}</p></div>
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
                className="pl-9 text-xs rounded-xl h-9 border-slate-200"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48 h-9 text-xs rounded-xl border-slate-200"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="ordered">Commandée</SelectItem>
                <SelectItem value="received">Réceptionnée</SelectItem>
                <SelectItem value="reversed">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-[#0066FF]" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">Aucune commande trouvée.</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Truck className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-bold text-[#16212B] text-xs">
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
                    <p className="text-xs font-extrabold text-[#16212B] font-mono">{fmtPrice(row.netAmount)}</p>
                    <p className="text-[11px] text-slate-400">
                      {row.paymentMethod ? PAY_METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod : '—'}
                      {row.paymentReference ? ` · ${row.paymentReference}` : ''}
                    </p>
                  </div>
                  {row.status === 'ordered' && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => reverse(row)} disabled={busyId === row.id} className="h-8 text-xs rounded-xl border-slate-200">
                        {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="mr-1 h-3.5 w-3.5" />} Annuler
                      </Button>
                      <Button size="sm" onClick={() => receive(row)} disabled={busyId === row.id} className="h-8 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                        {busyId === row.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />} Réceptionner
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* AUTO-PURCHASE SUGGESTIONS MODAL (§14.3) */}
      <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0066FF]" />
              Suggestions Automatiques de Réapprovisionnement
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-500">
              L&apos;algorithme identifie automatiquement les articles dont le stock est inférieur au seuil de sécurité (&le; 5 unités) et propose des quantités de commande adaptées.
            </p>

            {suggestionsLoading ? (
              <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#0066FF]" />
                Calcul des besoins de réapprovisionnement...
              </div>
            ) : suggestions.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                <p className="font-bold">Tous vos stocks sont à des niveaux optimaux.</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Aucun article ne nécessite de commande urgente pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={suggestions.every(s => selectedSuggestions[s.productId])}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updated: Record<string, boolean> = {};
                              for (const s of suggestions) updated[s.productId] = checked;
                              setSelectedSuggestions(updated);
                            }}
                          />
                        </th>
                        <th className="py-2.5 px-3">Article / Produit</th>
                        <th className="py-2.5 px-3">Stock Actuel</th>
                        <th className="py-2.5 px-3 w-28">Qté Suggérée</th>
                        <th className="py-2.5 px-3">Fournisseur</th>
                        <th className="py-2.5 px-3 text-right">Coût Estimé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {suggestions.map(item => (
                        <tr key={item.productId} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedSuggestions[item.productId])}
                              onChange={(e) => setSelectedSuggestions({ ...selectedSuggestions, [item.productId]: e.target.checked })}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#16212B]">{item.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.productCode}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge className="bg-rose-100 text-rose-700 border-none font-bold text-[10px]">
                              {item.currentStock} unité(s)
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <Input
                              type="number"
                              min={1}
                              value={item.suggestedQuantity}
                              onChange={(e) => updateSuggestionQty(item.productId, Number(e.target.value) || 1)}
                              className="h-8 text-xs font-bold rounded-lg border-slate-200 w-24"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {item.defaultSupplierName || 'Fournisseur principal'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {fmtPrice(item.estimatedTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold">
                  <span>Total budget prévisionnel de commande :</span>
                  <span className="font-mono text-[#0066FF] text-sm">
                    {fmtPrice(suggestions.filter(s => selectedSuggestions[s.productId]).reduce((sum, item) => sum + item.estimatedTotal, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setSuggestionsOpen(false)} className="h-9 text-xs rounded-xl border-slate-200">
              Fermer
            </Button>
            {suggestions.length > 0 && (
              <Button
                onClick={handleGenerateDraftPOs}
                disabled={generatingPos || !Object.values(selectedSuggestions).some(Boolean)}
                className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
              >
                {generatingPos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Générer les bons de commande (Draft POs)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE PURCHASE MODAL */}
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
