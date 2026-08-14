import { describe, expect, it } from 'vitest';
import { isRelationshipEffective, requireRights, type RelationshipAuth } from '../relationship-resolver';
import { ApiError } from '@/libs/api/errors';

const baseAuth = (over: Partial<RelationshipAuth> = {}): RelationshipAuth => ({
  relationshipId: 'rel-1',
  guardianId: 'g-1',
  studentId: 'stu-1',
  rights: { academic: true, attendance: true, finance: true, medical: true, communication: true },
  isPrimaryContact: false,
  isEmergencyContact: false,
  canPickup: false,
  hasPickupAuthority: false,
  isFinanciallyResponsible: true,
  custodyRestriction: null,
  sensitiveContactHidden: false,
  ...over,
});

describe('isRelationshipEffective', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();

  it('accepts an active, open-ended relationship', () => {
    expect(isRelationshipEffective('active', null, null)).toBe(true);
    expect(isRelationshipEffective('active', past, null)).toBe(true);
    expect(isRelationshipEffective('active', null, future)).toBe(true);
  });

  it('rejects non-active statuses', () => {
    expect(isRelationshipEffective('suspended', null, null)).toBe(false);
    expect(isRelationshipEffective('revoked', null, null)).toBe(false);
  });

  it('rejects a relationship not yet effective', () => {
    expect(isRelationshipEffective('active', future, null)).toBe(false);
  });

  it('rejects an expired relationship', () => {
    expect(isRelationshipEffective('active', null, past)).toBe(false);
    expect(isRelationshipEffective('active', past, past)).toBe(false);
  });
});

describe('requireRights', () => {
  it('passes when every demanded right is granted', () => {
    expect(() =>
      requireRights(baseAuth(), { academic: true, finance: true }),
    ).not.toThrow();
  });

  it.each(['academic', 'attendance', 'finance', 'medical', 'communication'] as const)(
    'throws 403 when the %s right is withheld',
    (key) => {
      const auth = baseAuth({ rights: { academic: true, attendance: true, finance: true, medical: true, communication: true, [key]: false } });
      let thrown: unknown;
      try { requireRights(auth, { [key]: true }); } catch (e) { thrown = e; }
      expect(thrown).toBeInstanceOf(ApiError);
      expect((thrown as ApiError).status).toBe(403);
      expect((thrown as ApiError).code).toBe('FORBIDDEN');
    },
  );

  it('ignores rights that are not demanded', () => {
    const auth = baseAuth({ rights: { academic: false, attendance: true, finance: true, medical: true, communication: true } });
    expect(() => requireRights(auth, { finance: true })).not.toThrow();
  });
});
