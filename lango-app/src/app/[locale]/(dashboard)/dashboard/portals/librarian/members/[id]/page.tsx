import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryMemberDetailClient } from '@/features/library/ui/library-member-detail-client';

export default async function LibrarianMemberDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await props.params;
  await requireLibraryPage(locale, { allowedRoles: ['school_admin', 'super_admin', 'librarian'], capability: 'library.circulation.operate' });
  return <LibraryMemberDetailClient memberId={id} />;
}
