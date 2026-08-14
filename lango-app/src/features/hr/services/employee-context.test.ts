import { describe, expect, it } from 'vitest';
import { evaluateEmployeeSelfServiceAccess } from './employee-context';

describe('employee self-service employment boundary', () => {
  const today = '2026-08-09';

  it('allows an active employee inside the effective contract window', () => {
    expect(evaluateEmployeeSelfServiceAccess({
      employmentStatus: 'active', hireDate: '2025-01-01', contractStartDate: '2025-01-01', contractEndDate: null, archivedAt: null,
    }, today)).toEqual({ allowed: true, mode: 'active' });
  });

  it.each(['offboarded', 'archived'])('denies operational access for %s employment', (employmentStatus) => {
    expect(evaluateEmployeeSelfServiceAccess({
      employmentStatus, hireDate: '2025-01-01', contractStartDate: '2025-01-01', contractEndDate: null, archivedAt: employmentStatus === 'archived' ? '2026-01-01T00:00:00Z' : null,
    }, today).allowed).toBe(false);
  });

  it('denies access before hire or contract start', () => {
    expect(evaluateEmployeeSelfServiceAccess({
      employmentStatus: 'active', hireDate: '2026-09-01', contractStartDate: '2026-09-01', contractEndDate: null, archivedAt: null,
    }, today).allowed).toBe(false);
  });

  it('allows retained read-only access for 90 days after contract end', () => {
    expect(evaluateEmployeeSelfServiceAccess({
      employmentStatus: 'inactive', hireDate: '2025-01-01', contractStartDate: '2025-01-01', contractEndDate: '2026-07-01', archivedAt: null,
    }, today)).toEqual({ allowed: true, mode: 'retained_read_only' });
  });

  it('denies access after the retention window', () => {
    expect(evaluateEmployeeSelfServiceAccess({
      employmentStatus: 'inactive', hireDate: '2025-01-01', contractStartDate: '2025-01-01', contractEndDate: '2026-01-01', archivedAt: null,
    }, today).allowed).toBe(false);
  });
});
