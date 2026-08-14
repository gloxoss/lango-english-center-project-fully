import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryPoliciesClient } from '@/features/library/ui/library-policies-client';

export default async function LibrarianPoliciesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { allowedRoles: ['librarian', 'school_admin', 'super_admin'], capability: 'library.policy.manage' });
  return <LibraryPoliciesClient />;
}
