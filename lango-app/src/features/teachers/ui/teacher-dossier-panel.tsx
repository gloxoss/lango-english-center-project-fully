'use client';

import type { TeacherDirectorySummary } from '../model/types';
import { CheckCircle2, FolderOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * "Dossiers enseignants" panel.
 *
 * Replaces the ambiguous donut whose three slices counted teachers but read
 * like documents. Counts are labelled as teacher dossiers; each dossier lists
 * the exact missing items, and up to three teachers requiring attention are
 * surfaced with a direct link — which is what an administrator can act on.
 */
export function TeacherDossierPanel({
  summary,
  locale,
  loading,
  onSelectTeacher,
}: {
  summary: TeacherDirectorySummary | null;
  locale: string;
  loading: boolean;
  onSelectTeacher?: (teacherId: string) => void;
}) {
  const t = useTranslations('Teachers');

  const missingLabel = (key: string): string => {
    switch (key) {
      case 'contract':
        return t('docContract');
      case 'cin':
        return t('docCin');
      case 'diploma':
        return t('docDiploma');
      case 'employeeId':
        return t('employeeIdLabel');
      case 'hireDate':
        return t('hireDate');
      case 'specialization':
        return t('specialty');
      default:
        return key;
    }
  };

  if (loading || !summary) {
    return (
      <Card
        className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-2xs
        "
        aria-busy="true"
      >
        <Skeleton className="h-4 w-40 bg-slate-200/70" />
        <div className="
          grid grid-cols-1 gap-3
          sm:grid-cols-3
        "
        >
          {[0, 1, 2].map(i => (
            <Skeleton
              key={i}
              className="h-16 rounded-xl bg-slate-200/70"
            />
          ))}
        </div>
        <Skeleton className="h-14 rounded-xl bg-slate-200/70" />
      </Card>
    );
  }

  const { dossiers, attention } = summary;
  const allComplete = dossiers.toComplete === 0 && summary.scopedTeachers > 0;

  return (
    <Card className="
      space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
    "
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-[#16212B]">{t('dossierPanelTitle')}</h3>
          <p className="mt-0.5 text-[10px] text-slate-400">{t('dossierPanelHint')}</p>
        </div>
        <Badge className="
          border-none bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600
        "
        >
          {t('dossierCountLabel', { count: summary.scopedTeachers })}
        </Badge>
      </div>

      <div className="
        grid grid-cols-1 gap-3
        sm:grid-cols-3
      "
      >
        <div className="
          flex items-center justify-between rounded-xl border border-emerald-100
          bg-emerald-50/60 px-3 py-2.5
        "
        >
          <span className="
            flex items-center gap-2 text-xs font-bold text-emerald-700
          "
          >
            <CheckCircle2 className="size-3.5" />
            {' '}
            {t('dossierComplete')}
          </span>
          <span className="text-lg font-extrabold text-[#16212B]">{dossiers.complete}</span>
        </div>
        <div className="
          flex items-center justify-between rounded-xl border border-amber-100
          bg-amber-50/60 px-3 py-2.5
        "
        >
          <span className="text-xs font-bold text-amber-700">{t('dossierPartial')}</span>
          <span className="text-lg font-extrabold text-[#16212B]">{dossiers.partial}</span>
        </div>
        <div className="
          flex items-center justify-between rounded-xl border border-rose-100
          bg-rose-50/60 px-3 py-2.5
        "
        >
          <span className="text-xs font-bold text-rose-700">{t('dossierNoDocuments')}</span>
          <span className="text-lg font-extrabold text-[#16212B]">{dossiers.noDocuments}</span>
        </div>
      </div>

      {allComplete
        ? (
            <p className="
              flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs
              font-semibold text-emerald-700
            "
            >
              <CheckCircle2 className="size-4" />
              {' '}
              {t('dossierAllComplete')}
            </p>
          )
        : attention.length > 0
          ? (
              <div className="space-y-2">
                <p className="
                  text-[11px] font-bold tracking-wide text-slate-400 uppercase
                "
                >
                  {t('dossierAttentionTitle')}
                </p>
                {attention.map(item => (
                  <div
                    key={item.id}
                    className="
                      flex flex-wrap items-center justify-between gap-2
                      rounded-xl bg-slate-50 px-3 py-2.5
                    "
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#16212B]">{item.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-1">
                        {item.missingItems.map(missing => (
                          <span
                            key={missing}
                            className="
                              rounded-full bg-white px-1.5 py-0.5 text-[9px]
                              font-semibold text-rose-600
                            "
                          >
                            {missingLabel(missing)}
                          </span>
                        ))}
                      </p>
                    </div>
                    {onSelectTeacher
                      ? (
                          <button
                            type="button"
                            onClick={() => onSelectTeacher(item.id)}
                            className="
                              flex items-center gap-1 rounded-full border
                              border-slate-200 bg-white px-2.5 py-1 text-[10px]
                              font-bold text-slate-600
                              hover:bg-slate-100
                            "
                          >
                            <FolderOpen className="size-3" />
                            {' '}
                            {t('viewDossier')}
                          </button>
                        )
                      : (
                          <Link
                            href={`/${locale}/dashboard/teachers/${item.id}`}
                            className="
                              flex items-center gap-1 rounded-full border
                              border-slate-200 bg-white px-2.5 py-1 text-[10px]
                              font-bold text-slate-600
                              hover:bg-slate-100
                            "
                          >
                            <FolderOpen className="size-3" />
                            {' '}
                            {t('viewDossier')}
                          </Link>
                        )}
                  </div>
                ))}
              </div>
            )
          : null}
    </Card>
  );
}
