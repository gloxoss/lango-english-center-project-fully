'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, Archive, Loader2, MapPin, Pencil, Plus, Search, Store,
} from 'lucide-react';

type Row = {
  id: string; name: string; code: string; branchId: string | null;
  mobile: string | null; address: string | null; description: string | null; status: string;
};
type StockRow = { storeId: string; productId: string; quantity: string };
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

export function StoresView() {
  const t = useTranslations('Inventory');
  const tCommon = useTranslations('Common');

  const [rows, setRows] = useState<Row[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', mobile: '', address: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    qs.set('status', showArchived ? 'archived' : 'active');
    if (search.trim()) qs.set('search', search.trim());
    const res = await api<Row[]>(`/api/addons/inventory/stores?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else setError(res.error?.message ?? tCommon('networkError'));
    const stockRes = await api<StockRow[]>('/api/addons/inventory/stock');
    if (stockRes.ok && Array.isArray(stockRes.data)) setStock(stockRes.data);
    setLoading(false);
  }, [search, showArchived, tCommon]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const stockSummary = useMemo(() => {
    const map = new Map<string, { products: number; totalQty: number }>();
    for (const s of stock) {
      const entry = map.get(s.storeId) ?? { products: 0, totalQty: 0 };
      entry.products += 1;
      entry.totalQty += Number(s.quantity || 0);
      map.set(s.storeId, entry);
    }
    return map;
  }, [stock]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', mobile: '', address: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      name: row.name, code: row.code, mobile: row.mobile ?? '',
      address: row.address ?? '', description: row.description ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    setError(null);
    const body = {
      name: form.name.trim(), code: form.code.trim(),
      mobile: form.mobile.trim() || null, address: form.address.trim() || null, description: form.description.trim() || null,
    };
    const res = editing
      ? await api(`/api/addons/inventory/stores/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/addons/inventory/stores', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? tCommon('networkError'));
    }
  };

  const archive = async (row: Row) => {
    setError(null);
    const res = await api(`/api/addons/inventory/stores/${row.id}`, { method: 'DELETE' });
    if (res.ok) await load();
    else setError(res.error?.message ?? tCommon('networkError'));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('storesTitle')}</h1>
          <p className="text-sm text-slate-500">{t('storesSubtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="me-2 h-4 w-4" /> {t('newStoreBtn')}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Store className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('activeStores')}</p><p className="text-2xl font-bold text-[#16212B]">{rows.length}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Archive className="h-5 w-5" /></div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-slate-500">{tCommon('status')}</p>
              <button
                type="button"
                onClick={() => setShowArchived(v => !v)}
                className="text-start text-sm font-semibold text-[#2487B8] hover:underline"
              >
                {showArchived ? t('viewActive') : t('viewArchived')}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchStoresPlaceholder')}
              className="ps-9"
            />
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">{t('noStoresFound')}</div>
          ) : (
            rows.map(row => {
              const summary = stockSummary.get(row.id);
              return (
                <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Store className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold text-[#16212B]">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.code}
                        {row.address && <span className="inline-flex items-center gap-1 ms-2"><MapPin className="h-3 w-3" />{row.address}</span>}
                      </p>
                      {row.mobile && <p className="text-xs text-slate-400">{row.mobile}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {summary && (
                      <Badge variant="info">{t('storeSummaryBadge', { products: summary.products, qty: summary.totalQty })}</Badge>
                    )}
                    <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>{row.status === 'active' ? tCommon('active') : t('archived')}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                    {row.status === 'active' && (
                      <Button variant="ghost" size="icon" onClick={() => archive(row)}><Archive className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t('editStoreTitle') : t('newStoreBtn')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{tCommon('name')} *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('storeNamePlaceholder')} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{tCommon('code')} *</label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder={t('storeCodePlaceholder')} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('phoneLabel')}</label>
              <Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder={t('storePhonePlaceholder')} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('addressLabel')}</label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder={t('storeAddressPlaceholder')} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{tCommon('description')}</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{tCommon('cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.name.trim() || !form.code.trim()}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />} {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
