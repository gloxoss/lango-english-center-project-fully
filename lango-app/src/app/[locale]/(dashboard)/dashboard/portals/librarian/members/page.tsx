import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryMembersClient } from '@/features/library/ui/library-members-client';

export default async function LibrarianMembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { capability: 'library.circulation.operate' });
  return <LibraryMembersClient />;
}
