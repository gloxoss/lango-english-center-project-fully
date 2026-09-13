'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  reorderThresholdSource: 'product' | 'tenant-default';
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
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Network error.' } };
  }
}

const STATUS_VARIANT: Record<Row['status'], 'warning' | 'success' | 'neutral'> = { ordered: 'warning', received: 'success', reversed: 'neutral' };
const PAY_VARIANT: Record<Row['paymentStatus'], 'danger' | 'warning' | 'success'> = { unpaid: 'danger', partial: 'warning', paid: 'success' };

type LineForm = { productId: string; qtyInPurchaseUnit: string; unitCost: string };

export function PurchasesView({ locale: initialLocale }: { locale?: string } = {}) {
  const currentLocale = useLocale();
  const locale = initialLocale || currentLocale;
  const t = useTranslations('Inventory');
  const tCommon = useTranslations('Common');

  const dateLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR';
  const fmtPrice = (v: number | null | undefined) =>
    (v === null || v === undefined ? '—' : `${v.toLocaleString(dateLocale, { minimumFractionDigits: 2 })} ${tCommon('currency')}`);
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime()) ? d.slice(0, 10) : date.toLocaleDateString(dateLocale, { dateStyle: 'short' });
  };

  const statusLabels: Record<Row['status'], string> = { ordered: t('statusOrdered'), received: t('statusReceived'), reversed: t('statusCancelled') };
  const payLabels: Record<Row['paymentStatus'], string> = { unpaid: t('payUnpaid'), partial: t('payPartial'), paid: t('payPaid') };
  const payMethodLabels: Record<string, string> = {
    cash: t('payMethodCash'), card: t('payMethodCard'), transfer: t('payMethodTransfer'), check: t('payMethodCheck'),
  };

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
    } else setError(res.error?.message ?? tCommon('networkError'));
    setLoading(false);
  }, [search, statusFilter, tCommon]);

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
      setSuccessBanner(tCommon('success'));
      setTimeout(() => setSuccessBanner(null), 4000);
      await load();
      await loadSuggestions();
    } else {
      setError(res.error?.message ?? tCommon('networkError'));
    }
  };

  const receive = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/purchases/${row.id}/receive`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) {
      setSuccessBanner(tCommon('success'));
      setTimeout(() => setSuccessBanner(null), 4000);
      await load();
      await loadSuggestions();
    } else setError(res.error?.message ?? tCommon('networkError'));
  };

  const reverse = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/purchases/${row.id}/reverse`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) await load();
    else setError(res.error?.message ?? tCommon('networkError'));
  };

  const handleGenerateDraftPOs = async () => {
    const activeSuggestions = suggestions.filter(s => selectedSuggestions[s.productId]);
    if (activeSuggestions.length === 0) return;

    setGeneratingPos(true);
    setError(null);

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
      setSuccessBanner(res.data?.message || tCommon('success'));
      setTimeout(() => setSuccessBanner(null), 5000);
      await load();
      await loadSuggestions();
    } else {
      setError(res.error?.message ?? tCommon('networkError'));
    }
  };

  const updateSuggestionQty = (productId: string, qty: number) => {
    setSuggestions(prev => prev.map(s => s.productId === productId ? { ...s, suggestedQuantity: qty, estimatedTotal: qty * s.unitCost } : s));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('purchasesTitle')}</h1>
          <p className="text-sm text-slate-500">{t('purchasesSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => setSuggestionsOpen(true)}
            variant="outline"
            className="h-9 text-xs rounded-xl border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-[#0066FF] font-bold gap-1.5 shadow-2xs"
          >
            <Sparkles className="h-4 w-4" />
            {t('autoPurchaseBtn')}
            {suggestions.length > 0 && (
              <Badge className="bg-rose-500 text-white border-none text-[10px] ms-1 px-1.5 py-0.5">
                {suggestions.length}
              </Badge>
            )}
          </Button>
          <Button onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-2xs">
            <Plus className="h-4 w-4" /> {t('newPurchaseBtn')}
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
            {tCommon('close')}
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DDF5EC] text-[#17A673]"><Truck className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('purchasesCount')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.total}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><ArrowDownToLine className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('purchasesReceived')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.received}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><CalendarDays className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('purchasesOrdered')}</p><p className="text-2xl font-bold text-amber-700">{counts.ordered}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Wallet className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('purchasesUnpaid')}</p><p className="text-2xl font-bold text-purple-700">{counts.unpaidTotal}</p></div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchPurchasesPlaceholder')}
                className="ps-9 text-xs rounded-xl h-9 border-slate-200"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48 h-9 text-xs rounded-xl border-slate-200"><SelectValue placeholder={tCommon('all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all')}</SelectItem>
                <SelectItem value="ordered">{t('statusOrdered')}</SelectItem>
                <SelectItem value="received">{t('statusReceived')}</SelectItem>
                <SelectItem value="reversed">{t('statusCancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-[#0066FF]" /> {tCommon('loading')}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">{t('noPurchasesFound')}</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Truck className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-bold text-[#16212B] text-xs">
                      {row.purchaseNumber}
                      <Badge variant={STATUS_VARIANT[row.status]}>{statusLabels[row.status]}</Badge>
                      <Badge variant={PAY_VARIANT[row.paymentStatus]}>{payLabels[row.paymentStatus]}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.supplierName} · {row.storeName} · {fmtDate(row.orderDate)}
                      {row.receivedAt && ` · ${t('statusReceived')}: ${fmtDate(row.receivedAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-end">
                    <p className="text-xs font-extrabold text-[#16212B] font-mono">{fmtPrice(row.netAmount)}</p>
                    <p className="text-[11px] text-slate-400">
                      {row.paymentMethod ? payMethodLabels[row.paymentMethod] ?? row.paymentMethod : '—'}
                      {row.paymentReference ? ` · ${row.paymentReference}` : ''}
                    </p>
                  </div>
                  {row.status === 'ordered' && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => reverse(row)} disabled={busyId === row.id} className="h-8 text-xs rounded-xl border-slate-200">
                        {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="me-1 h-3.5 w-3.5" />} {t('btnReversePurchase')}
                      </Button>
                      <Button size="sm" onClick={() => receive(row)} disabled={busyId === row.id} className="h-8 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                        {busyId === row.id ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="me-1 h-3.5 w-3.5" />} {t('btnReceiveGoods')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* AUTO-PURCHASE SUGGESTIONS MODAL */}
      <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0066FF]" />
              {t('suggestionsModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-500">
              {t('suggestionsSubtitle')}
            </p>

            {suggestionsLoading ? (
              <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#0066FF]" />
                {tCommon('loading')}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                <p className="font-bold">{t('noSuggestions')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-start text-xs border-collapse">
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
                        <th className="py-2.5 px-3">{t('productsCount')}</th>
                        <th className="py-2.5 px-3">{t('currentStockCol')}</th>
                        <th className="py-2.5 px-3">{t('reorderPointLabel')}</th>
                        <th className="py-2.5 px-3 w-28">{t('quantityLabel')}</th>
                        <th className="py-2.5 px-3">{t('supplierCol')}</th>
                        <th className="py-2.5 px-3 text-end">{t('totalValueCol')}</th>
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
                              {item.currentStock}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-700">{item.reorderThreshold}</span>
                            {item.reorderThresholdSource === 'tenant-default' && (
                              <span className="ms-1.5 text-[10px] font-bold text-amber-600">({tCommon('default')})</span>
                            )}
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
                            {item.defaultSupplierName || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-end font-mono font-bold text-slate-800">
                            {fmtPrice(item.estimatedTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold">
                  <span>{t('estimatedTotalLabel', { total: '' })}</span>
                  <span className="font-mono text-[#0066FF] text-sm">
                    {fmtPrice(suggestions.filter(s => selectedSuggestions[s.productId]).reduce((sum, item) => sum + item.estimatedTotal, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setSuggestionsOpen(false)} className="h-9 text-xs rounded-xl border-slate-200">
              {tCommon('close')}
            </Button>
            {suggestions.length > 0 && (
              <Button
                onClick={handleGenerateDraftPOs}
                disabled={generatingPos || !Object.values(selectedSuggestions).some(Boolean)}
                className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
              >
                {generatingPos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {t('btnGenerateSelectedPos', { count: Object.values(selectedSuggestions).filter(Boolean).length })}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE PURCHASE MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t('newPurchaseBtn')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('supplierLabel')}</label>
                <Select value={form.supplierId} onValueChange={v => setForm({ ...form, supplierId: v })}>
                  <SelectTrigger><SelectValue placeholder={tCommon('select')} /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('receivingStoreLabel')}</label>
                <Select value={form.storeId} onValueChange={v => setForm({ ...form, storeId: v })}>
                  <SelectTrigger><SelectValue placeholder={tCommon('select')} /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('orderDateLabel')}</label>
              <Input type="date" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('linesLabel')}</label>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={line.productId} onValueChange={v => updateLine(i, { productId: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder={t('selectProductPlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" min={0} step="0.001" className="w-24" placeholder={t('qtyInPurchaseUnitPlaceholder')}
                      value={line.qtyInPurchaseUnit}
                      onChange={e => updateLine(i, { qtyInPurchaseUnit: e.target.value })}
                    />
                    <Input
                      type="number" min={0} step="0.01" className="w-28" placeholder={t('unitCostPlaceholder')}
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
                  <Plus className="me-1 h-4 w-4" /> {t('btnAddLine')}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('paidAmountLabel')} ({tCommon('currency')})</label>
                <Input type="number" min={0} step="0.01" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('paymentMethodLabel')}</label>
                <Select value={form.paymentMethod || 'none'} onValueChange={v => setForm({ ...form, paymentMethod: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="cash">{t('payMethodCash')}</SelectItem>
                    <SelectItem value="card">{t('payMethodCard')}</SelectItem>
                    <SelectItem value="transfer">{t('payMethodTransfer')}</SelectItem>
                    <SelectItem value="check">{t('payMethodCheck')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('paymentReferenceLabel')}</label>
                <Input value={form.paymentReference} onChange={e => setForm({ ...form, paymentReference: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('notesLabel')}</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder={t('notesPlaceholder')} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{tCommon('cancel')}</Button>
            <Button
              onClick={save}
              disabled={saving || !form.supplierId || !form.storeId || !form.orderDate || !lines.some(l => l.productId && l.qtyInPurchaseUnit.trim() && l.unitCost.trim() !== '')}
            >
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />} {t('btnCreatePurchase')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
