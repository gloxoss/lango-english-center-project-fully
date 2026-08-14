import { FormIntakeClient } from './form-intake-client';

export async function FormIntakePage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches form intake configuration server-side
  return <FormIntakeClient locale={locale} />;
}
