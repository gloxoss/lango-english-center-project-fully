'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { computeMassarCoverage } from '@/libs/academics/massar-coverage';

type SubjectCoeff = {
  subjectName: string;
  coefficient: number;
};

type Stream = {
  id: string;
  name: string;
  schoolId: string;
  code?: string | null;
  massarBacCode?: string | null;
  cycleRestriction?: 'lycee' | 'college' | 'primaire' | 'all';
  subjects?: SubjectCoeff[];
};

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; stream: Stream }
  | { mode: 'delete'; stream: Stream };

const PAGE_SIZE = 20;

const OFFICIAL_MASSAR_BAC_CODES = [
  { code: 'SM_A', label: 'Sciences Mathématiques A (SM-A)' },
  { code: 'SM_B', label: 'Sciences Mathématiques B (SM-B)' },
  { code: 'PC', label: 'Sciences Physiques & Chimie (PC)' },
  { code: 'SVT', label: 'Sciences de la Vie et de la Terre (SVT)' },
  { code: 'STE', label: 'Sciences et Technologies Électriques (STE)' },
  { code: 'STM', label: 'Sciences et Technologies Mécaniques (STM)' },
  { code: 'SE', label: 'Sciences Économiques (SE)' },
  { code: 'SGC', label: 'Sciences de Gestion Comptable (SGC)' },
  { code: 'LSH', label: 'Lettres et Sciences Humaines (LSH)' },
  { code: 'SH', label: 'Sciences Humaines (SH)' },
  { code: 'TC_SCI', label: 'Tronc Commun Scientifique' },
  { code: 'TC_LIT', label: 'Tronc Commun Littéraire' },
  { code: 'TC_TECH', label: 'Tronc Commun Technologique' },
  { code: 'OTHER', label: 'Autre / Personnalisé' },
];

export function StreamsView({ locale: _locale }: { locale?: string } = {}) {
  const activeLocale = useLocale();
  const currentLocale = _locale || activeLocale;
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');

  const cycleLabels: Record<string, { label: string; className: string }> = {
    lycee: { label: t('cycleLyceeLabel'), className: 'bg-blue-50 text-[#0066FF] border-blue-200' },
    college: { label: t('cycleCollegeLabel'), className: 'bg-purple-50 text-purple-700 border-purple-200' },
    primaire: { label: t('cyclePrimaireLabel'), className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    all: { label: t('cycleAllLabel'), className: 'bg-slate-100 text-slate-600 border-slate-200' },
  };

  const [items, setItems] = useState<Stream[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCycle, setSelectedCycle] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [saving, setSaving] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formBacCode, setFormBacCode] = useState('SM_A');
  const [formCycle, setFormCycle] = useState<'lycee' | 'college' | 'primaire' | 'all'>('lycee');
  const [formSubjects, setFormSubjects] = useState<SubjectCoeff[]>([
    { subjectName: 'Mathématiques', coefficient: 7 },
    { subjectName: 'Physique-Chimie', coefficient: 5 },
    { subjectName: 'Sciences de la Vie et de la Terre', coefficient: 3 },
    { subjectName: 'Philosophie', coefficient: 2 },
    { subjectName: 'Français', coefficient: 4 },
    { subjectName: 'Arabe', coefficient: 2 },
    { subjectName: 'Anglais', coefficient: 2 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchStreams = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/academics/streams?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(t('loadStreamsError'));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchStreams(page); }, [fetchStreams, page]);

  const openCreate = () => {
    setFormName('');
    setFormBacCode('SM_A');
    setFormCycle('lycee');
    setFormSubjects([
      { subjectName: 'Mathématiques', coefficient: 7 },
      { subjectName: 'Physique-Chimie', coefficient: 5 },
      { subjectName: 'Sciences de la Vie et de la Terre', coefficient: 3 },
      { subjectName: 'Philosophie', coefficient: 2 },
      { subjectName: 'Français', coefficient: 4 },
      { subjectName: 'Arabe', coefficient: 2 },
      { subjectName: 'Anglais', coefficient: 2 },
    ]);
    setFormError(null);
    setModal({ mode: 'create' });
  };

  const openEdit = (s: Stream) => {
    setFormName(s.name);
    setFormBacCode(s.massarBacCode || 'SM_A');
    setFormCycle(s.cycleRestriction || 'lycee');
    setFormSubjects(s.subjects && s.subjects.length > 0 ? s.subjects : [
      { subjectName: 'Matière Principale 1', coefficient: 5 },
      { subjectName: 'Matière Principale 2', coefficient: 4 },
    ]);
    setFormError(null);
    setModal({ mode: 'edit', stream: s });
  };

  const openDelete = (s: Stream) => { setModal({ mode: 'delete', stream: s }); };
  const closeModal = () => setModal({ mode: 'closed' });

  const addSubjectLine = () => {
    setFormSubjects(prev => [...prev, { subjectName: '', coefficient: 2 }]);
  };

  const updateSubjectLine = (index: number, patch: Partial<SubjectCoeff>) => {
    setFormSubjects(prev => prev.map((sub, i) => i === index ? { ...sub, ...patch } : sub));
  };

  const removeSubjectLine = (index: number) => {
    setFormSubjects(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formName.trim()) { setFormError(t('streamNameRequired')); return; }
    setSaving(true);
    setFormError(null);
    try {
      const isEdit = modal.mode === 'edit';
      const body = isEdit
        ? {
          id: (modal as { mode: 'edit'; stream: Stream }).stream.id,
          name: formName.trim(),
          massarBacCode: formBacCode,
          cycleRestriction: formCycle,
          subjects: formSubjects.filter(s => s.subjectName.trim() !== ''),
        }
        : {
          name: formName.trim(),
          massarBacCode: formBacCode,
          cycleRestriction: formCycle,
          subjects: formSubjects.filter(s => s.subjectName.trim() !== ''),
        };

      const res = await fetch('/api/academics/streams', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      fetchStreams(page);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : tCommon('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal.mode !== 'delete') return;
    setSaving(true);
    try {
      const res = await fetch(`/api/academics/streams?id=${modal.stream.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      const newPage = items.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      fetchStreams(newPage);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : tCommon('error'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.massarBacCode && s.massarBacCode.toLowerCase().includes(search.toLowerCase()));
    const matchesCycle = selectedCycle === 'all' || (s.cycleRestriction || 'lycee') === selectedCycle;
    return matchesSearch && matchesCycle;
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const massar = computeMassarCoverage(items);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2.5">
            <GitBranch className="w-6 h-6 text-[#0066FF]" />
            {t('streamsPageTitle')}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {t('streamsPageSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('searchStreamPlaceholder')}
              className="ps-9 h-9 text-xs rounded-xl w-[220px] border-slate-200"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={selectedCycle}
            onChange={e => setSelectedCycle(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
          >
            <option value="all">{t('filterAllCycles')}</option>
            <option value="lycee">{t('filterLyceeOnly')}</option>
            <option value="college">{t('filterCollegeOnly')}</option>
            <option value="primaire">{t('filterPrimaireOnly')}</option>
          </select>
          <Button
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white gap-2 text-xs font-bold h-9 rounded-xl shadow-xs"
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addStream')}</span>
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">{t('registeredStreams')}</p>
            <p className="text-2xl font-extrabold text-[#16212B] tracking-tight">{loading ? '—' : total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center font-bold">
            <GitBranch className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">{t('bacStreams')}</p>
            <p className="text-2xl font-extrabold text-purple-700 tracking-tight">
              {items.filter(i => (i.cycleRestriction || 'lycee') === 'lycee').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">{t('massarCompliance')}</p>
            {!massar.configured ? (
              <p className="text-sm font-extrabold text-amber-700 tracking-tight">{t('massarNotConfigured')}</p>
            ) : (
              <p className="text-2xl font-extrabold text-[#17A673] tracking-tight">{massar.percent}%</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#17A673] flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-4">
        <h3 className="text-base font-extrabold text-[#16212B]">
          {t('streamsCatalogTitle')}
        </h3>

        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#0066FF]" />
            <span className="text-xs">{tCommon('loading')}</span>
          </div>
        )}

        {!loading && error && (
          <div className="py-8 text-center text-xs text-rose-600 font-medium">{error}</div>
        )}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left rtl:text-right text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">{t('colStreamSpecialty')}</th>
                    <th className="py-3 px-4">{t('colMassarCode')}</th>
                    <th className="py-3 px-4">{t('colAuthorizedCycle')}</th>
                    <th className="py-3 px-4">{t('colSubjectsCoeffs')}</th>
                    <th className="py-3 px-4 text-right rtl:text-left">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                        {search ? t('noStreamsSearch') : t('noStreamsConfigured')}
                      </td>
                    </tr>
                  )}
                  {filtered.map(s => {
                    const cycleInfo = cycleLabels[s.cycleRestriction || 'lycee'] || cycleLabels.all!;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF] flex-shrink-0" />
                            <p className="font-bold text-[#16212B] text-xs">{s.name}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {s.massarBacCode ? (
                            <Badge variant="neutral" className="font-mono text-[10px] bg-slate-100 text-slate-700">
                              {s.massarBacCode}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`${cycleInfo.className} border text-[10px] font-bold`}>
                            {cycleInfo.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {s.subjects && s.subjects.length > 0 ? (
                            <span className="text-[11px] font-medium text-slate-600">
                              {t('streamSubjectsCoeffSummary', {
                                count: s.subjects.length,
                                total: s.subjects.reduce((sum, sub) => sum + sub.coefficient, 0),
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">{t('standardCoefficients')}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right rtl:text-left">
                          <div className="flex items-center justify-end rtl:justify-start gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(s)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                              title={tCommon('edit')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDelete(s)}
                              className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title={tCommon('delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-slate-400 font-medium">
                {t('totalStreamsCount', { total })}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="h-8 text-xs rounded-xl"
                >
                  <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                </Button>
                <span className="px-3 py-1.5 rounded-xl bg-[#0066FF] text-white text-xs font-bold">
                  {page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="h-8 text-xs rounded-xl"
                >
                  <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* CREATE / EDIT MODAL */}
      {(modal.mode === 'create' || modal.mode === 'edit') && (
        <Dialog open onOpenChange={closeModal}>
          <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#0066FF]" />
                {modal.mode === 'create' ? t('addStreamModalTitle') : t('editStreamModalTitle')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 my-2">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('streamNameLabel')} <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={t('streamNamePlaceholder')}
                  className="h-9 text-xs rounded-xl"
                  autoFocus
                />
              </div>

              {/* Massar Bac Code & Cycle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('massarBacRefLabel')}
                  </label>
                  <select
                    value={formBacCode}
                    onChange={e => setFormBacCode(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
                  >
                    {OFFICIAL_MASSAR_BAC_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('cycleRestrictionLabel')}
                  </label>
                  <select
                    value={formCycle}
                    onChange={e => setFormCycle(e.target.value as 'lycee' | 'college' | 'primaire' | 'all')}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
                  >
                    <option value="lycee">{t('cycleLyceeLabel')}</option>
                    <option value="college">{t('cycleCollegeLabel')}</option>
                    <option value="primaire">{t('cyclePrimaireLabel')}</option>
                    <option value="all">{t('cycleAllLabel')}</option>
                  </select>
                </div>
              </div>

              {/* Subject Coefficients Builder */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{t('subjectsCoeffsBuilderTitle')}</h4>
                    <p className="text-[11px] text-slate-400">{t('subjectsCoeffsBuilderDesc')}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSubjectLine}
                    className="h-8 text-xs rounded-xl gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('addSubjectCoeffBtn')}
                  </Button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {formSubjects.map((sub, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/70">
                      <Input
                        value={sub.subjectName}
                        onChange={e => updateSubjectLine(idx, { subjectName: e.target.value })}
                        placeholder={t('subjectNamePlaceholder')}
                        className="h-8 text-xs rounded-lg bg-white flex-1"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t('subjectCoeffColValue')}</span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={sub.coefficient}
                          onChange={e => updateSubjectLine(idx, { coefficient: Number(e.target.value) || 1 })}
                          className="h-8 w-16 text-xs rounded-lg bg-white text-center font-bold font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSubjectLine(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={closeModal} className="rounded-xl text-xs h-9" disabled={saving}>
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl text-xs h-9 bg-[#0066FF] hover:bg-[#0052CC] text-white gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {modal.mode === 'create' ? tCommon('add') : tCommon('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {modal.mode === 'delete' && (
        <Dialog open onOpenChange={closeModal}>
          <DialogContent className="max-w-md rounded-2xl">
            <div className="flex items-start gap-3 my-2">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-[#16212B]">
                  {t('deleteStreamTitle')}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-1">
                  {t('deleteStreamWarning', { name: modal.stream.name })}
                </p>
              </div>
            </div>

            {formError && (
              <p className="text-[11px] text-rose-600 mb-2 font-medium">{formError}</p>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={closeModal} className="rounded-xl text-xs h-9" disabled={saving}>
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={handleDelete}
                disabled={saving}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 rounded-xl gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {tCommon('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
