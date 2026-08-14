import { SessionsListClient } from './sessions-list-client';

export function SessionsListView({ locale }: { locale: string }) {
  return <SessionsListClient locale={locale} />;
}
