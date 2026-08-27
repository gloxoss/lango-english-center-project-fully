import { requireServerPage } from '@/libs/api/page-guard';
import { TemplatesView } from '@/features/broadcast/ui/templates-view';

export const metadata = {
  title: 'Modèles de messages — SchoolOS',
  description: 'Modèles de diffusion : versions versionnées et publication.',
};

export default async function BroadcastTemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.manage' });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <TemplatesView />
    </div>
  );
}
