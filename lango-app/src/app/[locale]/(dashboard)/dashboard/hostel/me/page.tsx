import { ResidentMeView } from '@/features/hostel/ui/resident-me-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ResidentMePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['student'] });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <ResidentMeView />
    </main>
  );
}
