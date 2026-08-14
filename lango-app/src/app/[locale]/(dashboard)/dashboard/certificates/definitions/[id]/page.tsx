import { requireServerPage } from '@/libs/api/page-guard';
import CertificateDefinitionDesignerPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const p = await params;
  await requireServerPage(p.locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <CertificateDefinitionDesignerPage params={p} />;
}
