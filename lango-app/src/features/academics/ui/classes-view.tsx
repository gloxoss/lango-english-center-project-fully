import { ClassesPage } from './classes-page';

export async function ClassesView({ locale }: { locale?: string } = {}) {
  return <ClassesPage locale={locale} />;
}

export { ClassesView as ClassesGroupsView };
