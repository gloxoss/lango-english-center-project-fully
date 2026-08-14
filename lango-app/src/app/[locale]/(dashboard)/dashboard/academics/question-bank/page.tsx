import { QuestionBankView } from '@/features/academics/ui/question-bank-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function QuestionBankPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <QuestionBankView locale={locale} />;
}
