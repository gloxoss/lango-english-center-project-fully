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
  AlertCircle, ArrowLeftRight, CheckCircle2, Loader2, Plus, Search, XCircle,
} from 'lucide-react';

type Row = {
  id: string; transferNumber: string;
  fromStoreId: string; fromStoreName: string;
  toStoreId: string; toStoreName: string;
  reason: string | null;
  status: 'pending' | 'completed' | 'reversed';
  createdById: string | null; completedAt: string | null; cancelledAt: string | null;
  createdAt: string; updatedAt: string;
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
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Network error.' } };
  }
}

const STATUS_VARIANT: Record<Row['status'], 'warning' | 'success' | 'neutral'> = { pending: 'warning', completed: 'success', reversed: 'neutral' };

type LineForm = { productId: string; qty: string };

export function TransfersView({ locale: initialLocale }: { locale?: string } = {}) {
  const currentLocale = useLocale();
  const locale = initialLocale || currentLocale;
  const t = useTranslations('Inventory');
  const tCommon = useTranslations('Common');

  const dateLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR';
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime()) ? d.slice(0, 10) : date.toLocaleDateString(dateLocale, { dateStyle: 'short' });
  };

  const statusLabels: Record<Row['status'], string> = {
    pending: t('statusPending'),
    completed: t('statusCompleted'),
    reversed: t('statusCancelled'),
  };

  const [rows, setRows] = useState<Row[]>([]);
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ fromStoreId: '', toStoreId: '', reason: '' });
  const [lines, setLines] = useState<LineForm[]>([{ productId: '', qty: '1' }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    const res = await api<Row[]>(`/api/addons/inventory/transfers?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) {
      setRows(
        search.trim()
          ? res.data.filter(r => `${r.transferNumber} ${r.fromStoreName} ${r.toStoreName} ${r.reason ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
          : res.data,
      );
    } else setError(res.error?.message ?? tCommon('networkError'));
    setLoading(false);
  }, [search, statusFilter, tCommon]);

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
    pending: rows.filter(r => r.status === 'pending').length,
    completed: rows.filter(r => r.status === 'completed').length,
    cancelled: rows.filter(r => r.status === 'reversed').length,
  }), [rows]);

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const openCreate = () => {
    setForm({ fromStoreId: '', toStoreId: '', reason: '' });
    setLines([{ productId: '', qty: '1' }]);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.fromStoreId || !form.toStoreId) return;
    const validLines = lines.filter(l => l.productId && l.qty.trim());
    if (validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const body = {
      fromStoreId: form.fromStoreId,
      toStoreId: form.toStoreId,
      reason: form.reason.trim() || null,
      lines: validLines.map(l => ({ productId: l.productId, qty: l.qty.trim() })),
    };
    const res = await api('/api/addons/inventory/transfers', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? tCommon('networkError'));
    }
  };

  const complete = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/transfers/${row.id}/complete`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) await load();
    else setError(res.error?.message ?? tCommon('networkError'));
  };

  const cancel = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/transfers/${row.id}/cancel`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) await load();
    else setError(res.error?.message ?? tCommon('networkError'));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('transfersTitle')}</h1>
          <p className="text-sm text-slate-500">{t('transfersSubtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="me-2 h-4 w-4" /> {t('newTransferBtn')}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><ArrowLeftRight className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('transfersCount')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.total}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Plus className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('pendingCount')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.pending}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><CheckCircle2 className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('completedCount')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.completed}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><XCircle className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('cancelledCount')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.cancelled}</p></div>
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
                placeholder={t('searchTransfersPlaceholder')}
                className="ps-9"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder={t('allStatuses')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                <SelectItem value="pending">{t('statusPending')}</SelectItem>
                <SelectItem value="completed">{t('statusCompleted')}</SelectItem>
                <SelectItem value="reversed">{t('statusCancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">{t('noTransfersFound')}</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><ArrowLeftRight className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#16212B]">
                      {row.transferNumber}
                      <Badge variant={STATUS_VARIANT[row.status]}>{statusLabels[row.status]}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.fromStoreName} → {row.toStoreName} · {t('createdOn', { date: fmtDate(row.createdAt) })}
                      {row.completedAt && ` · ${t('completedOn', { date: fmtDate(row.completedAt) })}`}
                      {row.cancelledAt && ` · ${t('cancelledOn', { date: fmtDate(row.cancelledAt) })}`}
                    </p>
                    {row.reason && <p className="text-xs text-slate-400">{tCommon('reason')}: {row.reason}</p>}
                  </div>
                </div>
                {row.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => cancel(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="me-1 h-4 w-4" />} {t('btnCancelTransfer')}
                    </Button>
                    <Button size="sm" onClick={() => complete(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="me-1 h-4 w-4" />} {t('btnCompleteTransfer')}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t('newTransferBtn')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('fromStoreLabel')}</label>
                <Select value={form.fromStoreId} onValueChange={v => setForm({ ...form, fromStoreId: v })}>
                  <SelectTrigger><SelectValue placeholder={tCommon('select')} /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('toStoreLabel')}</label>
                <Select value={form.toStoreId} onValueChange={v => setForm({ ...form, toStoreId: v })}>
                  <SelectTrigger><SelectValue placeholder={tCommon('select')} /></SelectTrigger>
                  <SelectContent>
                    {stores.filter(s => s.id !== form.fromStoreId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('reasonLabel')}</label>
              <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} placeholder={t('reasonPlaceholder')} />
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
                      type="number" min={0} step="0.001" className="w-24" placeholder={t('qtyPlaceholder')}
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
                  onClick={() => setLines(prev => [...prev, { productId: '', qty: '1' }])}
                >
                  <Plus className="me-1 h-4 w-4" /> {t('btnAddLine')}
                </Button>
              </div>
            </div>

            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{tCommon('cancel')}</Button>
            <Button
              onClick={save}
              disabled={saving || !form.fromStoreId || !form.toStoreId || !lines.some(l => l.productId && l.qty.trim())}
            >
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />} {t('btnCreateTransfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
