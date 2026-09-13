import { requireServerPage } from '@/libs/api/page-guard';
import { AutomationsView } from '@/features/broadcast/ui/automations-view';

export const metadata = {
  title: 'Automations de diffusion — SchoolOS',
  description: 'Automatisation des envois d’anniversaire et déclencheurs d’événements.',
};

export default async function BroadcastAutomationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.automations.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale} className="mx-auto max-w-7xl px-4 py-8">
      <AutomationsView />
    </main>
  );
}
