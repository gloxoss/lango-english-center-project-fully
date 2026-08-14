import { ClassSubjectsPage } from './class-subjects-page';

export async function ClassSubjectsView({ locale }: { locale?: string } = {}) {
  return <ClassSubjectsPage locale={locale} />;
}
