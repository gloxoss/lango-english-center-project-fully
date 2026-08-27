import { redirect } from 'next/navigation';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function InventoryRootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.read' });
  redirect(`/${locale}/dashboard/inventory/overview`);
}
