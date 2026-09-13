import { requireServerPage } from '@/libs/api/page-guard';
import { TemplatesView } from '@/features/broadcast/ui/templates-view';

export const metadata = {
  title: 'Modèles de messages — SchoolOS',
  description: 'Création et gestion des modèles de diffusion versionnés.',
};

export default async function BroadcastTemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale} className="mx-auto max-w-7xl px-4 py-8">
      <TemplatesView />
    </main>
  );
}
