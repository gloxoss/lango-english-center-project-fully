import { ClassSectionTeachersPage } from './class-section-teachers-page';

export async function ClassSectionTeachersView({ locale }: { locale?: string } = {}) {
  return <ClassSectionTeachersPage locale={locale} />;
}
