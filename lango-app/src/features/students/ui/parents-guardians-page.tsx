import { ParentsGuardiansClient } from './parents-guardians-client';

export async function ParentsGuardiansPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches households and legal guardians server-side
  return <ParentsGuardiansClient locale={locale} />;
}
