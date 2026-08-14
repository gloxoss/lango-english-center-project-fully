import { requireServerPage } from '@/libs/api/page-guard';
import { FormIntakeView } from '@/features/crm/ui/form-intake-view';

export default async function FormIntakePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <FormIntakeView locale={locale} />;
}
