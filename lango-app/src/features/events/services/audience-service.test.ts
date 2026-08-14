import { describe, expect, it } from 'vitest';
import { isEventVisibleToUser, type EventTargetRow, type EventViewer } from './audience-service';

function viewer(overrides: Partial<EventViewer> = {}): EventViewer {
  return {
    userId: 'USR-001',
    role: 'student',
    sectionId: null,
    offeringIds: [],
    classSubjectIds: [],
    ...overrides,
  };
}

describe('isEventVisibleToUser', () => {
  it('is visible to everyone when there are no targets (untargeted/public event)', () => {
    expect(isEventVisibleToUser([], viewer())).toBe(true);
  });

  it('school-wide target is visible to any viewer', () => {
    const targets: EventTargetRow[] = [{ targetKind: 'school', targetRoleValue: null, targetRefId: null }];
    expect(isEventVisibleToUser(targets, viewer({ role: 'parent' }))).toBe(true);
  });

  it('role target matches only the same role', () => {
    const targets: EventTargetRow[] = [{ targetKind: 'role', targetRoleValue: 'teacher', targetRefId: null }];
    expect(isEventVisibleToUser(targets, viewer({ role: 'teacher' }))).toBe(true);
    expect(isEventVisibleToUser(targets, viewer({ role: 'student' }))).toBe(false);
  });

  it('user target matches only the exact invited user id', () => {
    const targets: EventTargetRow[] = [{ targetKind: 'user', targetRoleValue: null, targetRefId: 'USR-001' }];
    expect(isEventVisibleToUser(targets, viewer({ userId: 'USR-001' }))).toBe(true);
    expect(isEventVisibleToUser(targets, viewer({ userId: 'USR-002' }))).toBe(false);
  });

  it('class_section target requires the viewer to be enrolled in that exact section', () => {
    const targets: EventTargetRow[] = [{ targetKind: 'class_section', targetRoleValue: null, targetRefId: 'SEC-1' }];
    expect(isEventVisibleToUser(targets, viewer({ sectionId: 'SEC-1' }))).toBe(true);
    expect(isEventVisibleToUser(targets, viewer({ sectionId: 'SEC-2' }))).toBe(false);
    // A viewer with no resolved section (e.g. staff) never matches a section rule.
    expect(isEventVisibleToUser(targets, viewer({ sectionId: null }))).toBe(false);
  });

  it('class_offering target matches when the offering id is in the viewer offering list', () => {
    const targets: EventTargetRow[] = [{ targetKind: 'class_offering', targetRoleValue: null, targetRefId: 'OFF-9' }];
    expect(isEventVisibleToUser(targets, viewer({ offeringIds: ['OFF-1', 'OFF-9'] }))).toBe(true);
    expect(isEventVisibleToUser(targets, viewer({ offeringIds: ['OFF-1'] }))).toBe(false);
  });

  it('class_subject target matches when the subject id is in the viewer subject list', () => {
    const targets: EventTargetRow[] = [{ targetKind: 'class_subject', targetRoleValue: null, targetRefId: 'SUBJ-3' }];
    expect(isEventVisibleToUser(targets, viewer({ classSubjectIds: ['SUBJ-3'] }))).toBe(true);
    expect(isEventVisibleToUser(targets, viewer({ classSubjectIds: [] }))).toBe(false);
  });

  it('group target is not yet implemented and never matches (fails closed, not open)', () => {
    const targets: EventTargetRow[] = [{ targetKind: 'group', targetRoleValue: null, targetRefId: 'GRP-1' }];
    expect(isEventVisibleToUser(targets, viewer())).toBe(false);
  });

  it('is visible if ANY rule in a multi-rule set matches (OR semantics)', () => {
    const targets: EventTargetRow[] = [
      { targetKind: 'role', targetRoleValue: 'teacher', targetRefId: null },
      { targetKind: 'user', targetRoleValue: null, targetRefId: 'USR-007' },
    ];
    expect(isEventVisibleToUser(targets, viewer({ role: 'student', userId: 'USR-007' }))).toBe(true);
    expect(isEventVisibleToUser(targets, viewer({ role: 'student', userId: 'USR-008' }))).toBe(false);
  });
});
