'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';

type SessionYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isDefault: boolean;
  schoolId: string;
};

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; year: SessionYear }
  | { mode: 'delete'; year: SessionYear };

const PAGE_SIZE = 20;

export function AcademicCalendarView({ locale: _locale }: { locale: string }) {
  const t = useTranslations('Academics');
  const tc = useTranslations('Common');

  const [items, setItems] = useState<SessionYear[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSessionYears = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/academics/session-years?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(t('loadYearsError'));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchSessionYears(page); }, [fetchSessionYears, page]);

  const openCreate = () => {
    setFormName('2026-2027');
    setFormStartDate('2026-09-01');
    setFormEndDate('2027-06-30');
    setFormIsDefault(false);
    setFormError(null);
    setModal({ mode: 'create' });
  };

  const openEdit = (y: SessionYear) => {
    setFormName(y.name);
    setFormStartDate(y.startDate);
    setFormEndDate(y.endDate);
    setFormIsDefault(y.isDefault);
    setFormError(null);
    setModal({ mode: 'edit', year: y });
  };

  const openDelete = (y: SessionYear) => { setModal({ mode: 'delete', year: y }); };
  const closeModal = () => setModal({ mode: 'closed' });

  const handleSave = async () => {
    if (!formName.trim()) { setFormError(t('yearNameRequired')); return; }
    if (!formStartDate || !formEndDate) { setFormError(t('datesRequired')); return; }

    setSaving(true);
    setFormError(null);
    try {
      const isEdit = modal.mode === 'edit';
      const body = {
        ...(isEdit ? { id: (modal as { mode: 'edit'; year: SessionYear }).year.id } : {}),
        name: formName.trim(),
        startDate: formStartDate,
        endDate: formEndDate,
        isDefault: formIsDefault,
      };
      const res = await fetch('/api/academics/session-years', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      fetchSessionYears(page);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal.mode !== 'delete') return;
    setSaving(true);
    try {
      const res = await fetch(`/api/academics/session-years?id=${modal.year.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      const newPage = items.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      fetchSessionYears(newPage);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
            {t('academicCalendarTitle')}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {t('academicCalendarSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-2 text-xs font-bold h-9 rounded-xl"
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addAcademicYear')}</span>
          </Button>
        </div>
      </div>

      {/* Stat Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] flex items-center justify-center flex-shrink-0">
            <CalendarIcon className="w-5 h-5 text-[#2487B8]" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">{t('configuredYears')}</p>
            <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              {loading ? '—' : total}
            </p>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <h3 className="text-base font-extrabold text-[#0F172A] mb-3">
          {t('yearsListTitle')}
        </h3>

        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">{tc('loading')}</span>
          </div>
        )}

        {!loading && error && (
          <div className="py-8 text-center text-xs text-red-600 font-medium">{error}</div>
        )}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-xs">
                <thead className="bg-[#F8FAFC] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">{t('colYearName')}</th>
                    <th className="py-3 px-3">{t('colStartDate')}</th>
                    <th className="py-3 px-3">{t('colEndDate')}</th>
                    <th className="py-3 px-3">{t('colStatus')}</th>
                    <th className="py-3 px-3">{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                        {t('noYearsConfigured')}
                      </td>
                    </tr>
                  )}
                  {items.map(y => (
                    <tr key={y.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0F172A]">{y.name}</span>
                          {y.isDefault && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" /> {t('activeYearBadge')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{y.startDate}</td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{y.endDate}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          y.isDefault ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {y.isDefault ? t('statusDefault') : t('statusSecondary')}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(y)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            title={tc('edit')}
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button
                            onClick={() => openDelete(y)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title={tc('delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
              <p className="text-[11px] text-slate-400 font-medium">
                {t('totalYearsCount', { total })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400 rtl:rotate-180" />
                </button>
                <span className="px-2.5 py-1 rounded-lg bg-[#2487B8] text-white text-[11px] font-bold">
                  {page}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Create / Edit Modal */}
      {(modal.mode === 'create' || modal.mode === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#0F172A]">
                {modal.mode === 'create' ? t('addYearModalTitle') : t('editYearModalTitle')}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('yearNameLabel')} <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder={t('yearNamePlaceholder')}
                  className="h-9 text-xs rounded-xl"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('startDateLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    className="h-9 text-xs rounded-xl"
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('endDateLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    className="h-9 text-xs rounded-xl"
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formIsDefault}
                  onChange={e => setFormIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8]"
                />
                <label htmlFor="isDefault" className="text-xs font-bold text-slate-700 cursor-pointer">
                  {t('setDefaultYearLabel')}
                </label>
              </div>

              {formError && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{formError}</p>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={closeModal} className="text-xs h-9 rounded-xl" disabled={saving}>
                  {tc('cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 rounded-xl gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {modal.mode === 'create' ? tc('add') : tc('save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modal.mode === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#0F172A]">{t('deleteYearTitle')}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {t('deleteYearWarning', { name: modal.year.name })}
                </p>
              </div>
            </div>
            {formError && (
              <p className="text-[11px] text-red-600 mb-3 font-medium">{formError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeModal} className="text-xs h-9 rounded-xl" disabled={saving}>
                {tc('cancel')}
              </Button>
              <Button
                onClick={handleDelete}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 rounded-xl gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {tc('delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

