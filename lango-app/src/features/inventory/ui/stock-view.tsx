'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle, Archive, Loader2, RefreshCw, TrendingDown, TrendingUp,
} from 'lucide-react';

type BalanceRow = {
  productId: string; productName: string; productCode: string;
  storeId: string; storeName: string; storeCode: string;
  quantity: string; updatedAt: string;
};

type MovementRow = {
  id: string; storeId: string; storeName: string; productId: string; productName: string;
  productCode: string; movementType: string; qty: string; refType: string | null;
  refId: string | null; actorId: string | null; reason: string | null; recordedAt: string;
};

type StoreRef = { id: string; name: string };
type ProductRef = { id: string; name: string; code: string };

type ApiErrorShape = { code?: string; message?: string };

const MOVEMENT_LABELS: Record<string, string> = {
  receipt: 'Réception',
  sale: 'Vente',
  sale_reversal: 'Annulation vente',
  issue: 'Sortie',
  issue_return: 'Retour sortie',
  adjustment_in: 'Ajustement +',
  adjustment_out: 'Ajustement −',
  transfer_out: 'Transfert sortant',
  transfer_in: 'Transfert entrant',
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
};

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

export function StockView() {
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [lastReconcile, setLastReconcile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    const qs = new URLSearchParams();
    if (storeFilter) qs.set('storeId', storeFilter);
    if (productFilter) qs.set('productId', productFilter);
    if (lowStockOnly) qs.set('lowStock', '0');
    const res = await api<BalanceRow[]>(`/api/addons/inventory/stock?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) setBalances(res.data);
    else setError(res.error?.message ?? 'Chargement impossible.');
  }, [storeFilter, productFilter, lowStockOnly]);

  const loadMovements = useCallback(async () => {
    const qs = new URLSearchParams();
    if (storeFilter) qs.set('storeId', storeFilter);
    if (productFilter) qs.set('productId', productFilter);
    qs.set('limit', '20');
    const res = await api<{ rows: MovementRow[]; total: number }>(`/api/addons/inventory/movements?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data?.rows)) setMovements(res.data.rows);
  }, [storeFilter, productFilter]);

  const loadRefs = useCallback(async () => {
    const [storeRes, prodRes] = await Promise.all([
      api<StoreRef[]>('/api/addons/inventory/stores?status=active'),
      api<ProductRef[]>('/api/addons/inventory/products'),
    ]);
    if (storeRes.ok && Array.isArray(storeRes.data)) setStores(storeRes.data);
    if (prodRes.ok && Array.isArray(prodRes.data)) {
      setProducts(prodRes.data.map(p => ({ id: p.id, name: (p as any).name, code: (p as any).code })));
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadBalances(), loadMovements()]);
    setLoading(false);
  }, [loadBalances, loadMovements]);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  const totalLines = balances.length;
  const totalQty = useMemo(() => balances.reduce((acc, b) => acc + Number(b.quantity || 0), 0), [balances]);
  const zeroLines = useMemo(() => balances.filter(b => Number(b.quantity || 0) === 0).length, [balances]);

  const reconcile = async () => {
    setReconciling(true);
    setError(null);
    const res = await api<{ discrepancies: Array<{ storeId: string; productId: string; expected: string; actual: string }>; reconciled: boolean }>(
      '/api/addons/inventory/stock/reconcile', { method: 'POST' },
    );
    setReconciling(false);
    if (res.ok && res.data) {
      setLastReconcile(res.data.reconciled
        ? 'Écart nul : les soldes correspondent exactement au journal.'
        : `${res.data.discrepancies.length} écart(s) corrigé(s) — soldes réalignés sur le journal.`);
      await refresh();
    } else {
      setError(res.error?.message ?? 'Réconciliation impossible.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Stock</h1>
          <p className="text-sm text-slate-500">Soldes par produit et magasin, projetés depuis le journal des mouvements.</p>
        </div>
        <Button variant="outline" onClick={reconcile} disabled={reconciling}>
          {reconciling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Réconcilier
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Archive className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Lignes de stock</p><p className="text-2xl font-bold text-[#16212B]">{totalLines}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><TrendingUp className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Quantité totale</p><p className="text-2xl font-bold text-[#16212B]">{totalQty}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><TrendingDown className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Lignes à zéro</p><p className="text-2xl font-bold text-[#16212B]">{zeroLines}</p></div>
          </div>
        </Card>
      </div>

      {(lastReconcile || error) && (
        <p className={`flex items-center gap-1 text-sm ${error ? 'text-red-600' : 'text-emerald-600'}`}>
          <AlertCircle className="h-4 w-4" />{error ?? lastReconcile}
        </p>
      )}

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={storeFilter || 'all'} onValueChange={v => setStoreFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Tous les magasins" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les magasins</SelectItem>
                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={productFilter || 'all'} onValueChange={v => setProductFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Tous les produits" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={e => setLowStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#2487B8]"
              />
              Ruptures uniquement
            </label>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : balances.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun stock pour ces critères.</div>
          ) : (
            balances.map((b, i) => (
              <div key={`${b.productId}-${b.storeId}-${i}`} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Archive className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{b.productName}</p>
                    <p className="text-xs text-slate-500">{b.productCode} · {b.storeName} ({b.storeCode})</p>
                    <p className="text-xs text-slate-400">MàJ : {fmtDate(b.updatedAt)}</p>
                  </div>
                </div>
                <Badge variant={Number(b.quantity) > 0 ? 'info' : 'neutral'}>{b.quantity}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="border-b border-slate-100 p-4">
          <h2 className="font-semibold text-[#16212B]">Derniers mouvements</h2>
          <p className="text-sm text-slate-500">Journal immuable — source de vérité des soldes.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {movements.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun mouvement enregistré.</div>
          ) : (
            movements.map(m => {
              const positive = m.movementType === 'receipt' || m.movementType === 'issue_return' || m.movementType === 'adjustment_in' || m.movementType === 'transfer_in';
              return (
                <div key={m.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      {positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-[#16212B]">{m.productName}</p>
                      <p className="text-xs text-slate-500">{MOVEMENT_LABELS[m.movementType] ?? m.movementType} · {m.storeName}</p>
                      {m.reason && <p className="text-xs text-slate-400">{m.reason}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={positive ? 'success' : 'danger'}>
                      {positive ? '+' : ''}{m.qty}
                    </Badge>
                    <p className="text-xs text-slate-400">{fmtDate(m.recordedAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
