import { GradeEntryView } from '@/features/academics/ui/grade-entry-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function GradeEntryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Entry is a write action, so it needs the write capability — `grading.read`
  // would let a read-only role open a page whose every control 403s.
  await requireServerPage(locale, { requiredCapability: 'grading.manage' });
  return <GradeEntryView />;
}
