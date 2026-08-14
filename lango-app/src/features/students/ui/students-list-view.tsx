import { StudentsListPage } from './students-list-page';

export async function StudentsListView({ locale }: { locale?: string } = {}) {
  return <StudentsListPage locale={locale} />;
}

export { StudentsListView as StudentsDirectoryView };
