import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlumniNav } from '@/features/alumni/ui/alumni-nav';
import { auth } from '@/libs/auth';
import { db } from '@/libs/DB';
import { user as userTable } from '@/models/Schema';

// Real, separate self-service shell for alumni - never the staff (dashboard)
// layout (future-implementation/alumni-portal). Role-gated server-side, not
// just hidden client-side.
export default async function AlumniPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const [principal] = await db.select({ role: userTable.role, name: userTable.name }).from(userTable).where(eq(userTable.id, session.user.id)).limit(1);
  if (principal?.role !== 'alumni') {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AlumniNav locale={locale} userName={principal.name} />
      <main className="max-w-[1200px] mx-auto p-6">{children}</main>
    </div>
  );
}
