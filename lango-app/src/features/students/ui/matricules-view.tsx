'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Wand2,
  Search,
  AlertCircle,
  Users,
  CheckCircle2,
  Hash,
  Pencil,
  Building2,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type ApiStudent = {
  id: string;
  fullName: string;
  className: string | null;
  matricule: string | null;
  codeMassar: string | null;
};

type MatriculeStats = {
  total: number;
  assigned: number;
  missing: number;
  assignedMassar: number;
  missingMassar: number;
};

export function MatriculesView() {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const { role } = usePermissions();

  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [nextMatricule, setNextMatricule] = useState<string | null>(null);
  const [reserved, setReserved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [stats, setStats] = useState<MatriculeStats | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'missing_matricule' | 'missing_massar'>('all');

  // Edit dialog state
  const [editingStudent, setEditingStudent] = useState<ApiStudent | null>(null);
  const [editMatricule, setEditMatricule] = useState('');
  const [editCodeMassar, setEditCodeMassar] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchStudents = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    fetch(`/api/students?${params}`)
      .then(res => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setStudents(json.data.map((s: any) => ({
            id: s.id,
            fullName: s.fullName,
            className: s.className,
            matricule: s.matricule ?? null,
            codeMassar: s.codeMassar ?? s.nationalId ?? null,
          })));
          setTotal(json.total ?? 0);
        }
      })
      .catch(err => console.error('Failed loading students', err))
      .finally(() => setLoading(false));
  };

  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStatsAndPreview = () => {
    setStatsError(null);
    fetch('/api/students/matricules')
      .then(res => res.json())
      .then((json) => {
        if (json.success) {
          setNextMatricule(json.matricule);
          if (json.stats) {
            setStats(json.stats);
          }
        } else {
          setStatsError(json?.error?.message || json?.message || 'Impossible de charger les statistiques de matricules.');
        }
      })
      .catch(() => setStatsError('Erreur réseau : impossible de charger les statistiques de matricules.'));
  };

  useEffect(() => {
    const timer = setTimeout(fetchStudents, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [page, pageSize, searchTerm]);

  useEffect(() => {
    loadStatsAndPreview();
  }, []);

  async function handleReserveNext() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/students/matricules', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la réservation du matricule.');
        return;
      }
      setNextMatricule(json.matricule);
      setReserved(true);
      loadStatsAndPreview();
    } catch (err) {
      console.error('Matricule reservation failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setGenerating(false);
    }
  }

  function openEditModal(student: ApiStudent) {
    setEditingStudent(student);
    setEditMatricule(student.matricule ?? '');
    setEditCodeMassar(student.codeMassar ?? '');
    setEditError(null);
  }

  async function handleSaveIdentifiers() {
    if (!editingStudent) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await fetch('/api/students/matricules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editingStudent.id,
          matricule: editMatricule.trim() || null,
          codeMassar: editCodeMassar.trim().toUpperCase() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setEditError(json.message || 'Impossible de mettre à jour les identifiants.');
        return;
      }

      // Update local state
      setStudents(prev => prev.map(s => (s.id === editingStudent.id ? {
        ...s,
        matricule: editMatricule.trim() || null,
        codeMassar: editCodeMassar.trim().toUpperCase() || null,
      } : s)));

      setEditingStudent(null);
      loadStatsAndPreview();
    } catch (err) {
      console.error('Failed updating identifiers', err);
      setEditError('Erreur de communication avec le serveur.');
    } finally {
      setSavingEdit(false);
    }
  }

  const totalCount = stats ? stats.total : total;
  const assignedMatriculeCount = stats ? stats.assigned : students.filter(s => s.matricule).length;
  const missingMatriculeCount = stats ? stats.missing : Math.max(0, totalCount - assignedMatriculeCount);
  const assignedMassarCount = stats ? stats.assignedMassar : students.filter(s => s.codeMassar).length;
  const missingMassarCount = stats ? stats.missingMassar : Math.max(0, totalCount - assignedMassarCount);

  const filteredStudents = students.filter(s => {
    if (filterType === 'missing_matricule') return !s.matricule;
    if (filterType === 'missing_massar') return !s.codeMassar;
    return true;
  });

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      <div className="flex-1 space-y-6 min-w-0">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('matriculesTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion conjointe du <strong>Code Massar</strong> (Ministère MEN) et du <strong>Matricule Interne</strong> pour chaque élève.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">{t('totalStudents')}</p>
              <p className="text-xl font-extrabold text-[#16212B]">{totalCount}</p>
              <p className="text-[10px] font-semibold text-[#17A673]">{t('enrolledInSystem')}</p>
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Codes Massar (MEN)</p>
              <p className="text-xl font-extrabold text-[#17A673]">{assignedMassarCount}</p>
              <p className="text-[10px] font-semibold text-slate-500">
                {missingMassarCount > 0 ? `${missingMassarCount} à renseigner` : '100% renseignés'}
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 shrink-0 flex items-center justify-center text-[#2487B8]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Matricules Internes</p>
              <p className="text-xl font-extrabold text-[#2487B8]">{assignedMatriculeCount}</p>
              <p className="text-[10px] font-semibold text-slate-500">
                {missingMatriculeCount > 0 ? `${missingMatriculeCount} à générer` : '100% attribués'}
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 shrink-0 flex items-center justify-center text-amber-600">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Identifiants Incomplets</p>
              <p className="text-xl font-extrabold text-amber-600">
                {Math.max(missingMatriculeCount, missingMassarCount)}
              </p>
              <p className="text-[10px] font-semibold text-amber-700">À régulariser</p>
            </div>
          </Card>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filters and search bar */}
        <div className="bg-white p-3 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-wrap items-center gap-3 justify-between">
          <div className="relative min-w-[280px] flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher par nom, matricule interne ou Code Massar..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="pl-10 h-10 text-xs bg-slate-50 border-none rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
              className={`h-8 rounded-xl text-xs font-bold ${filterType === 'all' ? 'bg-[#16212B] text-white' : 'border-slate-200 text-slate-600'}`}
            >
              Tous
            </Button>
            <Button
              variant={filterType === 'missing_massar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('missing_massar')}
              className={`h-8 rounded-xl text-xs font-bold ${filterType === 'missing_massar' ? 'bg-[#17A673] text-white' : 'border-slate-200 text-slate-600'}`}
            >
              Sans Massar ({missingMassarCount})
            </Button>
            <Button
              variant={filterType === 'missing_matricule' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('missing_matricule')}
              className={`h-8 rounded-xl text-xs font-bold ${filterType === 'missing_matricule' ? 'bg-[#2487B8] text-white' : 'border-slate-200 text-slate-600'}`}
            >
              Sans Matricule ({missingMatriculeCount})
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">{t('studentNameCol')}</th>
                  <th className="py-3 px-4">{t('classCol')}</th>
                  <th className="py-3 px-4">Code Massar (MEN)</th>
                  <th className="py-3 px-4">Matricule Interne</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {!loading && filteredStudents.length === 0 && (
                  <tr><td colSpan={5} className="py-8 px-4 text-center text-slate-400">{t('noStudentsFound')}</td></tr>
                )}
                {filteredStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center text-[10px] font-bold">
                          {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-bold text-[#16212B]">{s.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-bold">{s.className ?? '—'}</td>

                    {/* Code Massar */}
                    <td className="py-3.5 px-4">
                      {s.codeMassar ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-mono text-xs font-bold border border-emerald-200">
                          <span className="text-[10px] uppercase font-sans font-black bg-emerald-200/80 text-emerald-900 px-1 py-0.2 rounded">Massar</span>
                          {s.codeMassar}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                        >
                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                          + Renseigner Massar
                        </button>
                      )}
                    </td>

                    {/* Matricule Interne */}
                    <td className="py-3.5 px-4">
                      {s.matricule ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-[#1B6C93] font-mono text-xs font-bold border border-sky-200">
                          <span className="text-[10px] uppercase font-sans font-black bg-sky-200/80 text-sky-900 px-1 py-0.2 rounded">École</span>
                          {s.matricule}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                        >
                          <Wand2 className="w-3 h-3 text-slate-500" />
                          + Attribuer Matricule
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(s)}
                        className="h-7 px-2.5 rounded-lg text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 hover:text-[#2487B8]"
                      >
                        <Pencil className="w-3 h-3" />
                        Modifier
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>{t('showing')}</span>
                <select
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-[#16212B]"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>{t('outOfTotal', { total })}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-lg border border-slate-200 font-bold text-[#16212B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  {tCommon('previous')}
                </button>
                <span>{t('pageOf', { page, total: Math.max(1, Math.ceil(total / pageSize)) })}</span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 rounded-lg border border-slate-200 font-bold text-[#16212B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  {tCommon('next')}
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Panel - reserving and explanation */}
      {role === 'school_admin' && (
        <div className="w-[320px] shrink-0 space-y-4 hidden xl:block sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
          {/* Reservation card */}
          <Card className="p-5 bg-white rounded-2xl shadow-2xs border border-slate-200/80 space-y-3">
            <h3 className="text-sm font-extrabold text-[#16212B]">{t('generateNextMatricule')}</h3>
            <p className="text-[11px] text-slate-500">
              Génère le prochain numéro séquentiel interne de l'école (format <code>STD-2026-####</code>).
            </p>
            {statsError && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-2">
                <p className="text-[11px] font-bold text-amber-900">{statsError}</p>
                <button
                  type="button"
                  onClick={loadStatsAndPreview}
                  className="text-[11px] font-bold text-amber-900 underline cursor-pointer"
                >
                  Réessayer
                </button>
              </div>
            )}
            {nextMatricule && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{reserved ? t('reservedBadge') : t('previewBadge')}</p>
                <p className="text-lg font-extrabold font-mono text-[#2487B8]">{nextMatricule}</p>
              </div>
            )}
            <Button
              className="w-full gap-2 h-10 rounded-xl text-xs bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold cursor-pointer"
              disabled={generating}
              onClick={handleReserveNext}
            >
              <Wand2 className="w-4 h-4" />
              <span>{generating ? t('reserving') : t('reserveMatricule')}</span>
            </Button>
          </Card>

          {/* Educational guide on Massar vs Internal Matricule */}
          <Card className="p-5 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#17A673] text-white flex items-center justify-center font-black text-xs">🇲🇦</span>
              <h4 className="text-xs font-extrabold text-[#16212B]">Double Traçabilité Scolaire</h4>
            </div>
            <div className="space-y-2 text-[11px] text-slate-600 leading-relaxed">
              <p>
                <strong>1. Code Massar (MEN) :</strong>
                <br />
                Identifiant national unique délivré par le Ministère (ex: <code>G134567890</code>). Indispensable pour la synchronisation Massar, les bulletins officiels /20 et les examens d'État.
              </p>
              <p>
                <strong>2. Matricule Interne (École) :</strong>
                <br />
                Identifiant propre à votre établissement (ex: <code>STD-2026-0042</code>). Utilisé pour les cartes d'étudiants, le pointage et la comptabilité de caisse.
              </p>
              <div className="pt-2 border-t border-emerald-200 text-[10px] font-bold text-emerald-800">
                Vous pouvez utiliser les deux identifiants conjointement pour chaque élève.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Student Identifiers Modal */}
      {editingStudent && (
        <Dialog open={!!editingStudent} onOpenChange={open => { if (!open) setEditingStudent(null); }}>
          <DialogContent className="sm:max-w-[480px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#2487B8]" />
                Modifier les identifiants
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#16212B] text-sm">{editingStudent.fullName}</p>
                  <p className="text-slate-500 text-[11px]">Classe : {editingStudent.className ?? 'Non affecté'}</p>
                </div>
              </div>

              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Code Massar Field */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Code Massar (Ministère de l'Éducation Nationale)</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">Ex: G134567890</span>
                </label>
                <Input
                  value={editCodeMassar}
                  onChange={e => setEditCodeMassar(e.target.value.toUpperCase())}
                  placeholder="Ex: G134567890, R123456789, M123456789..."
                  className="font-mono text-xs uppercase"
                />
                <p className="text-[10px] text-slate-400">
                  Code national de l'élève (CNE). Requis pour les imports/exports Massar officiels.
                </p>
              </div>

              {/* Internal Matricule Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Matricule Interne (Établissement)</label>
                  {nextMatricule && (
                    <button
                      type="button"
                      onClick={() => setEditMatricule(nextMatricule)}
                      className="text-[10px] text-[#2487B8] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Insérer le suivant ({nextMatricule})
                    </button>
                  )}
                </div>
                <Input
                  value={editMatricule}
                  onChange={e => setEditMatricule(e.target.value)}
                  placeholder="Ex: STD-2026-0042 ou ATL-2526-0091..."
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400">
                  Numéro de série interne de l'école pour les cartes scolaires, la caisse et la présence.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingStudent(null)}
                disabled={savingEdit}
                className="rounded-xl text-xs font-bold"
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSaveIdentifiers}
                disabled={savingEdit}
                className="rounded-xl text-xs font-bold bg-[#17A673] hover:bg-[#13885E] text-white cursor-pointer"
              >
                {savingEdit ? 'Enregistrement...' : 'Enregistrer les identifiants'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
