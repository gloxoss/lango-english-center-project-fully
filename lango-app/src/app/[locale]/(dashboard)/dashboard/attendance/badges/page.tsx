import { redirect } from 'next/navigation';

/**
 * Moved to Cartes & Convocations → Cartes & badges (phase 5).
 *
 * A student's identity is the student and their matricule, the card is the
 * physical object, and the QR is a revocable credential printed on that card —
 * one thing, so one place to manage it. This route redirects rather than
 * disappearing outright so an existing bookmark or an un-updated menu entry
 * lands somewhere real instead of 404ing.
 *
 * The route itself is removed along with its menu entry in the final navigation
 * pass, once nothing points here.
 */
export default async function LegacyBadgesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/cards/badges`);
}
