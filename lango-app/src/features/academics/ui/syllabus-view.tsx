import { SyllabusPage } from './syllabus-page';

export async function SyllabusView({ locale }: { locale?: string } = {}) {
  return <SyllabusPage locale={locale} />;
}
