import { StudentsListClient } from './students-list-client';

export async function StudentsListPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches student directory server-side
  return <StudentsListClient locale={locale} />;
}
