import { InquiriesKanbanView } from '@/features/crm/ui/inquiries-kanban-view';

export const metadata = {
  title: 'Pipeline CRM — SchoolOS',
  description: 'Gestion du pipeline de prospects et des demandes de renseignements.',
};

export default function CrmPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <InquiriesKanbanView />
    </div>
  );
}
