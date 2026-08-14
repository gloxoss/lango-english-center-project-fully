import { SyllabusClient } from './syllabus-client';

export async function SyllabusPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches chapters & resources server-side
  return <SyllabusClient locale={locale} />;
}
