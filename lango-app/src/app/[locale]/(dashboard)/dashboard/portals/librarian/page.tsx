import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibrarianPortalClient } from '@/features/library/ui/librarian-portal-client';
export default async function LibrarianPortalPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; const context = await requireLibraryPage(locale, { allowedRoles: ['librarian', 'school_admin', 'super_admin'], capability: 'library.report.read' }); return <LibrarianPortalClient viewingRole={context.role} />; }
