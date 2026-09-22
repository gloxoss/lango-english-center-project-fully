'use client';

import type {
  TeacherDetail,
  TeacherDirectoryItem,
  TeacherDirectoryQuery,
  TeacherDirectorySummary,
  TeacherFilterOptions,
  TeacherScopeInfo,
  TeacherStatus,
} from '../model/types';
import type { TeacherRowAction } from './teacher-directory-table';
import type { LifecycleTarget } from './teacher-lifecycle-dialog';
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchTeacherFilterOptions, fetchTeachers } from '../data/directory-api';
import { TeacherDirectoryTable } from './teacher-directory-table';
import { TeacherDossierPanel } from './teacher-dossier-panel';
import { TeacherFilters } from './teacher-filters';
import { TeacherFormDialog } from './teacher-form-dialog';
import { TeacherInspectorContent } from './teacher-inspector';
import { TeacherKpiCards } from './teacher-kpi-cards';
import { TeacherLifecycleDialog } from './teacher-lifecycle-dialog';
import { TeacherMobileCards } from './teacher-mobile-cards';

type EditableTeacher = TeacherDirectoryItem | TeacherDetail;

const STATUS_VALUES: TeacherStatus[] = ['active', 'inactive', 'archived'];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
/** Same shell key the topbar campus switcher uses — one agreed scope. */
const BRANCH_STORAGE_KEY = 'schoolos_active_branch_id';

function parseQuery(params: URLSearchParams): TeacherDirectoryQuery {
  const statusRaw = params.get('status') ?? '';
  const status = STATUS_VALUES.includes(statusRaw as TeacherStatus) ? (statusRaw as TeacherStatus) : 'all';
  const pageRaw = Number(params.get('page'));
  const pageSizeRaw = Number(params.get('pageSize'));
  return {
    search: params.get('search') ?? '',
    status,
    subjectId: params.get('subjectId') ?? '',
    classSectionId: params.get('classSectionId') ?? '',
    branchId: params.get('branchId') ?? '',
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSizeRaw) ? pageSizeRaw : 20,
  };
}

function toSearchParams(query: TeacherDirectoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status !== 'all') {
    params.set('status', query.status);
  }
  if (query.subjectId) {
    params.set('subjectId', query.subjectId);
  }
  if (query.classSectionId) {
    params.set('classSectionId', query.classSectionId);
  }
  if (query.branchId) {
    params.set('branchId', query.branchId);
  }
  if (query.page > 1) {
    params.set('page', String(query.page));
  }
  if (query.pageSize !== 20) {
    params.set('pageSize', String(query.pageSize));
  }
  return params;
}

/**
 * Teacher directory container.
 *
 * - Query state (search/status/subject/class/branch/page/pageSize) lives in the
 *   URL so Back/forward restores it and a filtered view is shareable.
 * - The list, KPIs and pagination all come from the server; the client never
 *   filters or paginates a truncated array.
 * - Every mutation surfaces API errors; destructive actions are confirmed.
 */
export function TeachersManageView({ locale }: { locale: string }) {
  const t = useTranslations('Teachers');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = useMemo(() => parseQuery(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [items, setItems] = useState<TeacherDirectoryItem[]>([]);
  const [summary, setSummary] = useState<TeacherDirectorySummary | null>(null);
  const [scope, setScope] = useState<TeacherScopeInfo | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [options, setOptions] = useState<TeacherFilterOptions | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditableTeacher | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const setQuery = useCallback((partial: Partial<TeacherDirectoryQuery>) => {
    const next = { ...query, ...partial };
    const params = toSearchParams(next);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [query, router]);

  const reload = useCallback(() => setReloadToken(token => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchTeacherFilterOptions(query.branchId).then((result) => {
      if (cancelled || !result.ok) {
        return;
      }
      setOptions(result.data);
      // One authoritative scope: a whole-school principal's stored campus
      // selection (same key the topbar switcher writes) seeds the directory
      // URL. The id is only a hint — the server validates it.
      if (!query.branchId && result.data.scope.homeBranchId === null) {
        const stored = window.localStorage.getItem(BRANCH_STORAGE_KEY);
        if (stored && result.data.branches.some(branch => branch.id === stored)) {
          setQuery({ branchId: stored, page: 1 });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query.branchId, setQuery]);

  /** Any scope change is mirrored to the shell's stored selection. */
  const handleQueryChange = useCallback((partial: Partial<TeacherDirectoryQuery>) => {
    if ('branchId' in partial) {
      if (partial.branchId) {
        window.localStorage.setItem(BRANCH_STORAGE_KEY, partial.branchId);
      } else {
        window.localStorage.removeItem(BRANCH_STORAGE_KEY);
      }
    }
    setQuery(partial);
  }, [setQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError(null);
    fetchTeachers(query, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        if (result.ok) {
          setItems(result.data.data);
          setSummary(result.data.summary);
          setScope(result.data.scope);
          setTotal(result.data.total);
          setTotalPages(result.data.totalPages);
          setSelectedTeacherId((previous) => {
            if (previous && result.data.data.some(item => item.id === previous)) {
              return previous;
            }
            return result.data.data[0]?.id ?? null;
          });
        } else {
          setItems([]);
          setSummary(null);
          setListError(result.message);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setItems([]);
        setListError(error instanceof Error ? error.message : t('errLoadTeachers'));
        setLoading(false);
      });
    return () => controller.abort();
  }, [query, reloadToken, t]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const handle = setTimeout(setNotice, 6000, null);
    return () => clearTimeout(handle);
  }, [notice]);

  const handleRowAction = useCallback((action: TeacherRowAction) => {
    if (action.type === 'edit') {
      setEditing(action.teacher);
      setFormOpen(true);
    } else if (action.type === 'status') {
      setLifecycleTarget({ type: 'status', teacher: action.teacher, status: action.status });
    } else {
      setLifecycleTarget({ type: 'delete', teacher: action.teacher });
    }
  }, []);

  const handleSelectFromPanel = useCallback((teacherId: string) => {
    setSelectedTeacherId(teacherId);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
      setMobileInspectorOpen(true);
    }
  }, []);

  const rangeStart = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const rangeEnd = Math.min(query.page * query.pageSize, total);
  const hasFilters = Boolean(query.search || query.status !== 'all' || query.subjectId || query.classSectionId || query.branchId);

  const exportHref = (() => {
    const params = toSearchParams({ ...query, page: 1, pageSize: 20 });
    params.delete('page');
    params.delete('pageSize');
    return `/api/teachers/export?${params.toString()}`;
  })();

  // One scope label for the whole page: the resolved list scope, falling back
  // to the options scope while the first list response is in flight.
  const effectiveScope = scope ?? options?.scope ?? null;

  const inspector = (
    <TeacherInspectorContent
      teacherId={selectedTeacherId}
      branchId={query.branchId}
      locale={locale}
      onEdit={(teacher) => {
        setEditing(teacher);
        setFormOpen(true);
      }}
      onStatus={(teacher, status) => setLifecycleTarget({ type: 'status', teacher, status })}
      onDelete={teacher => setLifecycleTarget({ type: 'delete', teacher })}
    />
  );

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6">
      <div className="min-w-0 flex-1 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="
              text-2xl font-extrabold tracking-tight text-[#16212B]
            "
            >
              {t('title')}
            </h1>
            <p className="mt-1 text-xs text-slate-500">{t('manage')}</p>
            {effectiveScope && (
              <span className="
                mt-1.5 inline-flex items-center gap-1.5 rounded-full
                bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600
              "
              >
                <Building2 className="size-3 text-[#2487B8]" />
                {t('scopeLabel')}
                {' : '}
                {effectiveScope.allBranches ? t('scopeAllBranches') : (effectiveScope.branchName ?? '-')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="
                h-10 gap-1.5 rounded-full bg-[#0066FF] px-4 text-xs font-bold
                hover:bg-[#0052CC]
              "
            >
              <Plus className="size-3.5" />
              {' '}
              {t('addTeacher')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="
                    h-10 gap-1.5 rounded-full border-slate-200 px-4 text-xs
                    font-bold
                  "
                >
                  <MoreHorizontal className="size-3.5" />
                  {' '}
                  {t('actionsMenu')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={exportHref} download className="cursor-pointer">
                    <Download className="me-2 size-3.5" />
                    {' '}
                    {t('exportDirectory')}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/${locale}/dashboard/teachers/bulk-import`}
                    className="cursor-pointer"
                  >
                    <Upload className="me-2 size-3.5" />
                    {' '}
                    {t('importTeachers')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {notice && (
          <div className="
            flex items-start justify-between gap-3 rounded-xl border
            border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold
            text-emerald-700
          "
          >
            <span>{notice}</span>
            <button type="button" aria-label={tCommon('close')} onClick={() => setNotice(null)}>
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {listError && (
          <div
            role="alert"
            className="
              flex flex-wrap items-center justify-between gap-3 rounded-xl
              border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold
              text-rose-700
            "
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="size-4" />
              {' '}
              {t('loadErrorTitle')}
              {' '}
              —
              {' '}
              {listError}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              className="h-9 rounded-full border-rose-200 text-xs"
            >
              {t('retry')}
            </Button>
          </div>
        )}

        {/* KPI: full cards on >=md, compact summary line on mobile */}
        <div className="
          hidden
          md:block
        "
        >
          <TeacherKpiCards summary={summary} loading={loading && !summary} />
        </div>
        <div className="
          flex flex-wrap items-center gap-2 rounded-2xl border
          border-slate-200/80 bg-white px-4 py-2.5 text-[11px] font-bold
          text-slate-600
          md:hidden
        "
        >
          {summary
            ? (
                <>
                  <span>{t('kpiActiveCompact', { count: summary.activeTeachers })}</span>
                  <span className="text-slate-300">·</span>
                  <span>{t('kpiOnLeaveCompact', { count: summary.onLeave })}</span>
                  <span className="text-slate-300">·</span>
                  <span>{t('kpiDossiersCompact', { count: summary.dossiers.toComplete })}</span>
                </>
              )
            : (
                <span className="text-slate-400">…</span>
              )}
        </div>

        <Card className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-2xs
        "
        >
          <TeacherFilters
            query={query}
            options={options}
            onChange={handleQueryChange}
            onClear={() => {
              window.localStorage.removeItem(BRANCH_STORAGE_KEY);
              router.push(`?`, { scroll: false });
            }}
          />

          {/* Desktop table */}
          <div className="
            hidden
            lg:block
          "
          >
            <TeacherDirectoryTable
              items={items}
              loading={loading}
              locale={locale}
              selectedTeacherId={selectedTeacherId}
              onSelect={setSelectedTeacherId}
              onAction={handleRowAction}
            />
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden">
            {loading
              ? (
                  <div className="space-y-3" aria-busy="true">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="h-24 animate-pulse rounded-2xl bg-slate-100"
                      />
                    ))}
                  </div>
                )
              : (
                  <TeacherMobileCards
                    items={items}
                    onSelect={(teacherId) => {
                      setSelectedTeacherId(teacherId);
                      setMobileInspectorOpen(true);
                    }}
                  />
                )}
          </div>

          {/* Server-driven pagination */}
          {!loading && total > 0 && (
            <div className="
              flex flex-col items-center justify-between gap-3 border-t
              border-slate-100 pt-3 text-xs text-slate-500
              sm:flex-row
            "
            >
              <div className="flex items-center gap-3">
                <span>{t('paginationRange', { from: rangeStart, to: rangeEnd, total })}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">{tCommon('rowsPerPage')}</span>
                  <Select
                    value={String(query.pageSize)}
                    onValueChange={value => setQuery({ pageSize: Number(value), page: 1 })}
                  >
                    <SelectTrigger className="
                      h-8 w-[72px] rounded-lg border-slate-200 text-[11px]
                    "
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.page <= 1}
                  aria-label={t('previousPage')}
                  onClick={() => setQuery({ page: query.page - 1 })}
                  className="size-9 rounded-lg border border-slate-200 p-0"
                >
                  <ChevronLeft className="
                    size-4
                    rtl:rotate-180
                  "
                  />
                </Button>
                <span className="px-2 font-bold text-slate-700">
                  {query.page}
                  {' '}
                  /
                  {' '}
                  {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.page >= totalPages}
                  aria-label={t('nextPage')}
                  onClick={() => setQuery({ page: query.page + 1 })}
                  className="size-9 rounded-lg border border-slate-200 p-0"
                >
                  <ChevronRight className="
                    size-4
                    rtl:rotate-180
                  "
                  />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Dossiers panel */}
        <TeacherDossierPanel
          summary={summary}
          locale={locale}
          loading={loading && !summary}
          onSelectTeacher={handleSelectFromPanel}
        />

        {!loading && total === 0 && !hasFilters && (
          <Card className="
            rounded-2xl border border-dashed border-slate-200 bg-white p-8
            text-center shadow-2xs
          "
          >
            <p className="text-sm font-extrabold text-[#16212B]">{t('noTeachersTitle')}</p>
            <p className="mt-1 text-xs text-slate-500">{t('noTeachersDescription')}</p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="
                mt-4 h-10 gap-1.5 rounded-full bg-[#0066FF] px-4 text-xs
                font-bold text-white
              "
            >
              <Plus className="size-3.5" />
              {' '}
              {t('addTeacher')}
            </Button>
          </Card>
        )}
      </div>

      {/* Desktop inspector */}
      <div className="
        hidden w-[340px] shrink-0
        xl:block
      "
      >
        {inspector}
      </div>

      {/* Mobile inspector bottom sheet */}
      <Dialog open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
        <DialogContent className="
          top-auto! bottom-0! left-0! max-h-[88vh]! w-full! max-w-none!
          translate-0! overflow-y-auto rounded-t-2xl rounded-b-none p-4
        "
        >
          <p className="
            mb-2 text-xs font-extrabold tracking-wide text-slate-400 uppercase
          "
          >
            {t('quickProfile')}
          </p>
          {inspector}
        </DialogContent>
      </Dialog>

      <TeacherFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
          }
        }}
        editing={editing}
        options={options}
        onSaved={(message) => {
          setNotice(message);
          reload();
        }}
      />

      <TeacherLifecycleDialog
        target={lifecycleTarget}
        onOpenChange={(open) => {
          if (!open) {
            setLifecycleTarget(null);
          }
        }}
        onDone={(message) => {
          setNotice(message);
          reload();
        }}
      />
    </div>
  );
}
