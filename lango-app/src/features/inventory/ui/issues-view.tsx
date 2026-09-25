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
  AlertCircle, AlertTriangle, CalendarDays, HandHelping, Loader2, Package, Plus, Search, Undo2,
} from 'lucide-react';
import { casablancaTodayIso } from '@/libs/finance/today';

type Row = {
  id: string; issueNumber: string; storeId: string; storeName: string;
  issueToRole: 'student' | 'staff' | 'guest';
  studentId: string | null; studentName: string | null; issueToName: string | null;
  issueDate: string; dueDate: string; returnDate: string | null;
  status: 'issued' | 'returned' | 'overdue' | 'lost' | 'damaged';
  isOverdue: boolean; recordedById: string | null; createdAt: string; updatedAt: string;
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

const today = () => casablancaTodayIso();

const STATUS_VARIANT: Record<Row['status'], 'warning' | 'success' | 'danger' | 'neutral'> = {
  issued: 'warning', returned: 'success', overdue: 'danger', lost: 'neutral', damaged: 'neutral',
};

type LineForm = { productId: string; qty: string };

export function IssuesView({ locale: initialLocale }: { locale?: string } = {}) {
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
    issued: t('statusIssued'), returned: t('statusReturned'), overdue: t('statusOverdue'), lost: t('statusLost'), damaged: t('statusDamaged'),
  };
  const roleLabels: Record<Row['issueToRole'], string> = {
    student: t('roleStudent'), staff: t('roleStaff'), guest: t('roleGuest'),
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
  const [error, setError] = useState<string | null>(null);

  const [returnTarget, setReturnTarget] = useState<Row | null>(null);
  const [returnDisposition, setReturnDisposition] = useState<'returned' | 'damaged' | 'lost'>('returned');
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);

  const [form, setForm] = useState({
    storeId: '', issueToRole: 'student', studentId: '', issueToName: '',
    issueDate: today(), dueDate: today(),
  });
  const [lines, setLines] = useState<LineForm[]>([{ productId: '', qty: '1' }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    if (roleFilter) qs.set('issueToRole', roleFilter);
    const res = await api<Row[]>(`/api/addons/inventory/issues?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) {
      setRows(
        search.trim()
          ? res.data.filter(r => `${r.issueNumber} ${r.storeName} ${r.issueToName ?? ''} ${r.studentName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
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
    issued: rows.filter(r => r.status === 'issued' || r.isOverdue).length,
    returned: rows.filter(r => r.status === 'returned').length,
    lost: rows.filter(r => r.status === 'lost' || r.status === 'damaged').length,
  }), [rows]);

  const customerLabel = (row: Row) => row.issueToRole === 'student' ? (row.studentName ?? row.studentId ?? '—') : (row.issueToName ?? '—');

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const openCreate = () => {
    setForm({ storeId: '', issueToRole: 'student', studentId: '', issueToName: '', issueDate: today(), dueDate: today() });
    setLines([{ productId: '', qty: '1' }]);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.storeId || !form.issueDate || !form.dueDate) return;
    if (form.issueToRole === 'student' && !form.studentId) return;
    if (form.issueToRole !== 'student' && !form.issueToName.trim()) return;
    const validLines = lines.filter(l => l.productId && l.qty.trim());
    if (validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const body = {
      storeId: form.storeId,
      issueToRole: form.issueToRole,
      studentId: form.issueToRole === 'student' ? form.studentId : null,
      issueToName: form.issueToRole === 'student' ? null : form.issueToName.trim(),
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      lines: validLines.map(l => ({ productId: l.productId, qty: l.qty.trim() })),
    };
    const res = await api('/api/addons/inventory/issues', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? tCommon('networkError'));
    }
  };

  const submitReturn = async () => {
    if (!returnTarget) return;
    setReturning(true);
    setError(null);
    const res = await api(`/api/addons/inventory/issues/${returnTarget.id}/return`, {
      method: 'POST',
      body: JSON.stringify({ disposition: returnDisposition, reason: returnReason.trim() || null }),
    });
    setReturning(false);
    if (res.ok) {
      setReturnTarget(null);
      await load();
    } else {
      setError(res.error?.message ?? tCommon('networkError'));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('issuesTitle')}</h1>
          <p className="text-sm text-slate-500">{t('issuesSubtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="me-2 h-4 w-4" /> {t('newIssueBtn')}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><HandHelping className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('issuesCount')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.total}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><CalendarDays className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('issuedActive')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.issued}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Package className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('issuedReturned')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.returned}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><AlertTriangle className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('issuedLostDamaged')}</p><p className="text-2xl font-bold text-[#16212B]">{counts.lost}</p></div>
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
                placeholder={t('searchIssuesPlaceholder')}
                className="ps-9"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder={tCommon('all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all')}</SelectItem>
                <SelectItem value="issued">{t('statusIssued')}</SelectItem>
                <SelectItem value="returned">{t('statusReturned')}</SelectItem>
                <SelectItem value="overdue">{t('statusOverdue')}</SelectItem>
                <SelectItem value="lost">{t('statusLost')}</SelectItem>
                <SelectItem value="damaged">{t('statusDamaged')}</SelectItem>
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
            <div className="p-10 text-center text-sm text-slate-500">{t('noIssuesFound')}</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><HandHelping className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#16212B]">
                      {row.issueNumber}
                      <Badge variant={STATUS_VARIANT[row.status]}>{statusLabels[row.status]}</Badge>
                      {row.isOverdue && (
                        <Badge variant="danger" className="gap-1"><AlertTriangle className="h-3 w-3" />{t('overdueBadge')}</Badge>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {customerLabel(row)} · {roleLabels[row.issueToRole]} · {row.storeName} · {t('loanDueOn', { date: fmtDate(row.dueDate) })}
                      {row.returnDate && ` · ${t('returnedOn', { date: fmtDate(row.returnDate) })}`}
                    </p>
                  </div>
                </div>
                {row.status === 'issued' && (
                  <Button variant="outline" size="sm" onClick={() => { setReturnTarget(row); setReturnDisposition('returned'); setReturnReason(''); }}>
                    <Undo2 className="me-1 h-4 w-4" /> {t('btnProcessReturn')}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={!!returnTarget} onOpenChange={open => !open && setReturnTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{returnTarget && t('returnModalTitle', { number: returnTarget.issueNumber })}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('returnDispositionLabel')}</label>
              <Select value={returnDisposition} onValueChange={v => setReturnDisposition(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="returned">{t('dispositionReturnedHealthy')}</SelectItem>
                  <SelectItem value="damaged">{t('dispositionDamaged')}</SelectItem>
                  <SelectItem value="lost">{t('dispositionLost')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('returnRemarksLabel')}</label>
              <Textarea value={returnReason} onChange={e => setReturnReason(e.target.value)} rows={2} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTarget(null)}>{tCommon('cancel')}</Button>
            <Button onClick={submitReturn} disabled={returning}>
              {returning && <Loader2 className="me-2 h-4 w-4 animate-spin" />} {t('btnConfirmReturn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t('newIssueBtn')}</DialogTitle></DialogHeader>
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
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('beneficiaryRoleLabel')}</label>
                <Select value={form.issueToRole} onValueChange={v => setForm({ ...form, issueToRole: v as any, studentId: '', issueToName: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">{t('studentOption')}</SelectItem>
                    <SelectItem value="staff">{t('staffOption')}</SelectItem>
                    <SelectItem value="guest">{t('guestOption')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.issueToRole === 'student' ? (
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
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('beneficiaryNameLabel')}</label>
                <Input value={form.issueToName} onChange={e => setForm({ ...form, issueToName: e.target.value })} placeholder={t('customerNamePlaceholder')} />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{tCommon('date')} *</label>
                <Input type="date" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('dueDateLabel')}</label>
                <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
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
              disabled={
                saving || !form.storeId || !form.issueDate || !form.dueDate
                || (form.issueToRole === 'student' && !form.studentId)
                || (form.issueToRole !== 'student' && !form.issueToName.trim())
                || !lines.some(l => l.productId && l.qty.trim())
              }
            >
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />} {t('btnCreateIssue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
