import { BadgeManagementView } from '@/features/attendance/ui/badge-management-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Gestion des Badges QR — SchoolOS',
  description: 'Émission et impression des badges QR sécurisés pour élèves et employés.',
};

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      <BadgeManagementView />
    </div>
  );
}
