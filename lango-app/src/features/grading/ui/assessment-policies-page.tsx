import { AssessmentPoliciesClient } from './assessment-policies-client';

export async function AssessmentPoliciesPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches evaluation rules & scales server-side
  return <AssessmentPoliciesClient locale={locale} />;
}
