import { ClassSectionTeachersClient } from './class-section-teachers-client';

export async function ClassSectionTeachersPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches server data
  return <ClassSectionTeachersClient locale={locale} />;
}
