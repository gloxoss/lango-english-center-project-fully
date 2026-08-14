import { AccountingDocumentForm } from '@/features/accounting/ui/accounting-document-form';
import { requireServerPage } from '@/libs/api/page-guard';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['accountant', 'school_admin', 'super_admin'], requiredCapability: 'accounting.expense.prepare' });
  return <AccountingDocumentForm mode="expense" />;
}
