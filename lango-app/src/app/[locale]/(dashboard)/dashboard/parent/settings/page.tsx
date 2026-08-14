import { requireServerPage } from '@/libs/api/page-guard';
import { SettingsView } from '@/features/parent/ui/SettingsView';

export default async function ParentSettingsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  return <SettingsView />;
}
