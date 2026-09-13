import { requireServerPage } from '@/libs/api/page-guard';
import { GuardIncidentsView } from '@/features/guard/ui/guard-incidents-view';

export default async function GuardIncidentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guard.incidents.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardIncidentsView />
    </main>
  );
}
