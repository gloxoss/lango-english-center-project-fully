import { requireServerPage } from '@/libs/api/page-guard';
import { TransfersView } from '@/features/inventory/ui/transfers-view';

export default async function InventoryTransfersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.adjust.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <TransfersView locale={locale} />
    </main>
  );
}
