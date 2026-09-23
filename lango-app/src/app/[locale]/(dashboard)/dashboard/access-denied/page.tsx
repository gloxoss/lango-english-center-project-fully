import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalStateView } from '@/components/shared/portal-state';
import { getServerUserContext } from '@/libs/auth/server-context';
import { resolveLandingPath } from '@/libs/api/portal-manifest';

export default async function AccessDeniedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const context = await getServerUserContext();
  if (!context) redirect(`/${locale}/login`);
  const landing = await resolveLandingPath(context);
  return (
    <div className="mx-auto max-w-2xl py-10">
      <PortalStateView
        state="forbidden"
        action={<Link href={`/${locale}${landing ?? '/dashboard'}`} className="text-sm font-semibold text-blue-700 underline">Retour à mon portail</Link>}
      />
    </div>
  );
}
