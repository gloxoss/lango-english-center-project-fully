import { requireServerPage } from '@/libs/api/page-guard';
import { MilestoneTriggersView } from '@/features/crm/ui/milestone-triggers-view';

export default async function MilestoneTriggersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <MilestoneTriggersView locale={locale} />
    </main>
  );
}
