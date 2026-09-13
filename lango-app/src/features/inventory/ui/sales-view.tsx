'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, GraduationCap, Loader2, Plus, Receipt, Search, ShoppingCart, Undo2, Wallet,
} from 'lucide-react';

type Row = {
  id: string; saleNumber: string; storeId: string; storeName: string;
  saleToRole: 'student' | 'staff' | 'guest';
  studentId: string | null; studentName: string | null; customerName: string | null;
  saleDate: string; netAmount: number; paidAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'check' | null;
  paymentReference: string | null;
  status: 'completed' | 'reversed';
  invoiceId: string | null; reversalReason: string | null;
};

type StoreRef = { id: string; name: string; code: string | null; status: string };
type ProductRef = { id: string; name: string; code: string; salePrice: number | null };
type StudentRef = { id: string; fullName: string };

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

const STATUS_VARIANT: Record<Row['status'], 'success' | 'neutral'> = { completed: 'success', reversed: 'neutral' };
const PAY_VARIANT: Record<Row['paymentStatus'], 'success' | 'warning' | 'danger'> = { paid: 'success', partial: 'warning', unpaid: 'danger' };

type LineForm = { productId: string; qty: string; unitPrice: string };

export function SalesView({ locale: initialLocale }: { locale?: string } = {}) {
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

  const statusLabels: Record<Row['status'], string> = { completed: t('salesCompleted'), reversed: t('salesReversed') };
  const payLabels: Record<Row['paymentStatus'], string> = { paid: t('payPaid'), partial: t('payPartial'), unpaid: t('payUnpaid') };
  const roleLabels: Record<Row['saleToRole'], string> = { student: t('roleStudent'), staff: t('roleStaff'), guest: t('roleGuest') };
  const payMethodLabels: Record<string, string> = {
    cash: t('payMethodCash'), card: t('payMethodCard'), transfer: t('payMethodTransfer'), check: t('payMethodCheck'),
  };

  const [rows, setRows] = useState<Row[]>([]);
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    storeId: '', saleToRole: 'student', studentId: '', customerName: '',
    saleDate: new Date().toISOString().slice(0, 10),
    paidAmount: '', paymentMethod: '', paymentReference: '',
  });
  const [lines, setLines] = useState<LineForm[]>([{ productId: '', qty: '1', unitPrice: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    if (roleFilter) qs.set('saleToRole', roleFilter);
    const res = await api<Row[]>(`/api/addons/inventory/sales?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) {
      setRows(
        search.trim()
          ? res.data.filter(r => `${r.saleNumber} ${r.storeName} ${r.customerName ?? ''} ${r.studentName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
          : res.data,
      );
    } else setError(res.error?.message ?? tCommon('networkError'));
    setLoading(false);
  }, [search, statusFilter, roleFilter, tCommon]);

  const loadRefs = useCallback(async () => {
    const [storeRes, prodRes, stuRes] = await Promise.all([
      api<StoreRef[]>('/api/addons/inventory/stores?status=active'),
      api<ProductRef[]>('/api/addons/inventory/products?status=active'),
      api<StudentRef[]>('/api/students'),
    ]);
    if (storeRes.ok && Array.isArray(storeRes.data)) setStores(storeRes.data);
    if (prodRes.ok && Array.isArray(prodRes.data)) setProducts(prodRes.data);
    if (stuRes.ok && Array.isArray(stuRes.data)) setStudents(stuRes.data.filter(s => s.id && s.fullName));
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => { loadRefs().catch(() => {}); }, [loadRefs]);

  const counts = useMemo(() => ({
    total: rows.length,
    completed: rows.filter(r => r.status === 'completed').length,
    student: rows.filter(r => r.saleToRole === 'student').length,
    reversed: rows.filter(r => r.status === 'reversed').length,
  }), [rows]);

  const customerLabel = (row: Row) => row.saleToRole === 'student' ? (row.studentName ?? row.studentId ?? '—') : (row.customerName ?? '—');

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const pickProduct = (i: number, productId: string) => {
    const p = products.find(x => x.id === productId);
    const current = lines[i];
    const unitPrice = (current?.unitPrice ?? '') || (p?.salePrice != null ? String(p.salePrice) : '');
    updateLine(i, { productId, unitPrice });
  };

  const openCreate = () => {
    setForm({ storeId: '', saleToRole: 'student', studentId: '', customerName: '', saleDate: new Date().toISOString().slice(0, 10), paidAmount: '', paymentMethod: '', paymentReference: '' });
    setLines([{ productId: '', qty: '1', unitPrice: '' }]);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.storeId || !form.saleDate) return;
    if (form.saleToRole === 'student' && !form.studentId) return;
    if (form.saleToRole !== 'student' && !form.customerName.trim()) return;
    const validLines = lines.filter(l => l.productId && l.qty.trim() && l.unitPrice.trim() !== '');
    if (validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const body = {
      storeId: form.storeId,
      saleToRole: form.saleToRole,
      studentId: form.saleToRole === 'student' ? form.studentId : null,
      customerName: form.saleToRole === 'student' ? null : form.customerName.trim(),
      saleDate: form.saleDate,
      paidAmount: form.paidAmount.trim() === '' ? null : Number(form.paidAmount),
      paymentMethod: form.paymentMethod || null,
      paymentReference: form.paymentReference.trim() || null,
      lines: validLines.map(l => ({ productId: l.productId, qty: l.qty.trim(), unitPrice: Number(l.unitPrice) })),
    };
    const res = await api('/api/addons/inventory/sales', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? tCommon('networkError'));
    }
  };

  const reverse = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const res = await api(`/api/addons/inventory/sales/${row.id}/reverse`, { method: 'POST', body: JSON.stringify({}) });
    setBusyId(null);
    if (res.ok) await load();
    else setError(res.error?.message ?? tCommon('networkError'));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('salesTitle')}</h1>
          <p className="text-sm text-slate-500">{t('salesSubtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="me-2 h-4 w-4" /> {t('newSaleBtn')}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><ShoppingCart className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('salesCount')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.total}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Wallet className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('salesCompleted')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.completed}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><GraduationCap className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('salesStudents')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.student}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Undo2 className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('salesReversed')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.reversed}</p></div>
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
                placeholder={t('searchSalesPlaceholder')}
                className="ps-9"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder={tCommon('all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all')}</SelectItem>
                <SelectItem value="completed">{t('salesCompleted')}</SelectItem>
                <SelectItem value="reversed">{t('salesReversed')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter || 'all'} onValueChange={v => setRoleFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder={t('allCustomers')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCustomers')}</SelectItem>
                <SelectItem value="student">{t('roleStudent')}</SelectItem>
                <SelectItem value="staff">{t('roleStaff')}</SelectItem>
                <SelectItem value="guest">{t('roleGuest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">{t('noSalesFound')}</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Receipt className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#16212B]">
                      {row.saleNumber}
                      <Badge variant={STATUS_VARIANT[row.status]}>{statusLabels[row.status]}</Badge>
                      <Badge variant={PAY_VARIANT[row.paymentStatus]}>{payLabels[row.paymentStatus]}</Badge>
                      {row.invoiceId && <Badge variant="neutral">{t('linkedInvoiceBadge')}</Badge>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {customerLabel(row)} · {roleLabels[row.saleToRole]} · {row.storeName} · {t('saleOfDate', { date: fmtDate(row.saleDate) })}
                    </p>
                    {row.status === 'reversed' && row.reversalReason && (
                      <p className="text-xs text-slate-400">{tCommon('reason')}: {row.reversalReason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-end">
                    <p className="text-sm font-bold text-[#16212B]">{fmtPrice(row.netAmount)}</p>
                    <p className="text-xs text-slate-400">
                      {row.paymentMethod ? payMethodLabels[row.paymentMethod] ?? row.paymentMethod : '—'}
                      {row.paymentReference ? ` · ${row.paymentReference}` : ''}
                    </p>
                  </div>
                  {row.status === 'completed' && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => reverse(row)} disabled={busyId === row.id}>
                        {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="me-1 h-4 w-4" />} {t('btnReverseSale')}
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
          <DialogHeader><DialogTitle>{t('newSaleBtn')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('storeLabel')}</label>
                <Select value={form.storeId} onValueChange={v => setForm({ ...form, storeId: v })}>
                  <SelectTrigger><SelectValue placeholder={tCommon('select')} /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('customerTypeLabel')}</label>
                <Select value={form.saleToRole} onValueChange={v => setForm({ ...form, saleToRole: v as any, studentId: '', customerName: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">{t('studentOption')}</SelectItem>
                    <SelectItem value="staff">{t('staffOption')}</SelectItem>
                    <SelectItem value="guest">{t('guestOption')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.saleToRole === 'student' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('studentLabel')}</label>
                <Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}>
                  <SelectTrigger><SelectValue placeholder={t('selectStudentPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('customerNameLabel')}</label>
                <Input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder={t('customerNamePlaceholder')} />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('saleDateLabel')}</label>
              <Input type="date" value={form.saleDate} onChange={e => setForm({ ...form, saleDate: e.target.value })} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('linesLabel')}</label>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={line.productId} onValueChange={v => pickProduct(i, v)}>
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
                    <Input
                      type="number" min={0} step="0.01" className="w-28" placeholder={t('unitPricePlaceholder')}
                      value={line.unitPrice}
                      onChange={e => updateLine(i, { unitPrice: e.target.value })}
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
                  onClick={() => setLines(prev => [...prev, { productId: '', qty: '1', unitPrice: '' }])}
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
                <Input value={form.paymentReference} onChange={e => setForm({ ...form, paymentReference: e.target.value })} placeholder={t('paymentRefPlaceholder')} />
              </div>
            </div>

            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{tCommon('cancel')}</Button>
            <Button
              onClick={save}
              disabled={
                saving || !form.storeId || !form.saleDate
                || (form.saleToRole === 'student' && !form.studentId)
                || (form.saleToRole !== 'student' && !form.customerName.trim())
                || !lines.some(l => l.productId && l.qty.trim() && l.unitPrice.trim() !== '')
              }
            >
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />} {t('btnCreateSale')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
