/**
 * SCF-09-01. The Settings hub's "Configured" badges used to be one-item
 * proxies (`establishmentName` set, a staff row exists, any security key
 * exists...). Each of these functions reads canonical facts, so a badge means
 * what it says:
 *
 *  - Organisation: the tenant name, ICE and address are all filled;
 *  - School year: the current year (session_years.is_default) CONTAINS today —
 *    a year that ended in June does not make the school configured in
 *    September;
 *  - Security: security.requireTwoFactorForAdmins has a stored value;
 *  - Attendance: at least one attendance.* key is stored;
 *  - Numbering: at least one real naming_series counter exists;
 *  - Branches: at least one campus, and more than one only with the
 *    multi-branch add-on on.
 *
 * Pure function over gathered facts so the rules are unit-testable without a
 * database.
 */

export type SettingsHubFacts = {
  organisation: { name: string | null; ice: string | null; address: string | null };
  currentYear: { startDate: string; endDate: string } | null;
  today: string;
  staffCount: number;
  securityTwoFactorSet: boolean;
  providersKeySet: boolean;
  accountingDone: boolean;
  migrationDone: boolean;
  policiesKeysSet: boolean;
  attendanceKeySet: boolean;
  entitlementsCount: number;
  numberingSeriesCount: number;
  branchCount: number;
  multiBranchAddon: boolean;
  cndpDone: boolean;
};

export function computeSettingsModuleStatus(f: SettingsHubFacts): Record<string, boolean> {
  const organisationOk = Boolean(
    f.organisation.name?.trim() && f.organisation.ice?.trim() && f.organisation.address?.trim(),
  );
  const yearContainsToday = f.currentYear !== null
    && f.currentYear.startDate <= f.today
    && f.currentYear.endDate >= f.today;

  return {
    onboarding: organisationOk && yearContainsToday,
    users: f.staffCount > 0,
    security: f.securityTwoFactorSet,
    providers: f.providersKeySet,
    'accounting-defaults': f.accountingDone,
    migration: f.migrationDone,
    policies: f.policiesKeysSet,
    attendance: f.attendanceKeySet,
    entitlements: f.entitlementsCount > 0,
    numbering: f.numberingSeriesCount > 0,
    branches: f.branchCount >= 1 && (f.branchCount === 1 || f.multiBranchAddon),
    cndp: f.cndpDone,
  };
}
