// Real, single, shared safeguarding eligibility check (future-implementation
// /alumni-portal) - used by BOTH directory search and mentoring listing so
// there is exactly one real implementation of the age rule, not two that
// could silently drift apart.
//
// Fails CLOSED: unknown/missing date of birth is treated as NOT eligible,
// never assumed to be an adult. Real child-safety discipline.
export function isEligibleForDirectoryAndMentoring(dateOfBirth: string | null | undefined): boolean {
  if (!dateOfBirth) {
    return false;
  }

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return false;
  }

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 18;
}
