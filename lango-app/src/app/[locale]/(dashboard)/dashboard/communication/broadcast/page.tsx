import { requireServerPage } from '@/libs/api/page-guard';
import { BroadcastSendView } from '@/features/communication/ui/broadcast-send-view';

export const metadata = {
  title: 'Diffusion — SchoolOS',
  description: 'Envoyez des annonces ou des SMS en masse à vos élèves et parents.',
};

export default async function BroadcastPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.manage' });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BroadcastSendView />
    </div>
  );
}
