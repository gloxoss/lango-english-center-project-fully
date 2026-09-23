'use client';

import type { TeacherDirectoryItem } from '../model/types';
import { ChevronRight, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TeacherStatusBadge } from './teacher-directory-table';

function initials(name: string): string {
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * Mobile teacher list: compact cards instead of a horizontally scrolling
 * 8-column table. Tapping a card opens the inspector as a bottom sheet.
 */
export function TeacherMobileCards({
  items,
  onSelect,
}: {
  items: TeacherDirectoryItem[];
  onSelect: (teacherId: string) => void;
}) {
  const t = useTranslations('Teachers');

  if (items.length === 0) {
    return <EmptyState title={t('noResultsTitle')} description={t('noResultsDescription')} />;
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="
            w-full rounded-2xl border border-slate-200/80 bg-white p-4
            text-start shadow-2xs transition-colors
            hover:bg-slate-50/80
          "
        >
          <div className="flex items-start gap-3">
            <Avatar className="size-11 shrink-0">
              {item.avatarUrl ? <AvatarImage src={item.avatarUrl} alt={item.name} /> : null}
              <AvatarFallback className="
                bg-slate-200 text-sm font-bold text-slate-700
              "
              >
                {initials(item.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#16212B]">{item.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {item.specialization || t('teachingStaffFallback')}
                    {item.branchName ? ` · ${item.branchName}` : ''}
                  </p>
                </div>
                <ChevronRight className="
                  mt-0.5 size-4 shrink-0 text-slate-300
                  rtl:rotate-180
                "
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                <TeacherStatusBadge status={item.status} />
                {item.subjects.slice(0, 2).map(subject => (
                  <Badge
                    key={subject.id}
                    className="
                      border-none bg-slate-100 px-1.5 py-0 text-[9px]
                      font-normal text-slate-700
                    "
                  >
                    {subject.name}
                  </Badge>
                ))}
                {item.subjects.length > 2 && (
                  <span className="text-[9px] text-slate-400">
                    +
                    {item.subjects.length - 2}
                  </span>
                )}
              </div>

              <div className="
                mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]
                text-slate-500
              "
              >
                <span className="truncate">
                  {t('colClasses')}
                  :
                  <strong className="font-bold text-slate-700">
                    {item.classes.map(c => c.label).join(', ') || '—'}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {item.weeklyScheduledHours === null
                    ? t('noPlannedWorkloadShort')
                    : t('hoursPerWeek', { hours: item.weeklyScheduledHours })}
                </span>
                {!item.dossier.complete && (
                  <span className="font-bold text-[#B47818]">{t('dossierMissingChip', { count: item.dossier.missingItems.length })}</span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
