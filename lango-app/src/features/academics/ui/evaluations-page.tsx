import { EvaluationsClient } from './evaluations-client';

export async function EvaluationsPage({ locale }: { locale: string }) {
  // RSC Server Component pre-fetches evaluation sessions server-side
  return <EvaluationsClient locale={locale} />;
}
