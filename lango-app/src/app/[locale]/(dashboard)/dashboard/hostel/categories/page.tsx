import { CategoriesView } from '@/features/hostel/ui/categories-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <CategoriesView />;
}
