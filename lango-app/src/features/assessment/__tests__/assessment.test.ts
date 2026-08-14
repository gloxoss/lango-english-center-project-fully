import { describe, expect, it } from 'vitest';
import { doTimeRangesOverlap, planSeatAllocations } from '../services/exam-master-service';
import { isHomeworkVisibleToStudent } from '../services/homework-service';

// Real regression tests for the invariants a prior "100% verified" claim
// fabricated (future-implementation/assessment-and-examination remediation,
// section-05). Scope note, matching the discipline established for the
// advanced-reporting remediation earlier this session: this codebase has no
// existing pattern for DB-backed vitest tests, so mocking the entire `db`
// module (as the old version of this file did, asserting only
// `expect(Service).toBeDefined()`) produces false confidence, not real
// verification. Instead, the exact logic used by the real services is
// extracted into small pure functions (doTimeRangesOverlap,
// planSeatAllocations, isHomeworkVisibleToStudent) that the real methods
// call directly - there is no separate "test version" that could drift from
// the real one. The online-exam answer-ownership and deadline fixes
// (section-01) are DB-query-dependent and are verified live in section-06
// instead, against the real running app and database.

describe('Assessment & Examination System Invariants', () => {
  describe('Exam hall time-overlap conflict detection (the invariant a prior claim never actually tested)', () => {
    it('detects a genuine overlap', () => {
      expect(doTimeRangesOverlap('2026-02-16T09:00', '2026-02-16T11:00', '2026-02-16T10:00', '2026-02-16T12:00')).toBe(true);
    });

    it('detects an overlap where one range fully contains the other', () => {
      expect(doTimeRangesOverlap('2026-02-16T09:00', '2026-02-16T12:00', '2026-02-16T10:00', '2026-02-16T11:00')).toBe(true);
    });

    it('does not flag adjacent-but-non-overlapping ranges as a conflict', () => {
      expect(doTimeRangesOverlap('2026-02-16T09:00', '2026-02-16T11:00', '2026-02-16T12:00', '2026-02-16T14:00')).toBe(false);
    });

    it('does not flag genuinely separate ranges as a conflict', () => {
      expect(doTimeRangesOverlap('2026-02-16T09:00', '2026-02-16T10:00', '2026-02-17T09:00', '2026-02-17T10:00')).toBe(false);
    });
  });

  describe('Deterministic capacity-aware seat allocation', () => {
    it('fills halls in order without exceeding any hall\'s real capacity', () => {
      const halls = [{ id: 'h1', code: 'A1', capacity: 2 }, { id: 'h2', code: 'A2', capacity: 2 }];
      const { allocations, unallocatedCount } = planSeatAllocations(halls, ['s1', 's2', 's3']);

      expect(allocations).toHaveLength(3);
      expect(allocations.filter(a => a.hallId === 'h1')).toHaveLength(2);
      expect(allocations.filter(a => a.hallId === 'h2')).toHaveLength(1);
      expect(unallocatedCount).toBe(0);
    });

    it('never assigns a seat number beyond a hall\'s capacity', () => {
      const halls = [{ id: 'h1', code: 'A1', capacity: 1 }];
      const { allocations } = planSeatAllocations(halls, ['s1', 's2']);
      expect(allocations).toHaveLength(1);
      expect(allocations[0]!.seatNumber).toBe(1);
    });

    it('reports unallocated students honestly when total capacity is insufficient', () => {
      const halls = [{ id: 'h1', code: 'A1', capacity: 1 }];
      const { unallocatedCount } = planSeatAllocations(halls, ['s1', 's2', 's3']);
      expect(unallocatedCount).toBe(2);
    });
  });

  describe('Homework audience scoping (the fix for "every student saw every homework")', () => {
    it('shows a broadcast homework (no audience rows) to any student', () => {
      expect(isHomeworkVisibleToStudent([], { studentId: 'stu-1', sectionId: null, offeringIds: [] })).toBe(true);
    });

    it('shows a directly-targeted homework only to that student', () => {
      const audiences = [{ studentId: 'stu-1', sectionId: null, classOfferingId: null }];
      expect(isHomeworkVisibleToStudent(audiences, { studentId: 'stu-1', sectionId: null, offeringIds: [] })).toBe(true);
      expect(isHomeworkVisibleToStudent(audiences, { studentId: 'stu-2', sectionId: null, offeringIds: [] })).toBe(false);
    });

    it('shows a section-targeted homework to every student in that section, and no other', () => {
      const audiences = [{ studentId: null, sectionId: 'sec-A', classOfferingId: null }];
      expect(isHomeworkVisibleToStudent(audiences, { studentId: 'stu-1', sectionId: 'sec-A', offeringIds: [] })).toBe(true);
      expect(isHomeworkVisibleToStudent(audiences, { studentId: 'stu-2', sectionId: 'sec-B', offeringIds: [] })).toBe(false);
    });

    it('shows an offering-targeted homework to students enrolled in that offering', () => {
      const audiences = [{ studentId: null, sectionId: null, classOfferingId: 'off-1' }];
      expect(isHomeworkVisibleToStudent(audiences, { studentId: 'stu-1', sectionId: null, offeringIds: ['off-1', 'off-2'] })).toBe(true);
      expect(isHomeworkVisibleToStudent(audiences, { studentId: 'stu-2', sectionId: null, offeringIds: ['off-3'] })).toBe(false);
    });
  });
});
