import { requireServerPage } from '@/libs/api/page-guard';
import { CommunicationView } from '@/features/parent/ui/CommunicationView';

export default async function ParentCommunicationPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  return <CommunicationView />;
}
