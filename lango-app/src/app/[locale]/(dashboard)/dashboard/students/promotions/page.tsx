import { PromotionsPlayground } from '@/features/students/ui/promotions-playground';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function PromotionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'students.update' });
  return <PromotionsPlayground locale={locale} />;
}
