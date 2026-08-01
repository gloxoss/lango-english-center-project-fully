'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';

type ClassTeacher = {
  id: string;
  classSectionId: string;
  teacherId: string;
  schoolId: string;
};

type ClassSection = {
  id: string;
  classId: string;
  sectionId: string;
};

type OptionItem = { id: string; name: string };
type TeacherItem = { id: string; fullName: string };

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'delete'; item: ClassTeacher };

const PAGE_SIZE = 20;

export function ClassSectionTeachersView({ locale: _locale }: { locale: string }) {
  const [items, setItems] = useState<ClassTeacher[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [classesList, setClassesList] = useState<OptionItem[]>([]);
  const [sectionsList, setSectionsList] = useState<OptionItem[]>([]);
  const [teachersList, setTeachersList] = useState<TeacherItem[]>([]);

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formClassSectionId, setFormClassSectionId] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchClassTeachers = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/academics/class-teachers?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError('Impossible de charger les enseignants principaux par classe.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const [csRes, cRes, sRes, tRes] = await Promise.all([
        fetch('/api/academics/class-sections?pageSize=100'),
        fetch('/api/academics/classes?pageSize=100'),
        fetch('/api/academics/sections?pageSize=100'),
        fetch('/api/teachers?pageSize=100'),
      ]);
      if (csRes.ok) { const j = await csRes.json(); setClassSections(j.data ?? []); }
      if (cRes.ok) { const j = await cRes.json(); setClassesList(j.data ?? []); }
      if (sRes.ok) { const j = await sRes.json(); setSectionsList(j.data ?? []); }
      if (tRes.ok) { const j = await tRes.json(); setTeachersList(j.data ?? []); }
    } catch (e) {
      console.error('Failed fetching reference options', e);
    }
  }, []);

  useEffect(() => {
    fetchClassTeachers(page);
    fetchOptions();
  }, [fetchClassTeachers, fetchOptions, page]);

  const openCreate = () => {
    setFormClassSectionId(classSections[0]?.id ?? '');
    setFormTeacherId(teachersList[0]?.id ?? '');
    setFormError(null);
    setModal({ mode: 'create' });
  };

  const openDelete = (ct: ClassTeacher) => { setModal({ mode: 'delete', item: ct }); };
  const closeModal = () => setModal({ mode: 'closed' });

  const handleSave = async () => {
    if (!formClassSectionId) { setFormError('Veuillez choisir une section de classe.'); return; }
    if (!formTeacherId) { setFormError('Veuillez choisir un enseignant.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const body = {
        classSectionId: formClassSectionId,
        teacherId: formTeacherId,
      };
      const res = await fetch('/api/academics/class-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      fetchClassTeachers(page);
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
      const res = await fetch(`/api/academics/class-teachers?id=${modal.item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      const newPage = items.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      fetchClassTeachers(newPage);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSaving(false);
    }
  };

  const getClassSectionLabel = (csId: string) => {
    const cs = classSections.find(x => x.id === csId);
    if (!cs) return csId;
    const cName = classesList.find(c => c.id === cs.classId)?.name ?? cs.classId;
    const sName = sectionsList.find(s => s.id === cs.sectionId)?.name ?? cs.sectionId;
    return `${cName} — ${sName}`;
  };

  const getTeacherName = (tId: string) => teachersList.find(t => t.id === tId)?.fullName ?? tId;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Enseignants Principaux / Professeurs Principaux
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Affectation des professeurs principaux par section de classe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-2 text-xs font-bold h-9 rounded-xl"
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Affecter un enseignant principal</span>
          </Button>
        </div>
      </div>

      {/* Stat Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5 text-[#2487B8]" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Enseignants principaux désignés</p>
            <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              {loading ? '—' : total}
            </p>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <h3 className="text-base font-extrabold text-[#0F172A] mb-3">
          Professeurs Principaux désignés
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
                    <th className="py-3 px-3">Classe & Section</th>
                    <th className="py-3 px-3">Enseignant Principal</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-slate-400 text-xs">
                        Aucun enseignant principal désigné. Cliquez sur « Affecter » pour commencer.
                      </td>
                    </tr>
                  )}
                  {items.map(ct => (
                    <tr key={ct.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-[#0F172A]">{getClassSectionLabel(ct.classSectionId)}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-[#2487B8]">{getTeacherName(ct.teacherId)}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          onClick={() => openDelete(ct)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-500"
                          title="Retirer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

      {/* Create Modal */}
      {modal.mode === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#0F172A]">
                Affecter un enseignant principal
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Section de Classe <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white text-[#0F172A] font-medium"
                  value={formClassSectionId}
                  onChange={e => setFormClassSectionId(e.target.value)}
                >
                  <option value="">Sélectionner une classe/section…</option>
                  {classSections.map(cs => (
                    <option key={cs.id} value={cs.id}>{getClassSectionLabel(cs.id)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Enseignant <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white text-[#0F172A] font-medium"
                  value={formTeacherId}
                  onChange={e => setFormTeacherId(e.target.value)}
                >
                  <option value="">Sélectionner un enseignant…</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.id}>{t.fullName}</option>
                  ))}
                </select>
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
                  Affecter
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
                <h2 className="text-base font-extrabold text-[#0F172A]">Retirer le professeur principal</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Retirer <strong>{getTeacherName(modal.item.teacherId)}</strong> de la classe <strong>{getClassSectionLabel(modal.item.classSectionId)}</strong> ?
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
