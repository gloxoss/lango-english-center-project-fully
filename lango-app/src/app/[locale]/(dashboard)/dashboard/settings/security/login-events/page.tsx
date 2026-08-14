import { requireServerPage } from '@/libs/api/page-guard';
import { LoginEventsView } from '@/features/settings/ui/login-events-view';

export default async function LoginEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <LoginEventsView />;
}
