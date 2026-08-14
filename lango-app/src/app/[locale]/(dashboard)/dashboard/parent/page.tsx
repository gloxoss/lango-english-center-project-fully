import { requireServerPage } from '@/libs/api/page-guard';
import { ParentHomeView } from '@/features/parent/ui/ParentHomeView';

// Parent Portal home — server-guarded. The role must be `parent`; anything else
// is redirected. The child switcher and every widget are relationship-scoped and
// reauthorized server-side.
export default async function ParentPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  return <ParentHomeView />;
}
