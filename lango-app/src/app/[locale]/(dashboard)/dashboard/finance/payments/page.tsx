import { redirect } from 'next/navigation';
import { requireServerPage } from '@/libs/api/page-guard';

// payment-entry-view.tsx (previously rendered here) was a fully hardcoded
// mock duplicating the real Collection Desk (cashier session + student
// search + payment collection, built for real at /finance/collection-desk).
// Redirecting here instead of maintaining two parallel implementations of
// the same workflow - one real, one fake.
export default async function PaymentEntryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['accountant', 'school_admin', 'super_admin'] });
  redirect(`/${locale}/dashboard/finance/collection-desk`);
}
