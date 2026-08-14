import { PromotionWizardView } from '@/features/academics/ui/promotion-wizard-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function PromotionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <PromotionWizardView locale={locale} />;
}
