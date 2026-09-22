'use client';

import type { TeacherDirectoryItem, TeacherStatus } from '../model/types';
import {
  Archive,
  ArchiveRestore,
  Clock,
  Eye,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/table-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function TeacherStatusBadge({ status }: { status: TeacherStatus }) {
  const tStatus = useTranslations('Status');
  if (status === 'active') {
    return (
      <Badge className="
        border-none bg-[#D1F5E8] px-2 py-0.5 text-[10px] text-[#17A673]
      "
      >
        {tStatus('active')}
      </Badge>
    );
  }
  if (status === 'archived') {
    return (
      <Badge className="
        border-none bg-[#FCF0DC] px-2 py-0.5 text-[10px] text-[#E8A33D]
      "
      >
        {tStatus('archived')}
      </Badge>
    );
  }
  return (
    <Badge className="
      border-none bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600
    "
    >
      {tStatus('inactive')}
    </Badge>
  );
}

function initials(name: string): string {
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

export type TeacherRowAction
  = | { type: 'edit'; teacher: TeacherDirectoryItem }
    | { type: 'status'; teacher: TeacherDirectoryItem; status: TeacherStatus }
    | { type: 'delete'; teacher: TeacherDirectoryItem };

export function TeacherDirectoryTable({
  items,
  loading,
  locale,
  selectedTeacherId,
  onSelect,
  onAction,
}: {
  items: TeacherDirectoryItem[];
  loading: boolean;
  locale: string;
  selectedTeacherId: string | null;
  onSelect: (teacherId: string) => void;
  onAction: (action: TeacherRowAction) => void;
}) {
  const t = useTranslations('Teachers');
  const tCommon = useTranslations('Common');

  if (loading) {
    return <TableSkeleton rowCount={8} columnCount={7} />;
  }

  if (items.length === 0) {
    return <EmptyState title={t('noResultsTitle')} description={t('noResultsDescription')} />;
  }

  const hoursLabel = (hours: number | null) => (hours === null ? '—' : t('hoursPerWeek', { hours }));

  return (
    <div className="
      overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs
    "
    >
      <Table>
        <TableHeader className="
          bg-[#F6F9FC] text-xs font-semibold text-slate-500
        "
        >
          <TableRow>
            <TableHead className="min-w-[200px]">{t('colTeacher')}</TableHead>
            <TableHead className="min-w-[110px] px-2">{t('colSubjects')}</TableHead>
            <TableHead className="min-w-[120px] px-2">{t('colClasses')}</TableHead>
            <TableHead className="px-2" title={t('colWorkload')}>{t('colWorkloadShort')}</TableHead>
            <TableHead className="
              hidden min-w-[160px]
              2xl:table-cell
            "
            >
              {t('contact')}
            </TableHead>
            <TableHead>{tCommon('status')}</TableHead>
            <TableHead className="text-center">{tCommon('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100 text-xs font-medium">
          {items.map((item) => {
            const selected = selectedTeacherId === item.id;
            return (
              <TableRow
                key={item.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
                className={`
                  cursor-pointer transition-colors
                  hover:bg-slate-50/80
                  ${selected
                ? `bg-blue-50/60`
                : ''}
                `}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      {item.avatarUrl ? <AvatarImage src={item.avatarUrl} alt={item.name} /> : null}
                      <AvatarFallback className="
                        bg-slate-200 text-xs font-bold text-slate-700
                      "
                      >
                        {initials(item.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#16212B]">{item.name}</p>
                      <p className="
                        truncate text-[10px] font-normal text-slate-400
                      "
                      >
                        {item.specialization || t('teachingStaffFallback')}
                        {item.branchName ? ` · ${item.branchName}` : ''}
                      </p>
                      <p className="
                        truncate font-mono text-[9px] text-slate-400
                      "
                      >
                        {item.employeeId || '—'}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-2">
                  <div className="flex flex-wrap gap-1">
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
                      <Badge className="
                        border-none bg-slate-100 px-1.5 py-0 text-[9px]
                        font-normal text-slate-500
                      "
                      >
                        +
                        {item.subjects.length - 2}
                      </Badge>
                    )}
                    {item.subjects.length === 0 && (
                      <span className="text-[10px] text-slate-400">
                        {t('noSubjectAssigned')}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.classes.slice(0, 2).map(classItem => (
                      <Badge
                        key={classItem.id}
                        className="
                          border-none bg-[#DCEBF4] px-1.5 py-0 text-[9px]
                          font-normal text-[#1B6C93]
                        "
                      >
                        {classItem.label}
                      </Badge>
                    ))}
                    {item.classes.length > 2 && (
                      <Badge className="
                        border-none bg-[#DCEBF4] px-1.5 py-0 text-[9px]
                        font-normal text-[#1B6C93]
                      "
                      >
                        +
                        {item.classes.length - 2}
                      </Badge>
                    )}
                    {item.classes.length === 0 && (
                      <span className="text-[10px] text-slate-400">
                        {t('noClassAssigned')}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-2">
                  <span className={`
                    inline-flex items-center gap-1 font-bold
                    ${item.weeklyScheduledHours === null
                ? `font-normal text-slate-400`
                : `text-[#16212B]`}
                  `}
                  >
                    {item.weeklyScheduledHours !== null && (
                      <Clock className="size-3 text-slate-400" />
                    )}
                    {hoursLabel(item.weeklyScheduledHours)}
                  </span>
                </TableCell>
                <TableCell className="
                  hidden
                  2xl:table-cell
                "
                >
                  <div className="text-[10px] text-slate-500">
                    <p>{item.phone || '-'}</p>
                    <p className="text-slate-400">{item.email}</p>
                  </div>
                </TableCell>
                <TableCell className="px-2">
                  <div className="flex flex-col items-start gap-1">
                    <TeacherStatusBadge status={item.status} />
                    {!item.dossier.complete && (
                      <span
                        className="
                          rounded-full bg-[#FCF0DC] px-1.5 py-0 text-[9px]
                          font-bold text-[#B47818]
                        "
                        title={item.dossier.missingItems.join(', ')}
                      >
                        {t('dossierMissingChip', { count: item.dossier.missingItems.length })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-2 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <Link
                      href={`/${locale}/dashboard/teachers/${item.id}`}
                      title={t('viewProfile')}
                      aria-label={`${t('viewProfile')} — ${item.name}`}
                      className="
                        inline-flex size-10 items-center justify-center
                        rounded-lg text-slate-400
                        hover:bg-slate-100
                      "
                    >
                      <Eye className="size-4" />
                    </Link>
                    <button
                      type="button"
                      title={t('editTeacher')}
                      aria-label={`${t('editTeacher')} — ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onAction({ type: 'edit', teacher: item });
                      }}
                      className="
                        inline-flex size-10 items-center justify-center
                        rounded-lg text-slate-400
                        hover:bg-slate-100
                      "
                    >
                      <Pencil className="size-4" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          title={t('actionsMenu')}
                          aria-label={`${t('actionsMenu')} — ${item.name}`}
                          onClick={event => event.stopPropagation()}
                          className="
                            inline-flex size-10 items-center justify-center
                            rounded-lg text-slate-400
                            hover:bg-slate-100
                          "
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/${locale}/dashboard/teachers/${item.id}`}
                            className="cursor-pointer"
                          >
                            <UserRound className="me-2 size-3.5" />
                            {t('viewProfile')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAction({ type: 'edit', teacher: item })}>
                          <Pencil className="me-2 size-3.5" />
                          {t('editTeacher')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {item.status !== 'active' && (
                          <DropdownMenuItem onClick={() => onAction({ type: 'status', teacher: item, status: 'active' })}>
                            <Power className="me-2 size-3.5" />
                            {t('reactivate')}
                          </DropdownMenuItem>
                        )}
                        {item.status === 'active' && (
                          <DropdownMenuItem onClick={() => onAction({ type: 'status', teacher: item, status: 'inactive' })}>
                            <Power className="me-2 size-3.5" />
                            {t('deactivate')}
                          </DropdownMenuItem>
                        )}
                        {item.status !== 'archived' && (
                          <DropdownMenuItem onClick={() => onAction({ type: 'status', teacher: item, status: 'archived' })}>
                            <Archive className="me-2 size-3.5" />
                            {t('archive')}
                          </DropdownMenuItem>
                        )}
                        {item.status === 'archived' && (
                          <DropdownMenuItem onClick={() => onAction({ type: 'status', teacher: item, status: 'active' })}>
                            <ArchiveRestore className="me-2 size-3.5" />
                            {t('reactivate')}
                          </DropdownMenuItem>
                        )}
                        {item.canHardDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onAction({ type: 'delete', teacher: item })}
                              className="
                                text-rose-600
                                focus:text-rose-600
                              "
                            >
                              <Trash2 className="me-2 size-3.5" />
                              {t('deleteTeacher')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
