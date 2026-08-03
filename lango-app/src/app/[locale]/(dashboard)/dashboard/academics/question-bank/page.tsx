import { QuestionBankView } from '@/features/academics/ui/question-bank-view';

export default async function QuestionBankPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <QuestionBankView locale={locale} />;
}
