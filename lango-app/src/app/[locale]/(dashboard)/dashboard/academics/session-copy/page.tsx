import { SessionCopyView } from '@/features/academics/ui/session-copy-view';

export default async function SessionCopyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SessionCopyView locale={locale} />;
}
