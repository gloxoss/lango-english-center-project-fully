import { requireServerPage } from '@/libs/api/page-guard';
import { InquiriesKanbanView } from '@/features/crm/ui/inquiries-kanban-view';

export const metadata = {
  title: 'Pipeline CRM — SchoolOS',
  description: 'Gestion du pipeline de prospects et des demandes de renseignements.',
};

export default async function CrmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <InquiriesKanbanView />
    </div>
  );
}
