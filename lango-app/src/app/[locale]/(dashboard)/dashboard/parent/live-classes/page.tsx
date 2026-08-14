import { requireServerPage } from '@/libs/api/page-guard';
import { MySessionsClient } from '@/features/live-classrooms/ui/my-sessions-client';

export default async function ParentLiveClassesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireServerPage(locale, {
    allowedRoles: ['parent'],
    requiredCapability: 'live.join',
  });
  return <MySessionsClient />;
}
