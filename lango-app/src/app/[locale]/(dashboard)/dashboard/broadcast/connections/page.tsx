import { requireServerPage } from '@/libs/api/page-guard';
import { ConnectionsView } from '@/features/broadcast/ui/connections-view';

export const metadata = {
  title: 'Connexions de diffusion — SchoolOS',
  description: 'Canaux de diffusion : connexions et fournisseurs de messagerie.',
};

export default async function BroadcastConnectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ConnectionsView />
    </div>
  );
}
