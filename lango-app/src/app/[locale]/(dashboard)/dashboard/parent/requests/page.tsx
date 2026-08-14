import { requireServerPage } from '@/libs/api/page-guard';
import { RequestsView } from '@/features/parent/ui/RequestsView';

export default async function ParentRequestsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  return <RequestsView />;
}
