import { ClassSubjectsClient } from './class-subjects-client';

export async function ClassSubjectsPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches class subject data server-side
  return <ClassSubjectsClient locale={locale} />;
}
