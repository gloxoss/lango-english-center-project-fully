'use client';

import { AlertTriangle, Award } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ParentPageShell, type ParentPageShellContext } from './ParentPageShell';

// Published grades of the active child (GET /api/guardian/me/children/[id]/results
// returns published outcomes only). Parents had no screen for grades before.
type GradeRow = {
  assessmentId: string;
  title: string;
  type: string;
  subject: string | null;
  score: string | number | null;
  maximumScore: string | number | null;
  status: string;
  gradedAt: string | null;
};

const TYPE_KEYS: Record<string, string> = {
  quiz: 'gradeTypeQuiz',
  paper_exam: 'gradeTypeExam',
  online_exam: 'gradeTypeOnlineExam',
  homework: 'gradeTypeHomework',
  project: 'gradeTypeProject',
  oral: 'gradeTypeOral',
  practical: 'gradeTypePractical',
};

export function GradesView() {
  const tParent = useTranslations('Parent');
  return (
    <ParentPageShell title={tParent('gradesTitle')} subtitle={tParent('gradesSubtitle')} icon={<Award className="w-6 h-6" />}>
      <GradesContent />
    </ParentPageShell>
  );
}

function to20(r: GradeRow): number | null {
  const score = Number(r.score);
  const max = Number(r.maximumScore);
  if (r.status !== 'graded' || !Number.isFinite(score) || !Number.isFinite(max) || max <= 0) {
    return null;
  }
  return (score / max) * 20;
}

function GradesContent({ relationshipId }: Partial<ParentPageShellContext>) {
  const tParent = useTranslations('Parent');
  const locale = useLocale();
  const [rows, setRows] = useState<GradeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (rid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/results`);
      const json = await res.json();
      if (json.success) {
        setRows(json.data as GradeRow[]);
      } else {
        setError(res.status === 403 ? tParent('gradesNoAccess') : (json.error?.message ?? tParent('gradesError')));
      }
    } catch {
      setError(tParent('errorConnect'));
    } finally {
      setLoading(false);
    }
  }, [tParent]);

  useEffect(() => {
    if (relationshipId) {
      load(relationshipId);
    }
  }, [relationshipId, load]);

  const bySubject = useMemo(() => {
    const groups = new Map<string, GradeRow[]>();
    for (const r of rows ?? []) {
      const key = r.subject ?? '—';
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups.entries()].map(([subject, items]) => {
      const scores = items.map(to20).filter((n): n is number => n !== null);
      const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      return { subject, items, average };
    });
  }, [rows]);

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-MA', { day: 'numeric', month: 'short', year: 'numeric' });
  const scoreText = (r: GradeRow) => {
    if (r.status === 'exempted') return tParent('gradeExempted');
    if (r.status === 'absent') return tParent('gradeAbsent');
    return `${Number(r.score).toLocaleString(locale)} / ${Number(r.maximumScore).toLocaleString(locale)}`;
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }
  if (loading || rows === null) {
    return <div className="h-32 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />;
  }
  if (rows.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-xl">{tParent('gradesEmpty')}</p>;
  }

  return (
    <div className="space-y-4">
      {bySubject.map(group => (
        <section key={group.subject} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-800">{group.subject}</h2>
            {group.average !== null && (
              <span className="text-xs font-semibold text-sky-700">
                {tParent('gradesAverage', { value: group.average.toLocaleString(locale, { maximumFractionDigits: 2 }) })}
              </span>
            )}
          </header>
          <ul className="divide-y divide-slate-100">
            {group.items.map(r => (
              <li key={r.assessmentId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                  <p className="text-xs text-slate-500">
                    {TYPE_KEYS[r.type] ? tParent(TYPE_KEYS[r.type]!) : r.type}
                    {r.gradedAt ? ` · ${dateFmt.format(new Date(r.gradedAt))}` : ''}
                  </p>
                </div>
                <bdi dir="ltr" className="text-sm font-bold text-slate-900 whitespace-nowrap">{scoreText(r)}</bdi>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
