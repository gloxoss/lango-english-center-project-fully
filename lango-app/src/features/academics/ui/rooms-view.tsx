import { RoomsPage } from './rooms-page';

export async function RoomsView({ locale }: { locale?: string } = {}) {
  return <RoomsPage locale={locale} />;
}
