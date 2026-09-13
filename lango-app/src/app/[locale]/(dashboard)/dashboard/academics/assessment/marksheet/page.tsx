import { MarksheetGridView } from '@/features/assessment/ui/marksheet-grid-view';
import { requireServerPage } from '@/libs/api/page-guard';
import { getTranslations } from 'next-intl/server';

/**
 * Keyboard-driven mark entry for one assessment.
 *
 * Both ids arrive as query params because the grid is reached from a list of
 * exams rather than being a resource with a canonical URL of its own.
 */
export default async function MarksheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ examTermId?: string; assessmentDefinitionId?: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'grading.manage' });

  const { examTermId, assessmentDefinitionId } = await searchParams;

  if (!examTermId || !assessmentDefinitionId) {
    const t = await getTranslations({ locale, namespace: 'Grading' });
    return (
      <div className="mx-auto max-w-[700px] rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <p className="text-sm font-extrabold text-[#16212B]">{t('noAssessmentSelected')}</p>
        <p className="mt-1 text-xs text-slate-500">
          {t('noAssessmentSelectedDesc')}
        </p>
      </div>
    );
  }

  const base = `/api/academics/exam-terms/${examTermId}/marksheet`;

  return (
    <MarksheetGridView
      assessmentDefinitionId={assessmentDefinitionId}
      loadUrl={`${base}?assessmentDefinitionId=${assessmentDefinitionId}`}
      saveUrl={base}
    />
  );
}
