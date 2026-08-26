// Report access matrix (sensitivity + domain scoped) — the pure function that
// gates which report definitions each role may see. This was previously never
// enforced anywhere; the catalog route now filters by it. Proves the boundary
// without any DB.
import { describe, expect, it } from 'vitest';
import { canAccessReport } from '../../services/report-access';

describe('canAccessReport role × sensitivity × domain matrix', () => {
  const def = (sensitivityLevel: string, domain: string) => ({ sensitivityLevel, domain });

  it('school_admin and super_admin see everything', () => {
    expect(canAccessReport('school_admin', def('confidential', 'Finance'))).toBe(true);
    expect(canAccessReport('super_admin', def('confidential', 'HR'))).toBe(true);
  });

  it('teacher sees standard and restricted reports only', () => {
    expect(canAccessReport('teacher', def('standard', 'Academics'))).toBe(true);
    expect(canAccessReport('teacher', def('restricted', 'Fees'))).toBe(true);
    expect(canAccessReport('teacher', def('confidential', 'Finance'))).toBe(false);
  });

  it('accountant sees standard reports plus Fees/Financial domains', () => {
    expect(canAccessReport('accountant', def('standard', 'Academics'))).toBe(true);
    expect(canAccessReport('accountant', def('restricted', 'Fees'))).toBe(true);
    expect(canAccessReport('accountant', def('restricted', 'Financial'))).toBe(true);
    expect(canAccessReport('accountant', def('restricted', 'HR'))).toBe(false);
    expect(canAccessReport('accountant', def('confidential', 'Financial'))).toBe(true);
  });

  it('student and parent see nothing', () => {
    expect(canAccessReport('student', def('standard', 'Academics'))).toBe(false);
    expect(canAccessReport('parent', def('standard', 'Academics'))).toBe(false);
  });
});
