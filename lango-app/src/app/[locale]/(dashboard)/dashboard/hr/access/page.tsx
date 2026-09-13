import { AccessLifecycleView } from '@/features/hr/ui/access-lifecycle-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HrAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.access.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <AccessLifecycleView />
    </main>
  );
}
