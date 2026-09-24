'use client';

import { AlertCircle, Loader2, Plus, Receipt, Search, Wallet, UploadCloud, CheckCircle2, X, FileText } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = ['salary', 'rent', 'utilities', 'supplies', 'marketing', 'other'] as const;

type Category = (typeof CATEGORIES)[number];

type Expense = {
  id: string;
  category: Category | string;
  amount: string | number;
  expenseDate: string;
  description: string | null;
  receiptUrl: string | null;
  recordedById: string | null;
};

const EMPTY_FORM = {
  category: 'supplies' as Category,
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  description: '',
  receiptUrl: '',
};

// fr-FR grouping like every other money screen (fr-MA prints 146.746,00).
const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function ExpensesManagementView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const categoryLabels: Record<Category, string> = {
    salary: t('categorySalary'),
    rent: t('categoryRent'),
    utilities: t('categoryUtilities'),
    supplies: t('categorySupplies'),
    marketing: t('categoryMarketing'),
    other: t('categoryOther'),
  };

  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/finance/expenses?pageSize=100');
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('recordExpenseError'));
      }

      setRows(json.data as Expense[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recordExpenseError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesSearch = !needle
        || (r.description ?? '').toLowerCase().includes(needle)
        || String(r.category).toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [rows, search, categoryFilter]);

  const total = useMemo(
    () => filtered.reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
    [filtered],
  );

  const breakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const r of filtered) {
      byCategory.set(String(r.category), (byCategory.get(String(r.category)) ?? 0) + Number(r.amount ?? 0));
    }
    return [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    setSaveError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/finance/expenses/receipt', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('receiptUploadError'));
      }
      setForm(prev => ({ ...prev, receiptUrl: json.data.url }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('receiptUploadError'));
    } finally {
      setUploadingReceipt(false);
    }
  };

  const create = async () => {
    if (saving) {
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSaveError(t('expenseAmountPositiveError'));
      return;
    }
    if (!form.description.trim()) {
      setSaveError(t('expenseDescriptionRequiredError'));
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          amount,
          expenseDate: form.expenseDate,
          description: form.description.trim(),
          ...(form.receiptUrl.trim() ? { receiptUrl: form.receiptUrl.trim() } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('recordExpenseError'));
      }

      setIsAddOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('recordExpenseError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('expensesTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('expensesSubtitle')}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsAddOpen(true)}
          className="h-10 gap-2 rounded-xl bg-[#2487B8] px-4 text-xs font-bold text-white hover:bg-[#1B6C93]"
        >
          <Plus className="size-4" />
          {t('recordExpenseBtn')}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            className="ms-auto h-7 text-xs font-bold text-red-700"
          >
            {tCommon('retry')}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="space-y-1 rounded-2xl border border-slate-200/80 p-4">
          <p className="text-xs font-bold text-slate-500">{t('totalDisplayedCard')}</p>
          <p className="text-2xl font-extrabold text-[#16212B] tabular-nums">
            {money.format(total)}
            {' '}
            {tCommon('currency')}
          </p>
          <p className="text-[10px] text-slate-400">
            {t('expensesCountCard', { count: filtered.length })}
          </p>
        </Card>
        <Card className="space-y-1 rounded-2xl border border-slate-200/80 p-4">
          <p className="text-xs font-bold text-slate-500">{t('mainCostCenterCard')}</p>
          <p className="truncate text-sm font-extrabold text-[#2487B8]">
            {breakdown[0] ? (categoryLabels[breakdown[0][0] as Category] ?? breakdown[0][0]) : '—'}
          </p>
          <p className="text-[10px] text-slate-400">
            {breakdown[0] ? `${money.format(breakdown[0][1])} ${tCommon('currency')}` : t('noExpensesCard')}
          </p>
        </Card>
        <Card className="space-y-1 rounded-2xl border border-slate-200/80 p-4">
          <p className="text-xs font-bold text-slate-500">{t('concernedCategoriesCard')}</p>
          <p className="text-2xl font-extrabold text-[#16212B] tabular-nums">{breakdown.length}</p>
          <p className="text-[10px] text-slate-400">{t('distinctCategoriesSub')}</p>
        </Card>
      </div>

      <Card className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 p-3 sm:flex-row sm:items-center">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:w-56">
            <SelectValue placeholder={t('allCategoriesOption')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategoriesOption')}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:ms-auto sm:w-64">
          <Search className="absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('searchExpensePlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 rounded-xl border-none bg-slate-50 ps-9 text-xs"
          />
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          <span>{t('loadingExpenses')}</span>
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <Card className="space-y-2 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <Wallet className="mx-auto size-8 text-slate-300" />
          <p className="text-sm font-extrabold text-[#16212B]">{t('noExpensesRecordedTitle')}</p>
          <p className="text-xs text-slate-500">
            {t('noExpensesRecordedSubtitle')}
          </p>
        </Card>
      )}

      {!loading && rows.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                  <th className="w-28 px-3 py-2.5 text-start">{t('dateCol')}</th>
                  <th className="w-40 px-3 py-2.5 text-start">{t('categoryCol')}</th>
                  <th className="px-3 py-2.5 text-start">{t('descriptionCol')}</th>
                  <th className="w-32 px-3 py-2.5 text-end">{t('amountCol')}</th>
                  <th className="w-24 px-3 py-2.5 text-start">{t('receiptCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{r.expenseDate}</td>
                    <td className="px-3 py-2">
                      <Badge className="border-none bg-slate-100 text-[10px] font-bold text-slate-700">
                        {categoryLabels[r.category as Category] ?? r.category}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-bold text-[#16212B]">{r.description ?? '—'}</td>
                    <td className="px-3 py-2 text-end font-extrabold text-[#16212B] tabular-nums">
                      {money.format(Number(r.amount ?? 0))}
                    </td>
                    <td className="px-3 py-2">
                      {r.receiptUrl
                        ? (
                            <a
                              href={r.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 font-bold text-[#2487B8] hover:underline"
                            >
                              <Receipt className="size-3.5" />
                              {t('viewReceiptBtn')}
                            </a>
                          )
                        : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <p className="py-10 text-center text-xs font-bold text-slate-400">
              {t('noExpensesMatchFilters')}
            </p>
          )}
        </Card>
      )}

      {breakdown.length > 0 && (
        <Card className="space-y-3 rounded-2xl border border-slate-200/80 p-4">
          <h2 className="text-xs font-extrabold text-[#16212B]">{t('breakdownByCategoryTitle')}</h2>
          <div className="space-y-2">
            {breakdown.map(([category, amount]) => {
              const share = total === 0 ? 0 : Math.round((amount / total) * 100);
              return (
                <div key={category} className="flex items-center gap-3 text-xs">
                  <span className="w-44 shrink-0 font-bold text-slate-600">
                    {categoryLabels[category as Category] ?? category}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#2487B8]" style={{ width: `${share}%` }} />
                  </div>
                  <span className="w-32 shrink-0 text-end text-slate-500 tabular-nums">
                    {money.format(amount)}
                    {' '}
                    ·
                    {share}
                    %
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-[#16212B]">
              <Wallet className="size-5 text-[#2487B8]" />
              {t('recordExpenseBtn')}
            </DialogTitle>
          </DialogHeader>

          <div className="my-3 space-y-3 text-xs">
            {saveError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-bold text-red-700">
                {saveError}
              </p>
            )}

            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="exp-category">{t('categoryRequiredLabel')}</label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v as Category })}>
                <SelectTrigger
                  id="exp-category"
                  className="h-9 rounded-xl text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold text-slate-700" htmlFor="exp-amount">{t('amountMadRequiredLabel')}</label>
                <Input
                  id="exp-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700" htmlFor="exp-date">{t('dateRequiredLabel')}</label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.expenseDate}
                  onChange={e => setForm({ ...form, expenseDate: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="exp-desc">{t('descriptionRequiredLabel')}</label>
              <Input
                id="exp-desc"
                placeholder={t('descriptionPlaceholder')}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="exp-receipt">{t('uploadReceiptLabel')}</label>
              {form.receiptUrl ? (
                <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-blue-900 font-medium truncate">
                    <FileText className="size-4 text-[#2487B8] shrink-0" />
                    <span className="truncate">{t('receiptUploaded')}</span>
                    <a
                      href={form.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#2487B8] hover:underline font-bold shrink-0"
                    >
                      ({t('viewReceiptBtn')})
                    </a>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, receiptUrl: '' })}
                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-600 rounded-full"
                    title={t('removeReceipt')}
                    aria-label={t('removeReceipt')}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-[#2487B8] rounded-xl p-3 cursor-pointer transition-colors bg-slate-50/50 ${uploadingReceipt ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      {uploadingReceipt ? (
                        <Loader2 className="size-4 animate-spin text-[#2487B8]" />
                      ) : (
                        <UploadCloud className="size-4 text-[#2487B8]" />
                      )}
                      <span>{uploadingReceipt ? t('uploadingReceipt') : t('uploadReceiptLabel')}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5">PDF, PNG, JPG (max. 8 Mo)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      disabled={uploadingReceipt}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <Input
                    id="exp-receipt"
                    placeholder={t('receiptUrlPlaceholder')}
                    value={form.receiptUrl}
                    onChange={e => setForm({ ...form, receiptUrl: e.target.value })}
                    className="h-8 rounded-xl text-xs bg-white text-slate-500"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="h-9 rounded-xl text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={() => void create()}
              disabled={saving}
              className="h-9 gap-2 rounded-xl bg-[#2487B8] text-xs font-bold text-white hover:bg-[#1B6C93]"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
