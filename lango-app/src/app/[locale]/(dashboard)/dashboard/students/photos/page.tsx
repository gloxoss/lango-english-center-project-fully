import { StudentPhotosView } from '@/features/students/ui/student-photos-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'students.update' });
  return <StudentPhotosView />;
}
