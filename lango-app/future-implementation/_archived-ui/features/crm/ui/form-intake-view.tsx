import { FormIntakePage } from './form-intake-page';

export async function FormIntakeView({ locale }: { locale?: string } = {}) {
  return <FormIntakePage locale={locale} />;
}
