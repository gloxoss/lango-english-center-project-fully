import { AlumniAdminView } from '@/features/students/ui/alumni-admin-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AlumniAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AlumniAdminView locale={locale} />;
}
