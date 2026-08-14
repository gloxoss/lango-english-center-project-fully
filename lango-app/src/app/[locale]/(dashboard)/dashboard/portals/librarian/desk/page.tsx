import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibrarianPortalClient } from '@/features/library/ui/librarian-portal-client';
export default async function LibrarianDeskPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; await requireLibraryPage(locale, { allowedRoles: ['librarian', 'school_admin', 'super_admin'], capability: 'library.circulation.operate' }); return <LibrarianPortalClient desk />; }
