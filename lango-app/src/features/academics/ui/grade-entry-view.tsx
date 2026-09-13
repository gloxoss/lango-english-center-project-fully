'use client';

import { AlertCircle, ClipboardList, Loader2, Search, ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MarksheetGridView } from '@/features/assessment/ui/marksheet-grid-view';

type AssessmentDefinition = {
  id: string;
  title: string;
  type: string;
};

export function GradeEntryView() {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = definitions.find(d => d.id === selectedId) ?? null;

  if (selected) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedId(null)}
          className="h-8 gap-1.5 text-xs font-bold text-[#2487B8]"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" />
          <span>{t('changeAssessment')}</span>
        </Button>

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
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
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
        <Search className="absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder={t('searchAssessmentPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10 rounded-xl border-none bg-slate-50 ps-9 text-start text-xs"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          <span>{t('loadingAssessments')}</span>
        </div>
      )}

      {!loading && definitions.length === 0 && !error && (
        <Card className="space-y-2 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <ClipboardList className="mx-auto size-8 text-slate-300" />
          <p className="text-sm font-extrabold text-[#16212B]">{t('noAssessmentsToGrade')}</p>
          <p className="text-xs text-slate-500">
            {t('noAssessmentsToGradeDesc')}
          </p>
        </Card>
      )}

      {!loading && definitions.length > 0 && filtered.length === 0 && (
        <p className="py-10 text-center text-xs font-bold text-slate-400">
          {t('noAssessmentsMatchSearch')}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map(definition => (
          <button
            key={definition.id}
            type="button"
            onClick={() => setSelectedId(definition.id)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-start shadow-2xs transition hover:border-[#2487B8]/40 hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#DCEBF4] text-[#1B6C93]">
                <ClipboardList className="size-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#16212B]">{definition.title}</p>
                <p className="text-[11px] text-slate-400">
                  {typeLabels[definition.type] ?? definition.type}
                </p>
              </div>
            </div>
            <Badge className="border-none bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center gap-1">
              <span>{t('enterGradesAction')}</span>
              <ArrowRight className="size-3 rtl:rotate-180" />
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
