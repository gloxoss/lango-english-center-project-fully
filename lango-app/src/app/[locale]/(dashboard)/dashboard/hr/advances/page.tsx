import { requireServerPage } from '@/libs/api/page-guard';
import { redirect } from 'next/navigation';

export default async function HrAdvancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.manage' });
  redirect(`/${locale}/dashboard/hr/salary-advances`);
}
