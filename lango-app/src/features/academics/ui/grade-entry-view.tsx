'use client';

import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Loader2, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MarksheetGridView } from '@/features/assessment/ui/marksheet-grid-view';

type AssessmentDefinition = {
  id: string;
  title: string;
  type: string;
  status?: string;
  isPublished?: boolean;
  publishedCount?: number;
  draftCount?: number;
  totalMarks?: number;
};

export function GradeEntryView() {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const typeLabels: Record<string, string> = {
    paper_exam: t('typePaperExam'),
    online_exam: t('typeOnlineExam'),
    quiz: t('typeQuiz'),
    oral: t('typeOral'),
    practical: t('typePractical'),
    project: t('typeProject'),
    homework: t('typeHomework'),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/academics/assessment-definitions');
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('errLoadAssessments'));
      }

      setDefinitions(json.data as AssessmentDefinition[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errLoadAssessments'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return definitions;
    }
    return definitions.filter(d => d.title.toLowerCase().includes(needle));
  }, [definitions, search]);

  const handlePublish = useCallback(async (defId: string, count?: number) => {
    const confirmMsg = t('confirmPublishMarks', { count: count ?? 0 });
    if (!window.confirm(confirmMsg)) {
      return;
    }
    setPublishingId(defId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/academics/assessment-definitions/${defId}/publish`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('errPublish'));
      }
      setFeedback({ type: 'success', message: t('publishSuccess', { count: json.data?.count ?? count ?? 0 }) });
      void load();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : t('errPublish') });
    } finally {
      setPublishingId(null);
    }
  }, [load, t]);

  const handleUnpublish = useCallback(async (defId: string) => {
    const reason = window.prompt(t('unpublishReasonPrompt'));
    if (!reason || !reason.trim()) {
      return;
    }
    setPublishingId(defId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/academics/assessment-definitions/${defId}/publish`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('errUnpublish'));
      }
      setFeedback({ type: 'success', message: t('unpublishSuccess', { count: json.data?.count ?? 0 }) });
      void load();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : t('errUnpublish') });
    } finally {
      setPublishingId(null);
    }
  }, [load, t]);

  const selected = definitions.find(d => d.id === selectedId) ?? null;

  if (selected) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedId(null);
              setFeedback(null);
              void load();
            }}
            className="h-8 gap-1.5 text-xs font-bold text-[#2487B8]"
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" />
            <span>{t('changeAssessment')}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Badge
              className={
                selected.isPublished
                  ? 'border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700'
                  : 'border border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-700'
              }
            >
              {selected.isPublished ? t('badgePublished') : t('badgeDraft')}
            </Badge>

            <Button
              size="sm"
              onClick={() => void handlePublish(selected.id, selected.draftCount)}
              disabled={publishingId === selected.id}
              className="h-8 bg-[#2487B8] text-xs font-bold text-white hover:bg-[#1B6C93]"
            >
              {publishingId === selected.id && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
              {t('publishMarksAction')}
            </Button>

            {selected.isPublished && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleUnpublish(selected.id)}
                disabled={publishingId === selected.id}
                className="h-8 border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                {t('unpublishMarksAction')}
              </Button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <MarksheetGridView
          assessmentDefinitionId={selected.id}
          loadUrl={`/api/academics/grade-entry?assessmentDefinitionId=${selected.id}`}
          saveUrl="/api/academics/grade-entry"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('gradeEntryTitle')}</h1>
        <p className="mt-1 text-xs text-slate-500">
          {t('gradeEntrySubtitle')}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            className="ms-auto h-7 text-xs font-bold text-red-700"
          >
            {tCommon('retry')}
          </Button>
        </div>
      )}

      <div className="relative">
        <Search className="
          absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-slate-400
        "
        />
        <Input
          placeholder={t('searchAssessmentPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="
            h-10 rounded-xl border-none bg-slate-50 ps-9 text-start text-xs
          "
        />
      </div>

      {loading && (
        <div className="
          flex items-center justify-center gap-2 py-16 text-xs font-bold
          text-slate-400
        "
        >
          <Loader2 className="size-4 animate-spin" />
          <span>{t('loadingAssessments')}</span>
        </div>
      )}

      {!loading && definitions.length === 0 && !error && (
        <Card className="
          space-y-2 rounded-2xl border border-dashed border-slate-300 p-10
          text-center
        "
        >
          <ClipboardList className="mx-auto size-8 text-slate-300" />
          <p className="text-sm font-extrabold text-[#16212B]">{t('noAssessmentsToGrade')}</p>
          <p className="text-xs text-slate-500">
            {t('noAssessmentsToGradeDesc')}
          </p>
          <Link
            href={`/${locale}/dashboard/academics/evaluations`}
            className="
              inline-block pt-1 text-xs font-bold text-[#2487B8]
              hover:underline
            "
          >
            {t('backToExamList')}
          </Link>
        </Card>
      )}

      {!loading && definitions.length > 0 && filtered.length === 0 && (
        <p className="py-10 text-center text-xs font-bold text-slate-400">
          {t('noAssessmentsMatchSearch')}
        </p>
      )}

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(definition => (
          <div
            key={definition.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedId(definition.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                setSelectedId(definition.id);
              }
            }}
            className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-start shadow-2xs transition hover:border-[#2487B8]/40 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#DCEBF4] text-[#1B6C93]">
                <ClipboardList className="size-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#16212B]">{definition.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{typeLabels[definition.type] ?? definition.type}</span>
                  {typeof definition.totalMarks === 'number' && definition.totalMarks > 0 && (
                    <>
                      <span>·</span>
                      <span>{definition.totalMarks} note(s)</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                className={
                  definition.isPublished
                    ? 'border border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-700'
                }
              >
                {definition.isPublished ? t('badgePublished') : t('badgeDraft')}
              </Badge>

              {Boolean(definition.draftCount && definition.draftCount > 0) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={e => {
                    e.stopPropagation();
                    void handlePublish(definition.id, definition.draftCount);
                  }}
                  disabled={publishingId === definition.id}
                  className="h-7 border-[#2487B8]/40 bg-[#2487B8]/10 text-[11px] font-bold text-[#2487B8] hover:bg-[#2487B8] hover:text-white"
                >
                  {publishingId === definition.id && <Loader2 className="me-1 size-3 animate-spin" />}
                  {t('publishMarksAction')}
                </Button>
              )}

              <Badge className="flex items-center gap-1 border-none bg-slate-100 text-[10px] font-bold text-slate-600">
                <span>{t('enterGradesAction')}</span>
                <ArrowRight className="size-3 rtl:rotate-180" />
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
