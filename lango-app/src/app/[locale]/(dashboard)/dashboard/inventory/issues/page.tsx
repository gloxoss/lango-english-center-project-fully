import { requireServerPage } from '@/libs/api/page-guard';
import { IssuesView } from '@/features/inventory/ui/issues-view';

export default async function InventoryIssuesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.issue.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <IssuesView locale={locale} />
    </main>
  );
}
