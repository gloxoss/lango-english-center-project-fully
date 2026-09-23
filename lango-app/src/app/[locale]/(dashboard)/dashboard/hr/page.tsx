import { redirect } from 'next/navigation';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HrPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.read' });
  redirect(`/${locale}/dashboard/hr/overview`);
}

