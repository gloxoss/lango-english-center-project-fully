import { ClassesClient } from './classes-client';

export async function ClassesPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches initial server data
  return <ClassesClient locale={locale} />;
}
