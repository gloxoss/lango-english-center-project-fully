'use client';

import type { TeacherDirectoryQuery, TeacherFilterOptions, TeacherStatus } from '../model/types';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = '__all__';

/**
 * Directory filters. State lives in the URL (owned by the parent); typing is
 * debounced before it is pushed into the URL so browser Back restores previous
 * searches without one history entry per keystroke.
 */
export function TeacherFilters({
  query,
  options,
  onChange,
  onClear,
}: {
  query: TeacherDirectoryQuery;
  options: TeacherFilterOptions | null;
  onChange: (partial: Partial<TeacherDirectoryQuery>) => void;
  onClear: () => void;
}) {
  const t = useTranslations('Teachers');
  const [draft, setDraft] = useState(query.search);

  // Sync the input when the URL changes (Back/forward, clear).
  useEffect(() => {
    setDraft(query.search);
  }, [query.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (draft !== query.search) {
        onChange({ search: draft, page: 1 });
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [draft, query.search, onChange]);

  const tabs: { key: TeacherStatus | 'all'; label: string }[] = [
    { key: 'all', label: t('tabAll') },
    { key: 'active', label: t('tabActive') },
    { key: 'inactive', label: t('tabInactive') },
    { key: 'archived', label: t('tabArchived') },
  ];

  const hasFilters = Boolean(query.search || query.status !== 'all' || query.subjectId || query.classSectionId || query.branchId);
  // The branch selector is a SCOPE selector: only a whole-school principal may
  // change it (the server pins branch-limited principals to their home branch
  // and 403s anything else). It appears as soon as the tenant has any branch.
  const showBranchFilter = options != null && options.scope.homeBranchId === null && options.branches.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="
          absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400
        "
        />
        <Input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="
            h-9 rounded-full border-slate-200 bg-slate-50 ps-10 text-start
            text-xs
          "
        />
      </div>

      <div
        className="
          flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs
        "
        role="tablist"
        aria-label={t('filterStatusAria')}
      >
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={query.status === tab.key}
            onClick={() => onChange({ status: tab.key, page: 1 })}
            className={`
              rounded-full px-3 py-1 text-[11px] font-bold transition-colors
              ${
          query.status === tab.key
            ? 'bg-white text-[#16212B] shadow-2xs'
            : `
              text-slate-500
              hover:text-slate-800
            `
          }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Select
        value={query.subjectId || ALL}
        onValueChange={value => onChange({ subjectId: value === ALL ? '' : value, page: 1 })}
      >
        <SelectTrigger
          className="h-9 w-[160px] rounded-full border-slate-200 text-xs"
          aria-label={t('filterSubject')}
        >
          <SelectValue placeholder={t('filterSubject')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allSubjects')}</SelectItem>
          {(options?.subjects ?? []).map(subject => (
            <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={query.classSectionId || ALL}
        onValueChange={value => onChange({ classSectionId: value === ALL ? '' : value, page: 1 })}
      >
        <SelectTrigger
          className="h-9 w-[160px] rounded-full border-slate-200 text-xs"
          aria-label={t('filterClass')}
        >
          <SelectValue placeholder={t('filterClass')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allClasses')}</SelectItem>
          {(options?.classes ?? []).map(classItem => (
            <SelectItem key={classItem.id} value={classItem.id}>{classItem.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showBranchFilter && (
        <Select
          value={query.branchId || ALL}
          onValueChange={value => onChange({ branchId: value === ALL ? '' : value, page: 1 })}
        >
          <SelectTrigger
            className="h-9 w-[150px] rounded-full border-slate-200 text-xs"
            aria-label={t('filterBranch')}
          >
            <SelectValue placeholder={t('filterBranch')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allBranches')}</SelectItem>
            {(options?.branches ?? []).map(branch => (
              <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="
            h-9 gap-1 rounded-full px-3 text-xs font-bold text-slate-500
            hover:text-slate-800
          "
        >
          <X className="size-3.5" />
          {' '}
          {t('clearFilters')}
        </Button>
      )}
    </div>
  );
}
