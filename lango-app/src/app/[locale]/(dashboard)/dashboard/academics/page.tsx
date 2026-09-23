import { requireServerPage } from '@/libs/api/page-guard';
import { redirect } from 'next/navigation';
import { hasCapability } from '@/libs/api/permissions';

export default async function AcademicsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const context = await requireServerPage(locale, { requiredCapability: 'academics.read' });
  const role = context.role === 'super_admin' && context.tenantId ? 'school_admin' : context.role;
  if (await hasCapability(context.userId, context.tenantId ?? '', role, 'academics.manage')) {
    redirect(`/${locale}/dashboard/academics/readiness`);
  }
  redirect(`/${locale}/dashboard/academics/teacher-schedule`);
}
