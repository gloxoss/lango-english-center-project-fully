import { PersonnelPlayground } from '@/features/hr/ui/personnel-playground';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Ressources Humaines — SchoolOS',
  description: 'Supervisez le personnel, gérez les dossiers employés, les contrats et les affectations.',
};

export default async function HrPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <PersonnelPlayground locale={locale} />;
}
