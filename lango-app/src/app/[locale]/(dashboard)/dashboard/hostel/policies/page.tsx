import { HostelPoliciesView } from '@/features/hostel/ui/hostel-policies-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelPoliciesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.policies.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <HostelPoliciesView />
    </main>
  );
}
