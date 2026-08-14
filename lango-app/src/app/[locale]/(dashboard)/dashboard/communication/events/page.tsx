import { requireServerPage } from '@/libs/api/page-guard';
import { redirect } from 'next/navigation';

export default async function OldEventsCalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  redirect(`/${locale}/dashboard/events`);
}
