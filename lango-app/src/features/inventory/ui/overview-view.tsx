'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, Archive, ArrowLeftRight, Banknote, Boxes, ClipboardList,
  Download, Loader2, Package, TrendingDown, TrendingUp,
} from 'lucide-react';

type LowStockRow = { id: string; name: string; code: string; totalStock: string };
type RecentMovement = {
  id: string; storeId: string; storeName: string; productId: string; productName: string;
  productCode: string; movementType: string; qty: string; refType: string | null;
  refId: string | null; actorId: string | null; reason: string | null; recordedAt: string;
};

type Overview = {
  counts: {
    products: number; categories: number; stores: number; suppliers: number;
    openIssues: number; overdueIssues: number; pendingTransfers: number; movements: number;
  };
  stockValueCents: number;
  lowStockCount: number;
  lowStockProducts: LowStockRow[];
  movements30d: { byType: Record<string, number>; inQty: string; outQty: string };
  recent: RecentMovement[];
};

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

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(cents / 100);

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]">{icon}</div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-[#16212B]">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

export function OverviewView() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Overview>('/api/addons/inventory/overview');
    if (res.ok && res.data) setOverview(res.data);
    else setError(res.error?.message ?? 'Chargement impossible.');
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const total30 = overview ? Object.values(overview.movements30d.byType).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#16212B]">Vue d&apos;ensemble</h1>
        <p className="text-sm text-slate-500">Situation de l&apos;inventaire : produits, stock, prêts et mouvements récents.</p>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : overview ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi icon={<Package className="h-5 w-5" />} label="Produits actifs" value={overview.counts.products} sub={`${overview.counts.categories} catégories`} />
            <Kpi icon={<Banknote className="h-5 w-5" />} label="Valeur du stock" value={fmtMoney(overview.stockValueCents)} sub="au coût d'achat" />
            <Kpi icon={<TrendingDown className="h-5 w-5" />} label="Stock bas" value={overview.lowStockCount} sub="produits en rupture ou à zéro" />
            <Kpi icon={<ClipboardList className="h-5 w-5" />} label="Prêts en cours" value={overview.counts.openIssues} sub={`${overview.counts.overdueIssues} en retard`} />
            <Kpi icon={<ArrowLeftRight className="h-5 w-5" />} label="Transferts en attente" value={overview.counts.pendingTransfers} sub={`${overview.counts.stores} magasins`} />
            <Kpi icon={<Boxes className="h-5 w-5" />} label="Mouvements" value={overview.counts.movements} sub={`${total30} sur 30 jours`} />
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-[#16212B]">Produits à faible stock</h2>
              <p className="text-sm text-slate-500">Références dont le stock total est à zéro.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {overview.lowStockProducts.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">Aucun produit en rupture. Parfait.</div>
              ) : (
                overview.lowStockProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Archive className="h-5 w-5" /></div>
                      <div>
                        <p className="font-semibold text-[#16212B]">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.code}</p>
                      </div>
                    </div>
                    <Badge variant="danger">{p.totalStock}</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-[#16212B]">Mouvements récents</h2>
              <p className="text-sm text-slate-500">Journal immuable — source de vérité des soldes.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {overview.recent.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">Aucun mouvement enregistré.</div>
              ) : (
                overview.recent.map(m => {
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
                        <Badge variant={positive ? 'success' : 'danger'}>{positive ? '+' : ''}{m.qty}</Badge>
                        <p className="text-xs text-slate-400">{fmtDate(m.recordedAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <h2 className="font-semibold text-[#16212B]">Exporter (CSV)</h2>
            <p className="mb-3 text-sm text-slate-500">Téléchargements filtrés par votre établissement.</p>
            <div className="flex flex-wrap gap-2">
              <a href="/api/addons/inventory/export?type=products" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#16212B] hover:bg-slate-50">
                <Download className="h-4 w-4" /> Produits
              </a>
              <a href="/api/addons/inventory/export?type=stock" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#16212B] hover:bg-slate-50">
                <Download className="h-4 w-4" /> Stock
              </a>
              <a href="/api/addons/inventory/export?type=movements" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#16212B] hover:bg-slate-50">
                <Download className="h-4 w-4" /> Mouvements
              </a>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
