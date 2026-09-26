import { describe, expect, it } from 'vitest';
import { computeSettingsModuleStatus, type SettingsHubFacts } from '@/features/settings/services/settings-hub-status';

/**
 * SCF-09-01. Each Settings-hub badge is driven by a canonical fact. These are
 * the rules the audit found wrong (one-item proxies): the card said
 * "Configuré" for a school year that had already ended, for a numbering page
 * with no real series, and for a two-campus school without the multi-branch
 * add-on.
 */

const facts = (overrides: Partial<SettingsHubFacts> = {}): SettingsHubFacts => ({
  organisation: { name: 'Groupe Scolaire Atlas', ice: 'ICE-1', address: 'Casablanca' },
  currentYear: { startDate: '2026-09-01', endDate: '2027-06-30' },
  today: '2026-10-01',
  staffCount: 1,
  securityTwoFactorSet: true,
  providersKeySet: true,
  accountingDone: true,
  migrationDone: true,
  policiesKeysSet: true,
  attendanceKeySet: true,
  entitlementsCount: 1,
  numberingSeriesCount: 1,
  branchCount: 1,
  multiBranchAddon: false,
  cndpDone: true,
  ...overrides,
});

describe('Settings hub completeness from canonical facts (SCF-09-01)', () => {
  it('organisation: name + ICE + address AND a current year that contains today', () => {
    expect(computeSettingsModuleStatus(facts()).onboarding).toBe(true);

    // A year that ended before today does not make the school configured.
    expect(computeSettingsModuleStatus(facts({
      currentYear: { startDate: '2025-09-01', endDate: '2026-06-30' },
    })).onboarding).toBe(false);

    expect(computeSettingsModuleStatus(facts({ currentYear: null })).onboarding).toBe(false);
    expect(computeSettingsModuleStatus(facts({ organisation: { name: 'X', ice: null, address: 'Y' } })).onboarding).toBe(false);
    expect(computeSettingsModuleStatus(facts({ organisation: { name: 'X', ice: 'I', address: '  ' } })).onboarding).toBe(false);
  });

  it('numbering: at least one real naming_series counter', () => {
    expect(computeSettingsModuleStatus(facts({ numberingSeriesCount: 0 })).numbering).toBe(false);
    expect(computeSettingsModuleStatus(facts({ numberingSeriesCount: 3 })).numbering).toBe(true);
  });

  it('branches: one campus is configured, two require the multi-branch add-on', () => {
    expect(computeSettingsModuleStatus(facts({ branchCount: 0 })).branches).toBe(false);
    expect(computeSettingsModuleStatus(facts({ branchCount: 1 })).branches).toBe(true);
    expect(computeSettingsModuleStatus(facts({ branchCount: 2, multiBranchAddon: false })).branches).toBe(false);
    expect(computeSettingsModuleStatus(facts({ branchCount: 2, multiBranchAddon: true })).branches).toBe(true);
  });

  it('security: the 2FA-for-admins setting must be stored', () => {
    expect(computeSettingsModuleStatus(facts({ securityTwoFactorSet: false })).security).toBe(false);
    expect(computeSettingsModuleStatus(facts({ securityTwoFactorSet: true })).security).toBe(true);
  });

  it('attendance: any attendance key stored counts', () => {
    expect(computeSettingsModuleStatus(facts({ attendanceKeySet: false })).attendance).toBe(false);
    expect(computeSettingsModuleStatus(facts({ attendanceKeySet: true })).attendance).toBe(true);
  });
});
