import { describe, expect, it, vi } from 'vitest';
import {
  evaluateManualAuthorized,
  evaluateEnrollmentActive,
  evaluateAssessmentThreshold,
  evaluateAttendancePercentage,
  evaluateEventParticipation,
  evaluateHrEmployment,
} from '../services/evaluators';
import { db } from '@/libs/DB';

// Mock the database
vi.mock('@/libs/DB', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('Certificate Evaluators', () => {
  describe('evaluateManualAuthorized', () => {
    it('returns eligible when authorizedBy is provided', async () => {
      const result = await evaluateManualAuthorized('tenant1', 'recipient1', { authorizedBy: 'admin1' });
      expect(result.eligible).toBe(true);
      if (result.eligible) {
        expect(result.evidenceSnapshot.authorizedBy).toBe('admin1');
        expect(result.evidenceSnapshot.type).toBe('manual_authorized');
      }
    });

    it('returns ineligible when authorizedBy is missing', async () => {
      const result = await evaluateManualAuthorized('tenant1', 'recipient1', {});
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toContain('manquant');
      }
    });
  });

  describe('evaluateEnrollmentActive', () => {
    it('returns ineligible when classSectionId is missing', async () => {
      const result = await evaluateEnrollmentActive('tenant1', 'recipient1', {});
      expect(result.eligible).toBe(false);
    });

    it('returns ineligible when no placement is found', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      db.select = mockSelect as any;
      (db.select as any).mockImplementation(() => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: mockLimit
            })
          })
        })
      }));

      const result = await evaluateEnrollmentActive('tenant1', 'recipient1', { classSectionId: 'class1' });
      expect(result.eligible).toBe(false);
    });

    it('returns eligible when active placement is found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: 'placement1',
          status: 'enrolled',
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        }
      ]);

      (db.select as any).mockImplementation(() => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: mockLimit
            })
          })
        })
      }));

      const result = await evaluateEnrollmentActive('tenant1', 'recipient1', { classSectionId: 'class1' });
      expect(result.eligible).toBe(true);
      if (result.eligible) {
        expect(result.evidenceSnapshot.status).toBe('enrolled');
      }
    });
  });

  describe('evaluateAssessmentThreshold', () => {
    it('returns ineligible when missing rule params', async () => {
      const result = await evaluateAssessmentThreshold('t1', 'r1', {});
      expect(result.eligible).toBe(false);
    });

    it('returns ineligible when no outcome is found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockImplementation(() => ({
        from: () => ({ where: () => ({ limit: mockLimit }) })
      }));
      const result = await evaluateAssessmentThreshold('t1', 'r1', { assessmentDefinitionId: 'a1', minScore: 50 });
      expect(result.eligible).toBe(false);
    });

    it('returns eligible when score is above minimum', async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ id: 'out1', normalizedScore: '60' }]);
      (db.select as any).mockImplementation(() => ({
        from: () => ({ where: () => ({ limit: mockLimit }) })
      }));
      const result = await evaluateAssessmentThreshold('t1', 'r1', { assessmentDefinitionId: 'a1', minScore: 50 });
      expect(result.eligible).toBe(true);
    });
  });

  describe('evaluateAttendancePercentage', () => {
    it('returns ineligible when missing rule params', async () => {
      const result = await evaluateAttendancePercentage('t1', 'r1', {});
      expect(result.eligible).toBe(false);
    });

    it('returns eligible when percentage is met', async () => {
      const mockWhere = vi.fn().mockResolvedValue([
        { status: 'present' },
        { status: 'late' },
        { status: 'absent' },
        { status: 'present' }
      ]);
      (db.select as any).mockImplementation(() => ({
        from: () => ({ where: mockWhere })
      }));
      // 3 out of 4 = 75%
      const result = await evaluateAttendancePercentage('t1', 'r1', { studentGroupId: 'g1', minPercentage: 70 });
      expect(result.eligible).toBe(true);
      if (result.eligible) {
        expect(result.evidenceSnapshot.achievedPercentage).toBe(75);
      }
    });

    it('returns ineligible when percentage is not met', async () => {
      const mockWhere = vi.fn().mockResolvedValue([
        { status: 'present' },
        { status: 'absent' }
      ]);
      (db.select as any).mockImplementation(() => ({
        from: () => ({ where: mockWhere })
      }));
      // 1 out of 2 = 50%
      const result = await evaluateAttendancePercentage('t1', 'r1', { studentGroupId: 'g1', minPercentage: 70 });
      expect(result.eligible).toBe(false);
    });
  });

  describe('evaluateEventParticipation', () => {
    it('returns ineligible when eventName is missing', async () => {
      const result = await evaluateEventParticipation('t1', 'r1', {});
      expect(result.eligible).toBe(false);
    });

    it('returns eligible when status is attended', async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ id: 'r1', status: 'attended' }]);
      (db.select as any).mockImplementation(() => ({
        from: () => ({ where: () => ({ limit: mockLimit }) })
      }));
      const result = await evaluateEventParticipation('t1', 'r1', { eventName: 'e1' });
      expect(result.eligible).toBe(true);
    });

    it('returns ineligible when participant has not_going status', async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ id: 'r1', status: 'not_going' }]);
      (db.select as any).mockImplementation(() => ({
        from: () => ({ where: () => ({ limit: mockLimit }) })
      }));
      const result = await evaluateEventParticipation('t1', 'r1', { eventName: 'e1' });
      expect(result.eligible).toBe(false);
    });

    it('returns ineligible when no roster row is found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockImplementation(() => ({
        from: () => ({ where: () => ({ limit: mockLimit }) })
      }));
      const result = await evaluateEventParticipation('t1', 'r1', { eventName: 'e1' });
      expect(result.eligible).toBe(false);
    });
  });

  describe('evaluateHrEmployment', () => {
    it('always returns ineligible because employment cannot be verified', async () => {
      const result = await evaluateHrEmployment('t1', 'r1', {});
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toContain('Impossible de vérifier si l\'emploi est actif');
      }
    });
  });
});
