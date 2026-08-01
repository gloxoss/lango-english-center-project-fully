'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  type?: 'compulsory' | 'elective' | null;
  semesterId?: string | null;
  schoolId: string;
};

type OptionItem = { id: string; name: string };

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; item: ClassSubject }
  | { mode: 'delete'; item: ClassSubject };

const PAGE_SIZE = 20;

export function ClassSubjectsView({ locale: _locale }: { locale: string }) {
  const [items, setItems] = useState<ClassSubject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classesList, setClassesList] = useState<OptionItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<OptionItem[]>([]);
  const [semestersList, setSemestersList] = useState<OptionItem[]>([]);

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formSemesterId, setFormSemesterId] = useState('');
  const [formType, setFormType] = useState<'compulsory' | 'elective'>('compulsory');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchClassSubjects = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/academics/class-subjects?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError('Impossible de charger l\'association classe-matières.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const [cRes, sbRes, smRes] = await Promise.all([
        fetch('/api/academics/classes?pageSize=100'),
        fetch('/api/academics/subjects?pageSize=100'),
        fetch('/api/academics/semesters?pageSize=100'),
      ]);
      if (cRes.ok) { const j = await cRes.json(); setClassesList(j.data ?? []); }
      if (sbRes.ok) { const j = await sbRes.json(); setSubjectsList(j.data ?? []); }
      if (smRes.ok) { const j = await smRes.json(); setSemestersList(j.data ?? []); }
    } catch (e) {
      console.error('Failed fetching reference options', e);
    }
  }, []);

  useEffect(() => {
    fetchClassSubjects(page);
    fetchOptions();
  }, [fetchClassSubjects, fetchOptions, page]);

  const openCreate = () => {
    setFormClassId(classesList[0]?.id ?? '');
    setFormSubjectId(subjectsList[0]?.id ?? '');
    setFormSemesterId('');
    setFormType('compulsory');
    setFormError(null);
    setModal({ mode: 'create' });
  };

  const openEdit = (cs: ClassSubject) => {
    setFormClassId(cs.classId);
    setFormSubjectId(cs.subjectId);
    setFormSemesterId(cs.semesterId ?? '');
    setFormType(cs.type === 'elective' ? 'elective' : 'compulsory');
    setFormError(null);
    setModal({ mode: 'edit', item: cs });
  };

  const openDelete = (cs: ClassSubject) => { setModal({ mode: 'delete', item: cs }); };
  const closeModal = () => setModal({ mode: 'closed' });

  const handleSave = async () => {
    if (!formClassId) { setFormError('Veuillez choisir une classe.'); return; }
    if (!formSubjectId) { setFormError('Veuillez choisir une matière.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const isEdit = modal.mode === 'edit';
      const body = {
        ...(isEdit ? { id: (modal as { mode: 'edit'; item: ClassSubject }).item.id } : {}),
        classId: formClassId,
        subjectId: formSubjectId,
        type: formType,
        semesterId: formSemesterId || undefined,
      };
      const res = await fetch('/api/academics/class-subjects', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      fetchClassSubjects(page);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de l\'affectation.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal.mode !== 'delete') return;
    setSaving(true);
    try {
      const res = await fetch(`/api/academics/class-subjects?id=${modal.item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      const newPage = items.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      fetchClassSubjects(newPage);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSaving(false);
    }
  };

  const getClassName = (id: string) => classesList.find(c => c.id === id)?.name ?? id;
  const getSubjectName = (id: string) => subjectsList.find(s => s.id === id)?.name ?? id;
  const getSemesterName = (id?: string | null) => id ? (semestersList.find(s => s.id === id)?.name ?? id) : 'Toute l\'année';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Matières par Classe
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Affectation des matières obligatoires et optionnelles par classe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-2 text-xs font-bold h-9 rounded-xl"
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Affecter une matière</span>
          </Button>
        </div>
      </div>

      {/* Stat Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-[#2487B8]" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Matières affectées</p>
            <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              {loading ? '—' : total}
            </p>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <h3 className="text-base font-extrabold text-[#0F172A] mb-3">
          Liste des affectations
        </h3>

        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Chargement…</span>
          </div>
        )}

        {!loading && error && (
          <div className="py-8 text-center text-xs text-red-600 font-medium">{error}</div>
        )}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Classe</th>
                    <th className="py-3 px-3">Matière</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Période</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                        Aucune affectation configurée. Cliquez sur « Affecter une matière » pour commencer.
                      </td>
                    </tr>
                  )}
                  {items.map(cs => (
                    <tr key={cs.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-[#0F172A]">{getClassName(cs.classId)}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-[#2487B8]">{getSubjectName(cs.subjectId)}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cs.type === 'elective' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {cs.type === 'elective' ? 'Optionnelle' : 'Obligatoire'}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        {getSemesterName(cs.semesterId)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(cs)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button
                            onClick={() => openDelete(cs)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="Supprimer"
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
                {total} affectation{total !== 1 ? 's' : ''} au total
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <span className="px-2.5 py-1 rounded-lg bg-[#2487B8] text-white text-[11px] font-bold">
                  {page}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
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
                {modal.mode === 'create' ? 'Affecter une matière à une classe' : 'Modifier l\'affectation'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Classe <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white text-[#0F172A] font-medium"
                  value={formClassId}
                  onChange={e => setFormClassId(e.target.value)}
                >
                  <option value="">Sélectionner une classe…</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Matière <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white text-[#0F172A] font-medium"
                  value={formSubjectId}
                  onChange={e => setFormSubjectId(e.target.value)}
                >
                  <option value="">Sélectionner une matière…</option>
                  {subjectsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Statut matière
                  </label>
                  <select
                    className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white text-[#0F172A] font-medium"
                    value={formType}
                    onChange={e => setFormType(e.target.value as 'compulsory' | 'elective')}
                  >
                    <option value="compulsory">Obligatoire</option>
                    <option value="elective">Optionnelle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Semestre (Optionnel)
                  </label>
                  <select
                    className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white text-[#0F172A] font-medium"
                    value={formSemesterId}
                    onChange={e => setFormSemesterId(e.target.value)}
                  >
                    <option value="">Toute l&apos;année</option>
                    {semestersList.map(sm => (
                      <option key={sm.id} value={sm.id}>{sm.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formError && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{formError}</p>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={closeModal} className="text-xs h-9 rounded-xl" disabled={saving}>
                  Annuler
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 rounded-xl gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {modal.mode === 'create' ? 'Affecter' : 'Enregistrer'}
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
                <h2 className="text-base font-extrabold text-[#0F172A]">Supprimer l&apos;affectation</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Retirer <strong>{getSubjectName(modal.item.subjectId)}</strong> de la classe <strong>{getClassName(modal.item.classId)}</strong> ?
                </p>
              </div>
            </div>
            {formError && (
              <p className="text-[11px] text-red-600 mb-3 font-medium">{formError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeModal} className="text-xs h-9 rounded-xl" disabled={saving}>
                Annuler
              </Button>
              <Button
                onClick={handleDelete}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 rounded-xl gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Retirer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
