import { requireLivePage } from '@/features/live-classrooms/ui/page-guard';
import { SessionDetailClient } from '@/features/live-classrooms/ui/session-detail-client';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function LiveClassDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { requiredCapability: 'live.read' });
  await requireLivePage(locale, { requiredCapability: 'live.read' });
  return <SessionDetailClient sessionId={id} locale={locale} />;
}
