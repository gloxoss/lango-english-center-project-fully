'use client';

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Hash,
  Pencil,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
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
  incomplete: number;
};

type FilterType = 'all' | 'missing_matricule' | 'missing_massar' | 'incomplete';

const MASSAR_REGEX = /^[A-Z]\d{9}$/i;

export function MatriculesView() {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const { role } = usePermissions();

  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [nextMatricule, setNextMatricule] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [stats, setStats] = useState<MatriculeStats | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Edit dialog state
  const [editingStudent, setEditingStudent] = useState<ApiStudent | null>(null);
  const [editMatricule, setEditMatricule] = useState('');
  const [editCodeMassar, setEditCodeMassar] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStudents = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }
    if (filterType !== 'all') {
      params.set('identifierFilter', filterType);
    }

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
  }, [page, pageSize, searchTerm, filterType]);

  const loadStatsAndPreview = useCallback(() => {
    fetch('/api/students/matricules')
      .then(res => res.json())
      .then((json) => {
        if (json.success) {
          setNextMatricule(json.matricule);
          if (json.stats) {
            setStats(json.stats);
          }
          setStatsError(null);
        } else {
          setStatsError(json?.error?.message || json?.message || 'Impossible de charger les statistiques de matricules.');
        }
      })
      .catch(() => setStatsError('Erreur réseau : impossible de charger les statistiques de matricules.'));
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchStudents, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchStudents, searchTerm]);

  useEffect(() => {
    loadStatsAndPreview();
  }, [loadStatsAndPreview]);

  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
  };

  const handlePageSizeChange = (val: number) => {
    setPageSize(val);
    setPage(1);
  };

  async function handleAutoAssignNext() {
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/students/matricules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message || json.message || 'Échec de l\'attribution du matricule.');
        return;
      }

      if (json.allAssigned) {
        setSuccessMessage(json.message || 'Tous les élèves disposent déjà d\'un matricule attribué.');
      } else {
        setSuccessMessage(json.message || `Matricule ${json.matricule} attribué avec succès.`);
        fetchStudents();
      }
      loadStatsAndPreview();
    } catch (err) {
      console.error('Matricule assignment failed', err);
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
    if (!editingStudent) {
      return;
    }

    const trimmedMassar = editCodeMassar.trim().toUpperCase();
    if (trimmedMassar && !MASSAR_REGEX.test(trimmedMassar)) {
      setEditError(`Le Code Massar "${trimmedMassar}" est invalide. Format attendu : 1 lettre suivie de 9 chiffres (ex: G134567890).`);
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await fetch('/api/students/matricules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editingStudent.id,
          matricule: editMatricule.trim().toUpperCase() || null,
          codeMassar: trimmedMassar || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setEditError(json?.error?.message || json.message || 'Impossible de mettre à jour les identifiants.');
        return;
      }

      setStudents(prev => prev.map(s => (s.id === editingStudent.id
        ? {
            ...s,
            matricule: json.data?.matricule ?? (editMatricule.trim().toUpperCase() || null),
            codeMassar: json.data?.codeMassar ?? (trimmedMassar || null),
          }
        : s)));

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
  const incompleteCount = stats ? stats.incomplete : Math.max(missingMatriculeCount, missingMassarCount);

  const massarFormatWarning = editCodeMassar.trim() !== '' && !MASSAR_REGEX.test(editCodeMassar.trim().toUpperCase());

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('matriculesTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            Gestion conjointe du
            {' '}
            <strong>Code Massar</strong>
            {' '}
            (Ministère MEN) et du
            {' '}
            <strong>Matricule Interne</strong>
            {' '}
            pour chaque élève.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="
          grid grid-cols-1 gap-3
          sm:grid-cols-2
          lg:grid-cols-4
        "
        >
          <Card
            onClick={() => handleFilterChange('all')}
            className={`
              cursor-pointer rounded-2xl border bg-white p-4 transition-all
              ${filterType === 'all'
      ? `border-[#16212B] ring-2 ring-slate-900/10`
      : `
        border-slate-200/80
        hover:border-slate-300
      `}
              flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]
            `}
          >
            <div className="
              flex size-10 shrink-0 items-center justify-center rounded-xl
              bg-[#DCEBF4] text-[#1B6C93]
            "
            >
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">{t('totalStudents')}</p>
              <p className="text-xl font-extrabold text-[#16212B]">{totalCount}</p>
              <p className="text-[10px] font-semibold text-[#17A673]">{t('enrolledInSystem')}</p>
            </div>
          </Card>

          <Card
            onClick={() => handleFilterChange('missing_massar')}
            className={`
              cursor-pointer rounded-2xl border bg-white p-4 transition-all
              ${filterType === 'missing_massar'
      ? `border-[#17A673] ring-2 ring-emerald-500/20`
      : `
        border-slate-200/80
        hover:border-slate-300
      `}
              flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]
            `}
          >
            <div className="
              flex size-10 shrink-0 items-center justify-center rounded-xl
              bg-[#DDF5EC] text-[#17A673]
            "
            >
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Codes Massar (MEN)</p>
              <p className="text-xl font-extrabold text-[#17A673]">{assignedMassarCount}</p>
              <p className="text-[10px] font-semibold text-slate-500">
                {missingMassarCount > 0 ? `${missingMassarCount} à renseigner` : '100% renseignés'}
              </p>
            </div>
          </Card>

          <Card
            onClick={() => handleFilterChange('missing_matricule')}
            className={`
              cursor-pointer rounded-2xl border bg-white p-4 transition-all
              ${filterType === 'missing_matricule'
      ? `border-[#2487B8] ring-2 ring-sky-500/20`
      : `
        border-slate-200/80
        hover:border-slate-300
      `}
              flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]
            `}
          >
            <div className="
              flex size-10 shrink-0 items-center justify-center rounded-xl
              bg-sky-50 text-[#2487B8]
            "
            >
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Matricules Internes</p>
              <p className="text-xl font-extrabold text-[#2487B8]">{assignedMatriculeCount}</p>
              <p className="text-[10px] font-semibold text-slate-500">
                {missingMatriculeCount > 0 ? `${missingMatriculeCount} à générer` : '100% attribués'}
              </p>
            </div>
          </Card>

          <Card
            onClick={() => handleFilterChange('incomplete')}
            className={`
              cursor-pointer rounded-2xl border bg-white p-4 transition-all
              ${filterType === 'incomplete'
      ? `border-amber-500 ring-2 ring-amber-500/20`
      : `
        border-slate-200/80
        hover:border-slate-300
      `}
              flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]
            `}
          >
            <div className="
              flex size-10 shrink-0 items-center justify-center rounded-xl
              bg-amber-50 text-amber-600
            "
            >
              <Hash className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Identifiants Incomplets</p>
              <p className="text-xl font-extrabold text-amber-600">
                {incompleteCount}
              </p>
              <p className="text-[10px] font-semibold text-amber-700">À régulariser</p>
            </div>
          </Card>
        </div>

        {error && (
          <div className="
            flex items-center gap-2.5 rounded-xl border border-rose-200
            bg-rose-50 p-3.5 text-xs font-semibold text-rose-700
          "
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="
            flex items-center gap-2.5 rounded-xl border border-emerald-200
            bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800
          "
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Filters and search bar */}
        <div className="
          flex flex-wrap items-center justify-between gap-3 rounded-2xl border
          border-slate-200/80 bg-white p-3 shadow-2xs
        "
        >
          <div className="relative min-w-[280px] flex-1">
            <Search className="
              absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400
            "
            />
            <Input
              placeholder="Rechercher par nom, matricule interne ou Code Massar..."
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              className="h-10 rounded-xl border-none bg-slate-50 pl-10 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('all')}
              className={`
                h-8 rounded-xl text-xs font-bold
                ${filterType === 'all'
      ? `bg-[#16212B] text-white`
      : `border-slate-200 text-slate-600`}
              `}
            >
              Tous
            </Button>
            <Button
              variant={filterType === 'missing_massar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('missing_massar')}
              className={`
                h-8 rounded-xl text-xs font-bold
                ${filterType === 'missing_massar'
      ? `bg-[#17A673] text-white`
      : `border-slate-200 text-slate-600`}
              `}
            >
              Sans Massar (
              {missingMassarCount}
              )
            </Button>
            <Button
              variant={filterType === 'missing_matricule' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('missing_matricule')}
              className={`
                h-8 rounded-xl text-xs font-bold
                ${filterType === 'missing_matricule'
      ? `bg-[#2487B8] text-white`
      : `border-slate-200 text-slate-600`}
              `}
            >
              Sans Matricule (
              {missingMatriculeCount}
              )
            </Button>
            <Button
              variant={filterType === 'incomplete' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('incomplete')}
              className={`
                h-8 rounded-xl text-xs font-bold
                ${filterType === 'incomplete'
      ? `bg-amber-600 text-white`
      : `border-slate-200 text-slate-600`}
              `}
            >
              Incomplets (
              {incompleteCount}
              )
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className="
          overflow-hidden rounded-2xl border border-slate-200/80 bg-white
          shadow-2xs
        "
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="
                border-b border-slate-200/80 bg-[#F6F9FC] font-semibold
                text-slate-500
              "
              >
                <tr>
                  <th className="px-4 py-3">{t('studentNameCol')}</th>
                  <th className="px-4 py-3">{t('classCol')}</th>
                  <th className="px-4 py-3">Code Massar (MEN)</th>
                  <th className="px-4 py-3">Matricule Interne</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {!loading && students.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      {t('noStudentsFound')}
                    </td>
                  </tr>
                )}
                {students.map(s => (
                  <tr
                    key={s.id}
                    className="
                      transition-colors
                      hover:bg-slate-50/80
                    "
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="
                          flex size-8 items-center justify-center rounded-full
                          bg-[#DCEBF4] text-[10px] font-bold text-[#1B6C93]
                        "
                        >
                          {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-bold text-[#16212B]">{s.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-600">{s.className ?? '—'}</td>

                    {/* Code Massar */}
                    <td className="px-4 py-3.5">
                      {s.codeMassar
                        ? (
                            <span className="
                              inline-flex items-center gap-1.5 rounded-lg border
                              border-emerald-200 bg-emerald-50 px-2.5 py-1
                              font-mono text-xs font-bold text-emerald-800
                            "
                            >
                              <span className="
                                rounded-sm bg-emerald-200/80 px-1 py-0.5
                                font-sans text-[10px] font-black
                                text-emerald-900 uppercase
                              "
                              >
                                Massar
                              </span>
                              {s.codeMassar}
                            </span>
                          )
                        : (
                            <button
                              type="button"
                              onClick={() => openEditModal(s)}
                              className="
                                inline-flex cursor-pointer items-center gap-1
                                rounded-full border border-amber-200 bg-amber-50
                                px-2.5 py-0.5 text-[11px] font-semibold
                                text-amber-700 transition-colors
                                hover:bg-amber-100
                              "
                            >
                              <ShieldAlert className="size-3 text-amber-600" />
                              + Renseigner Massar
                            </button>
                          )}
                    </td>

                    {/* Matricule Interne */}
                    <td className="px-4 py-3.5">
                      {s.matricule
                        ? (
                            <span className="
                              inline-flex items-center gap-1.5 rounded-lg border
                              border-sky-200 bg-sky-50 px-2.5 py-1 font-mono
                              text-xs font-bold text-[#1B6C93]
                            "
                            >
                              <span className="
                                rounded-sm bg-sky-200/80 px-1 py-0.5 font-sans
                                text-[10px] font-black text-sky-900 uppercase
                              "
                              >
                                École
                              </span>
                              {s.matricule}
                            </span>
                          )
                        : (
                            <button
                              type="button"
                              onClick={() => openEditModal(s)}
                              className="
                                inline-flex cursor-pointer items-center gap-1
                                rounded-full border border-slate-200
                                bg-slate-100 px-2.5 py-0.5 text-[11px]
                                font-semibold text-slate-600 transition-colors
                                hover:bg-slate-200
                              "
                            >
                              <Wand2 className="size-3 text-slate-500" />
                              + Attribuer Matricule
                            </button>
                          )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(s)}
                        className="
                          h-7 gap-1.5 rounded-lg border-slate-200 px-2.5 text-xs
                          font-semibold text-slate-700
                          hover:text-[#2487B8]
                        "
                      >
                        <Pencil className="size-3" />
                        Modifier
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="
              flex items-center justify-between border-t border-slate-100 px-4
              py-3 text-xs text-slate-500
            "
            >
              <div className="flex items-center gap-2">
                <span>{t('showing')}</span>
                <select
                  className="
                    rounded-lg border border-slate-200 px-2 py-1 text-xs
                    font-bold text-[#16212B]
                  "
                  value={pageSize}
                  onChange={e => handlePageSizeChange(Number(e.target.value))}
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
                  className="
                    rounded-lg border border-slate-200 px-2 py-1 font-bold
                    text-[#16212B]
                    hover:bg-slate-50
                    disabled:cursor-not-allowed disabled:opacity-40
                  "
                >
                  {tCommon('previous')}
                </button>
                <span>{t('pageOf', { page, total: Math.max(1, Math.ceil(total / pageSize)) })}</span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(p => p + 1)}
                  className="
                    rounded-lg border border-slate-200 px-2 py-1 font-bold
                    text-[#16212B]
                    hover:bg-slate-50
                    disabled:cursor-not-allowed disabled:opacity-40
                  "
                >
                  {tCommon('next')}
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Panel - sequential generator and explanation */}
      {role === 'school_admin' && (
        <div className="
          sticky top-6 hidden max-h-[calc(100vh-3rem)] w-[320px] shrink-0
          space-y-4 self-start overflow-y-auto
          xl:block
        "
        >
          {/* Sequential Generator Card */}
          <Card className="
            space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5
            shadow-2xs
          "
          >
            <h3 className="text-sm font-extrabold text-[#16212B]">{t('generateNextMatricule')}</h3>
            <p className="text-[11px] text-slate-500">
              Générateur séquentiel interne de l'école (format
              {' '}
              <code>
                STD-
                {new Date().getFullYear()}
                -####
              </code>
              ).
            </p>
            {statsError && (
              <div className="
                space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3
                text-center
              "
              >
                <p className="text-[11px] font-bold text-amber-900">{statsError}</p>
                <button
                  type="button"
                  onClick={loadStatsAndPreview}
                  className="
                    cursor-pointer text-[11px] font-bold text-amber-900
                    underline
                  "
                >
                  Réessayer
                </button>
              </div>
            )}
            {nextMatricule && (
              <div className="
                rounded-xl border border-slate-200 bg-slate-50 p-3 text-center
              "
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase">Aperçu prochain numéro</p>
                <p className="font-mono text-lg font-extrabold text-[#2487B8]">{nextMatricule}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Non consommé lors de l'aperçu</p>
              </div>
            )}

            {missingMatriculeCount > 0
              ? (
                  <Button
                    className="
                      h-10 w-full cursor-pointer gap-2 rounded-xl bg-[#2487B8]
                      text-xs font-bold text-white
                      hover:bg-[#1B6C93]
                    "
                    disabled={generating}
                    onClick={handleAutoAssignNext}
                  >
                    <Wand2 className="size-4" />
                    <span>{generating ? 'Attribution en cours...' : 'Attribuer au 1er élève sans matricule'}</span>
                  </Button>
                )
              : (
                  <div className="
                    space-y-1 rounded-xl border border-emerald-200 bg-emerald-50
                    p-3 text-center
                  "
                  >
                    <div className="
                      flex items-center justify-center gap-1.5 text-xs font-bold
                      text-emerald-800
                    "
                    >
                      <CheckCircle2 className="size-4 text-[#17A673]" />
                      <span>Tous matriculés</span>
                    </div>
                    <p className="text-[10px] text-emerald-700">
                      Prêt pour la prochaine inscription scolaire.
                    </p>
                  </div>
                )}
          </Card>

          {/* Educational guide on Massar vs Internal Matricule */}
          <Card className="
            space-y-3 rounded-2xl border border-emerald-200/80 bg-linear-to-br
            from-emerald-50/70 to-teal-50/50 p-5
          "
          >
            <div className="flex items-center gap-2">
              <span className="
                flex size-6 items-center justify-center rounded-lg bg-[#17A673]
                text-xs font-black text-white
              "
              >
                🇲🇦
              </span>
              <h4 className="text-xs font-extrabold text-[#16212B]">Double Traçabilité Scolaire</h4>
            </div>
            <div className="
              space-y-2 text-[11px] leading-relaxed text-slate-600
            "
            >
              <p>
                <strong>1. Code Massar (MEN) :</strong>
                <br />
                Identifiant national unique délivré par le Ministère (ex:
                {' '}
                <code>G134567890</code>
                ). Indispensable pour la synchronisation Massar, les bulletins officiels /20 et les examens d'État.
              </p>
              <p>
                <strong>2. Matricule Interne (École) :</strong>
                <br />
                Identifiant propre à votre établissement (ex:
                {' '}
                <code>STD-2026-0042</code>
                ). Utilisé pour les cartes d'étudiants, le pointage et la comptabilité de caisse.
              </p>
              <div className="
                border-t border-emerald-200 pt-2 text-[10px] font-bold
                text-emerald-800
              "
              >
                Vous pouvez utiliser les deux identifiants conjointement pour chaque élève.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Student Identifiers Modal */}
      {editingStudent && (
        <Dialog
          open={!!editingStudent}
          onOpenChange={(open) => {
            if (!open) {
              setEditingStudent(null);
            }
          }}
        >
          <DialogContent className="
            rounded-2xl
            sm:max-w-[480px]
          "
          >
            <DialogHeader>
              <DialogTitle className="
                flex items-center gap-2 text-base font-extrabold text-[#16212B]
              "
              >
                <Pencil className="size-4 text-[#2487B8]" />
                Modifier les identifiants
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="
                flex items-center justify-between rounded-xl border
                border-slate-200 bg-slate-50 p-3
              "
              >
                <div>
                  <p className="text-sm font-bold text-[#16212B]">{editingStudent.fullName}</p>
                  <p className="text-[11px] text-slate-500">
                    Classe :
                    {editingStudent.className ?? 'Non affecté'}
                  </p>
                </div>
              </div>

              {editError && (
                <div className="
                  flex items-center gap-2 rounded-xl border border-rose-200
                  bg-rose-50 p-3 text-xs font-semibold text-rose-700
                "
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Code Massar Field */}
              <div className="space-y-1.5">
                <label className="
                  flex items-center justify-between font-bold text-slate-700
                "
                >
                  <span>Code Massar (Ministère de l'Éducation Nationale)</span>
                  <span className="text-[10px] font-semibold text-emerald-700">Ex: G134567890</span>
                </label>
                <Input
                  value={editCodeMassar}
                  onChange={e => setEditCodeMassar(e.target.value.toUpperCase())}
                  placeholder="Ex: G134567890, R123456789, M123456789..."
                  className={`
                    font-mono text-xs uppercase
                    ${massarFormatWarning
          ? `
            border-amber-400
            focus-visible:ring-amber-400
          `
          : ''}
                  `}
                />
                {massarFormatWarning
                  ? (
                      <p className="text-[10px] font-semibold text-amber-600">
                        Format attendu : 1 lettre majuscule suivie de 9 chiffres (ex: G134567890).
                      </p>
                    )
                  : (
                      <p className="text-[10px] text-slate-400">
                        Code national de l'élève (CNE). Requis pour les imports/exports Massar officiels.
                      </p>
                    )}
              </div>

              {/* Internal Matricule Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Matricule Interne (Établissement)</label>
                  {nextMatricule && (
                    <button
                      type="button"
                      onClick={() => setEditMatricule(nextMatricule)}
                      className="
                        flex cursor-pointer items-center gap-1 text-[10px]
                        font-bold text-[#2487B8]
                        hover:underline
                      "
                    >
                      <Sparkles className="size-3" />
                      Insérer le suivant (
                      {nextMatricule}
                      )
                    </button>
                  )}
                </div>
                <Input
                  value={editMatricule}
                  onChange={e => setEditMatricule(e.target.value.toUpperCase())}
                  placeholder="Ex: STD-2026-0042 ou ATL-2526-0091..."
                  className="font-mono text-xs uppercase"
                />
                <p className="text-[10px] text-slate-400">
                  Numéro de série interne de l'école pour les cartes scolaires, la caisse et la présence.
                </p>
              </div>
            </div>

            <DialogFooter className="
              gap-2
              sm:gap-0
            "
            >
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
                className="
                  cursor-pointer rounded-xl bg-[#17A673] text-xs font-bold
                  text-white
                  hover:bg-[#13885E]
                "
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
