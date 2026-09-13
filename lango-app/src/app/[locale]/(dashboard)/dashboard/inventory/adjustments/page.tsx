import { requireServerPage } from '@/libs/api/page-guard';
import { AdjustmentsView } from '@/features/inventory/ui/adjustments-view';

export default async function InventoryAdjustmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.adjust.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <AdjustmentsView locale={locale} />
    </main>
  );
}
