// One place decides what a CNDP filing status means on screen, so a badge in the
// header and /settings/cndp can never disagree.
//
// Nothing here may assert that the school is compliant. The only positive state
// is the one the registry actually holds: SchoolOS ships the tooling (Law 09-08
// handling, F211 reports), the school's own filing is a separate fact and is
// what these labels describe.

export type CndpStatusKey = 'approved' | 'submitted' | 'draft' | 'unavailable';

export type CndpStatusView = {
  key: CndpStatusKey;
  label: string;
  tone: 'good' | 'progress' | 'none' | 'unknown';
};

const VIEWS: Record<CndpStatusKey, CndpStatusView> = {
  // Self-declared by the school (reference + date required by the API); SchoolOS
  // cannot check it with the CNDP, so it never says "conforme".
  approved: { key: 'approved', label: 'Récépissé déclaré', tone: 'good' },
  submitted: { key: 'submitted', label: 'En cours', tone: 'progress' },
  draft: { key: 'draft', label: 'Non déposé', tone: 'none' },
  unavailable: { key: 'unavailable', label: 'Information non disponible', tone: 'unknown' },
};

/**
 * Map a stored filing status to what the screen may claim.
 *
 * A missing filing row is "Non déposé" (the school has not filed), while an
 * unreadable registry is "Information non disponible": never a positive claim
 * built out of missing data.
 */
export function cndpStatusOf(status: string | null | undefined, unavailable = false): CndpStatusView {
  if (unavailable) return VIEWS.unavailable;
  if (status === 'approved') return VIEWS.approved;
  if (status === 'submitted') return VIEWS.submitted;
  return VIEWS.draft;
}
