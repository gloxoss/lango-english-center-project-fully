import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryMemberDetailClient } from '@/features/library/ui/library-member-detail-client';

export default async function LibrarianMemberDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await props.params;
  await requireLibraryPage(locale, { capability: 'library.circulation.operate' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibraryMemberDetailClient memberId={id} />
    </main>
  );
}
