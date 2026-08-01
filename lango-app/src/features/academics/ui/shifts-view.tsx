'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

type Shift = { id: string; name: string; schoolId: string };

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; shift: Shift }
  | { mode: 'delete'; shift: Shift };

const PAGE_SIZE = 20;

export function ShiftsView({ locale: _locale }: { locale: string }) {
  const [items, setItems] = useState<Shift[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchShifts = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/academics/shifts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError('Impossible de charger les horaires / créneaux.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShifts(page); }, [fetchShifts, page]);

  const openCreate = () => { setFormName(''); setFormError(null); setModal({ mode: 'create' }); };
  const openEdit = (s: Shift) => { setFormName(s.name); setFormError(null); setModal({ mode: 'edit', shift: s }); };
  const openDelete = (s: Shift) => { setModal({ mode: 'delete', shift: s }); };
  const closeModal = () => setModal({ mode: 'closed' });

  const handleSave = async () => {
    if (!formName.trim()) { setFormError('Le nom est requis.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const isEdit = modal.mode === 'edit';
      const body = isEdit
        ? { id: (modal as { mode: 'edit'; shift: Shift }).shift.id, name: formName.trim() }
        : { name: formName.trim() };
      const res = await fetch('/api/academics/shifts', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      fetchShifts(page);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal.mode !== 'delete') return;
    setSaving(true);
    try {
      const res = await fetch(`/api/academics/shifts?id=${modal.shift.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
      closeModal();
      const newPage = items.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      fetchShifts(newPage);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Créneaux / Shifts horaires
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Configuration des plages horaires et équipes (Matin, Après-midi, Soir…)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher un créneau…"
              className="pl-9 h-9 text-xs rounded-xl w-[220px] border-slate-200"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            className="bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-2 text-xs font-bold h-9 rounded-xl"
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un créneau</span>
          </Button>
        </div>
      </div>

      {/* Stat Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-[#2487B8]" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Créneaux configurés</p>
            <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              {loading ? '—' : total}
            </p>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <h3 className="text-base font-extrabold text-[#0F172A] mb-3">
          Liste des créneaux
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
                    <th className="py-3 px-3">Nom du créneau</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-10 text-center text-slate-400 text-xs">
                        {search ? 'Aucun résultat pour cette recherche.' : 'Aucun créneau configuré. Cliquez sur « Ajouter » pour commencer.'}
                      </td>
                    </tr>
                  )}
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                          <p className="font-bold text-[#0F172A]">{s.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button
                            onClick={() => openDelete(s)}
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
                {total} créneau{total !== 1 ? 'x' : ''} au total
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
                {modal.mode === 'create' ? 'Ajouter un créneau' : 'Modifier le créneau'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nom du créneau <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="ex: Matin (08h-12h), Après-midi (14h-18h), Soir…"
                  className="h-9 text-xs rounded-xl"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                {formError && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{formError}</p>
                )}
              </div>
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
                  {modal.mode === 'create' ? 'Ajouter' : 'Enregistrer'}
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
                <h2 className="text-base font-extrabold text-[#0F172A]">Supprimer le créneau</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Supprimer <strong>{modal.shift.name}</strong> ? Cette action est irréversible.
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
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
