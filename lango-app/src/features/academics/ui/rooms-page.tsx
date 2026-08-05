import { RoomsClient } from './rooms-client';

export async function RoomsPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches room definitions server-side
  return <RoomsClient locale={locale} />;
}
