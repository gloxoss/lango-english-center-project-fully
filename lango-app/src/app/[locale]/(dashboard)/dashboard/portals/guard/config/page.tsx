import { requireServerPage } from '@/libs/api/page-guard';
import { GuardConfigView } from '@/features/guard/ui/guard-config-view';

export default async function GuardConfigPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guard.gates.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardConfigView />
    </main>
  );
}
