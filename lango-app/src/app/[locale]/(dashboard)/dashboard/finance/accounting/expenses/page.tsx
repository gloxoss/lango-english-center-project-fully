import { ExpenseWorkflowView } from '@/features/accounting/ui/expense-workflow-view';
import { requireServerPage } from '@/libs/api/page-guard';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['accountant', 'school_admin', 'super_admin'], requiredCapability: 'accounting.account.read' });
  return <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}><ExpenseWorkflowView locale={locale} /></main>;
}
