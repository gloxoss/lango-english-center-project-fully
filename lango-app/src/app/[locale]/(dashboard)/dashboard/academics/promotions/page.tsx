import { PromotionWizardView } from '@/features/academics/ui/promotion-wizard-view';

export default async function PromotionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PromotionWizardView locale={locale} />;
}
