import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/libs/auth';

export default async function SuperAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userRole = (session?.user as any)?.role;

  // Strict Server Component Guard: Only super_admin role can access /super-admin/*
  if (!session || userRole !== 'super_admin') {
    redirect(`/${locale}/dashboard`);
  }

  return <>{children}</>;
}
