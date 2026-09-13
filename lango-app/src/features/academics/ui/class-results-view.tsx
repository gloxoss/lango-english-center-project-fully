'use client';

import {
  AlertCircle,
  Award,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Class results: the real ranking, averages and mention distribution for one
 * class-subject.
 *
 * This screen used to be eight invented students with invented scores and a
 * pagination bar that paginated nothing — "Affichage de 1 à 8 sur 92 élèves" over
 * a hardcoded array of eight. Everything below comes from
 * `/api/academics/class-results`, which already computed the Moroccan weighted
 * average, rank and mention and was simply never called.
 */

const PAGE_SIZE = 15;

type ClassSubjectOption = {
  id: string;
  className: string | null;
  subjectName: string | null;
};

type RankedStudent = {
  studentId: string;
  name: string;
  generalAverage: number;
  rank: number;
  mention: string;
};

type ClassResults = {
  className: string;
  subjectName: string;
  rosterSize: number;
  gradedCount: number;
  classAverage: number;
  passingCount: number;
  atRiskCount: number;
  bestStudent: RankedStudent | null;
  mentionCounts: Record<string, number>;
  ranking: RankedStudent[];
};

const MENTION_ORDER = ['Très Bien', 'Bien', 'Assez Bien', 'Passable', 'Insuffisant'] as const;

const MENTION_STYLES: Record<string, string> = {
  'Très Bien': 'bg-emerald-100 text-emerald-800',
  'Bien': 'bg-teal-100 text-teal-800',
  'Assez Bien': 'bg-sky-100 text-sky-800',
  'Passable': 'bg-amber-100 text-amber-800',
  'Insuffisant': 'bg-rose-100 text-rose-800',
};

export function ClassResultsView() {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');
  const [options, setOptions] = useState<ClassSubjectOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [results, setResults] = useState<ClassResults | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const mentionLabels: Record<string, string> = {
    'Très Bien': t('mentionTresBien'),
    'Bien': t('mentionBien'),
    'Assez Bien': t('mentionAssezBien'),
    'Passable': t('mentionPassable'),
    'Insuffisant': t('mentionInsuffisant'),
  };

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError(null);

    try {
      const res = await fetch('/api/academics/class-subjects?pageSize=100');
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? 'Chargement des matières impossible.');
      }

      setOptions(json.data as ClassSubjectOption[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement des matières impossible.');
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const loadResults = useCallback(async (classSubjectId: string) => {
    setLoadingResults(true);
    setError(null);

    try {
      const res = await fetch(`/api/academics/class-results?classSubjectId=${classSubjectId}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.message ?? json?.error?.message ?? 'Chargement des résultats impossible.');
      }

      setResults(json.data as ClassResults);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement des résultats impossible.');
      setResults(null);
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadResults(selectedId);
    }
  }, [selectedId, loadResults]);

  const filtered = useMemo(() => {
    if (!results) {
      return [];
    }
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return results.ranking;
    }
    return results.ranking.filter(r => r.name.toLowerCase().includes(needle));
  }, [results, search]);

  // Real pagination over the real list. Clamped so deleting a filter match cannot
  // leave the view on a page that no longer exists.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('classResultsTitle')}</h1>
        <p className="mt-1 text-xs text-slate-500">
          {t('classResultsSubtitle')}
        </p>
      </div>

      {error && (
        <div className="
          flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50
          px-4 py-3 text-xs font-bold text-red-700
        "
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="
        flex flex-col gap-3 rounded-2xl border border-slate-200/80 p-3
        sm:flex-row sm:items-center
      "
      >
        <Select value={selectedId} onValueChange={setSelectedId} disabled={loadingOptions}>
          <SelectTrigger className="
            h-9 w-full rounded-xl text-xs
            sm:w-80
          "
          >
            <SelectValue placeholder={loadingOptions ? tCommon('loading') : t('chooseClassSubject')} />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => (
              <SelectItem key={o.id} value={o.id}>
                {[o.className, o.subjectName].filter(Boolean).join(' · ') || o.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="
          relative w-full
          sm:ml-auto sm:w-64
        "
        >
          <Search className="
            absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400
          "
          />
          <Input
            placeholder={t('searchStudent')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              // Back to page 1: a filter that shrinks the list must not leave the
              // view sitting on a page that no longer has rows.
              setPage(1);
            }}
            disabled={!results}
            className="h-9 rounded-xl border-none bg-slate-50 pl-9 text-xs"
          />
        </div>
      </Card>

      {!selectedId && !loadingOptions && (
        <Card className="
          space-y-2 rounded-2xl border border-dashed border-slate-300 p-10
          text-center
        "
        >
          <Award className="mx-auto size-8 text-slate-300" />
          <p className="text-sm font-extrabold text-[#16212B]">{t('chooseClassSubjectEmptyTitle')}</p>
          <p className="text-xs text-slate-500">{t('chooseClassSubjectEmptyDesc')}</p>
        </Card>
      )}

      {loadingResults && (
        <div className="
          flex items-center justify-center gap-2 py-16 text-xs font-bold
          text-slate-400
        "
        >
          <Loader2 className="size-4 animate-spin" />
          <span>{t('calculatingResults')}</span>
        </div>
      )}

      {results && !loadingResults && (
        <>
          <div className="
            grid grid-cols-1 gap-4
            md:grid-cols-4
          "
          >
            <Card className="
              space-y-1 rounded-2xl border border-slate-200/80 p-4
            "
            >
              <p className="text-xs font-bold text-slate-500">{t('classAverage')}</p>
              <p className="text-2xl font-extrabold text-[#16212B] tabular-nums">
                {results.gradedCount === 0 ? '—' : `${results.classAverage.toFixed(2)} / 20`}
              </p>
              <p className="text-[10px] text-slate-400">
                {t('studentsGraded', { count: results.gradedCount, total: results.rosterSize })}
              </p>
            </Card>

            <Card className="
              space-y-1 rounded-2xl border border-emerald-200/60
              bg-emerald-50/20 p-4
            "
            >
              <p className="text-xs font-bold text-[#17A673]">{t('passing')}</p>
              <p className="text-2xl font-extrabold text-[#17A673] tabular-nums">{results.passingCount}</p>
              <p className="text-[10px] text-slate-400">{t('passingThreshold')}</p>
            </Card>

            <Card className="
              space-y-1 rounded-2xl border border-rose-200/60 bg-rose-50/20 p-4
            "
            >
              <p className="text-xs font-bold text-rose-700">{t('atRisk')}</p>
              <p className="text-2xl font-extrabold text-rose-700 tabular-nums">{results.atRiskCount}</p>
              <p className="text-[10px] text-slate-400">{t('atRiskThreshold')}</p>
            </Card>

            <Card className="
              space-y-1 rounded-2xl border border-blue-200/60 bg-blue-50/20 p-4
            "
            >
              <p className="text-xs font-bold text-[#1B6C93]">{t('topStudent')}</p>
              <p className="truncate text-sm font-extrabold text-[#2487B8]">
                {results.bestStudent?.name ?? '—'}
              </p>
              <p className="text-[10px] text-slate-400">
                {results.bestStudent ? `${results.bestStudent.generalAverage.toFixed(2)} / 20` : t('noGradesEntered')}
              </p>
            </Card>
          </div>

          <Card className="space-y-3 rounded-2xl border border-slate-200/80 p-4">
            <h2 className="
              flex items-center gap-2 text-xs font-extrabold text-[#16212B]
            "
            >
              <TrendingUp className="size-4 text-[#2487B8]" />
              {t('mentionsDistribution')}
            </h2>
            <div className="space-y-2">
              {MENTION_ORDER.map((mention) => {
                const count = results.mentionCounts[mention] ?? 0;
                const share = results.gradedCount === 0 ? 0 : Math.round((count / results.gradedCount) * 100);
                return (
                  <div key={mention} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 font-bold text-slate-600">{mentionLabels[mention] ?? mention}</span>
                    <div className="
                      h-2 flex-1 overflow-hidden rounded-full bg-slate-100
                    "
                    >
                      <div
                        className="h-full rounded-full bg-[#2487B8]"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="
                      w-16 shrink-0 text-right text-slate-500 tabular-nums
                    "
                    >
                      {count}
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

          <Card className="
            overflow-hidden rounded-2xl border border-slate-200/80 p-0
          "
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="
                    border-b border-slate-200 bg-slate-50 text-[10px] font-bold
                    text-slate-500 uppercase
                  "
                  >
                    <th className="w-16 px-3 py-2.5">{t('rankHeader')}</th>
                    <th className="px-3 py-2.5">{t('studentHeader')}</th>
                    <th className="w-28 px-3 py-2.5">{t('averageHeader')}</th>
                    <th className="w-32 px-3 py-2.5">{t('mentionHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map(student => (
                    <tr key={student.studentId} className="hover:bg-slate-50/50">
                      <td className="
                        px-3 py-2 font-extrabold text-slate-400 tabular-nums
                      "
                      >
                        {student.rank}
                      </td>
                      <td className="px-3 py-2 font-bold text-[#16212B]">{student.name}</td>
                      <td className="
                        px-3 py-2 font-extrabold text-[#16212B] tabular-nums
                      "
                      >
                        {student.generalAverage.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={`
                          border-none text-[10px] font-bold
                          ${MENTION_STYLES[student.mention] ?? ''}
                        `}
                        >
                          {mentionLabels[student.mention] ?? student.mention}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <p className="py-10 text-center text-xs font-bold text-slate-400">
                {results.gradedCount === 0
                  ? t('noGradesForSubject')
                  : t('noStudentMatchSearch')}
              </p>
            )}

            {filtered.length > 0 && (
              <div className="
                flex items-center justify-between border-t border-slate-100 p-3
                text-[10px] text-slate-500
              "
              >
                <span>
                  {t('showingStudents', { start: firstShown, end: lastShown, total: filtered.length })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={t('prevPage')}
                    disabled={currentPage === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="
                      flex size-6 items-center justify-center rounded-sm
                      hover:bg-slate-100
                      disabled:opacity-30
                    "
                  >
                    <ChevronLeft className="size-3" />
                  </button>
                  <span className="px-2 font-bold tabular-nums">
                    {currentPage}
                    {' '}
                    /
                    {pageCount}
                  </span>
                  <button
                    type="button"
                    aria-label={t('nextPage')}
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                    className="
                      flex size-6 items-center justify-center rounded-sm
                      hover:bg-slate-100
                      disabled:opacity-30
                    "
                  >
                    <ChevronRight className="size-3" />
                  </button>
                </div>
              </div>
            )}
          </Card>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Users className="size-3.5 shrink-0" />
            {results.className}
            {' '}
            ·
            {results.subjectName}
          </p>
        </>
      )}
    </div>
  );
}
