import { requireLivePage } from '@/features/live-classrooms/ui/page-guard';
import { SessionsListView } from '@/features/live-classrooms/ui/sessions-list-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function LiveClassesManagementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['teacher', 'school_admin', 'super_admin'] });
  await requireLivePage(locale, {
    allowedRoles: ['school_admin', 'super_admin', 'teacher'],
    requiredCapability: 'live.read',
  });
  return <SessionsListView locale={locale} />;
}
