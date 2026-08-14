import { SessionCopyView } from '@/features/academics/ui/session-copy-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SessionCopyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SessionCopyView locale={locale} />;
}
