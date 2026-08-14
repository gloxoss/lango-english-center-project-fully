import { AssessmentPoliciesPage } from './assessment-policies-page';

export async function AssessmentPoliciesView({ locale }: { locale?: string } = {}) {
  return <AssessmentPoliciesPage locale={locale} />;
}
