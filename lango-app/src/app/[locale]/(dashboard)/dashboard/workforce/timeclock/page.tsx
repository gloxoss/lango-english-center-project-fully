import { requireServerPage } from '@/libs/api/page-guard';
import { TimeClockKiosk } from '@/features/workforce/ui/time-clock-kiosk';

export const metadata = {
  title: 'Pointeuse Employés & Staff — SchoolOS',
  description: 'Borne de pointage par badge QR pour les entrées et sorties du personnel.',
};

export default async function TimeClockPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <TimeClockKiosk />
    </div>
  );
}
