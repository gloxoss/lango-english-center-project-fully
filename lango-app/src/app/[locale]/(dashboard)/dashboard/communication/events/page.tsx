import { requireServerPage } from '@/libs/api/page-guard';
import { redirect } from 'next/navigation';

export default async function OldEventsCalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  redirect(`/${locale}/dashboard/events`);
}
