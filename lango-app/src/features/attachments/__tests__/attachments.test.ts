import { describe, expect, it } from 'vitest';
import { isAssetVisibleToUser } from '../services/targeting-service';
import { AssetService } from '../services/asset-service';

// Real regression tests for this addon's invariants - no db-module mocking
// (this codebase has no such pattern, established twice already this
// session), every function here is the exact one the real routes/services
// call, not a duplicate.

describe('Attachments Book Invariants', () => {
  describe('Asset audience targeting (isAssetVisibleToUser)', () => {
    const viewer = { userId: 'stu-1', role: 'student', sectionId: 'sec-A', offeringIds: ['off-1'], classSubjectIds: ['cs-1'] };

    it('shows a broadcast asset (no targets) to any role', () => {
      expect(isAssetVisibleToUser([], true, viewer)).toBe(true);
    });

    it('shows a school-wide-targeted asset to any role - a genuinely different code path than the empty-targets case', () => {
      const targets = [{ targetKind: 'school' as const, targetRoleValue: null, targetRefId: null }];
      expect(isAssetVisibleToUser(targets, true, viewer)).toBe(true);
    });

    it('matches a role-targeted asset only for the exact role', () => {
      const targets = [{ targetKind: 'role' as const, targetRoleValue: 'student', targetRefId: null }];
      expect(isAssetVisibleToUser(targets, true, viewer)).toBe(true);
      expect(isAssetVisibleToUser(targets, true, { ...viewer, role: 'teacher' })).toBe(false);
    });

    it('matches a user-targeted asset only for that exact user', () => {
      const targets = [{ targetKind: 'user' as const, targetRoleValue: null, targetRefId: 'stu-1' }];
      expect(isAssetVisibleToUser(targets, true, viewer)).toBe(true);
      expect(isAssetVisibleToUser(targets, true, { ...viewer, userId: 'stu-2' })).toBe(false);
    });

    it('matches a class-section-targeted asset only for students in that section', () => {
      const targets = [{ targetKind: 'class_section' as const, targetRoleValue: null, targetRefId: 'sec-A' }];
      expect(isAssetVisibleToUser(targets, true, viewer)).toBe(true);
      expect(isAssetVisibleToUser(targets, true, { ...viewer, sectionId: 'sec-B' })).toBe(false);
    });

    it('matches a class-offering-targeted asset only for students enrolled in that offering', () => {
      const targets = [{ targetKind: 'class_offering' as const, targetRoleValue: null, targetRefId: 'off-1' }];
      expect(isAssetVisibleToUser(targets, true, viewer)).toBe(true);
      expect(isAssetVisibleToUser(targets, true, { ...viewer, offeringIds: ['off-9'] })).toBe(false);
    });

    it('matches a class-subject-targeted asset only for students in that class subject', () => {
      const targets = [{ targetKind: 'class_subject' as const, targetRoleValue: null, targetRefId: 'cs-1' }];
      expect(isAssetVisibleToUser(targets, true, viewer)).toBe(true);
      expect(isAssetVisibleToUser(targets, true, { ...viewer, classSubjectIds: ['cs-9'] })).toBe(false);
    });

    it('blocks a student from a staff-only (studentVisible: false) asset regardless of matching targets', () => {
      const targets = [{ targetKind: 'class_section' as const, targetRoleValue: null, targetRefId: 'sec-A' }];
      expect(isAssetVisibleToUser(targets, false, viewer)).toBe(false);
      expect(isAssetVisibleToUser(targets, false, { ...viewer, role: 'teacher' })).toBe(true);
    });
  });

  describe('Version numbering (AssetService.nextVersionNumberFromExisting)', () => {
    it('starts at 1 for a fresh asset with no versions', () => {
      expect(AssetService.nextVersionNumberFromExisting([])).toBe(1);
    });

    it('increments to one past the highest existing version number', () => {
      expect(AssetService.nextVersionNumberFromExisting([1, 2, 3])).toBe(4);
    });

    it('is simply max+1 even with a gap - no gap-filling behavior', () => {
      expect(AssetService.nextVersionNumberFromExisting([1, 3])).toBe(4);
    });
  });

  describe('Entitlement gating behavior', () => {
    it('verifies isActive returns false when isEnabled is false or expired', async () => {
      const { isActive } = await import('@/libs/api/entitlements');
      expect(isActive({ isEnabled: false, expiresAt: null })).toBe(false);
      expect(isActive({ isEnabled: true, expiresAt: new Date(Date.now() - 10000).toISOString() })).toBe(false);
      expect(isActive({ isEnabled: true, expiresAt: new Date(Date.now() + 10000).toISOString() })).toBe(true);
      expect(isActive({ isEnabled: true, expiresAt: null })).toBe(true);
    });
  });
});
