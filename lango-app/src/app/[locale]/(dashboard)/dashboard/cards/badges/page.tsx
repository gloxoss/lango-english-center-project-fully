import { BadgeManagementView } from '@/features/cards/ui/badge-management-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Cartes & badges — SchoolOS',
  description: 'Émission, remplacement et impression des badges sécurisés des élèves et du personnel.',
};

/**
 * CARTES & BADGES — the consolidated destination (phase 5).
 *
 * The student's identity is the student and their matricule; the card is the
 * physical object; the QR is a revocable credential printed on that card. Those
 * are one thing, so they are managed in one place rather than on a separate
 * "Badges QR" page under Attendance.
 *
 * Guarded by `attendance.manage` because that is what the identity-badge APIs
 * this page calls require (src/app/api/identity-badges). Guarding it with
 * `cards.issue` would let a role open the page and then 403 on every action.
 */
export default async function CardsBadgesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'attendance.manage' });
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      <BadgeManagementView />
    </div>
  );
}
