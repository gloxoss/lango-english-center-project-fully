import { AssessmentPoliciesView } from '@/features/grading/ui/assessment-policies-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AssessmentPoliciesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AssessmentPoliciesView locale={locale} />;
}
