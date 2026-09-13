import { requireServerPage } from '@/libs/api/page-guard';
import { OverviewView } from '@/features/inventory/ui/overview-view';

export default async function InventoryOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.read' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <OverviewView locale={locale} />
    </main>
  );
}
