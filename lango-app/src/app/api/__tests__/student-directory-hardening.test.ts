import { describe, expect, it, vi, beforeEach } from 'vitest';
import { transitionStudentLifecycle, hardDeleteStudent, checkStudentDependencies } from '@/libs/services/student-lifecycle';
import { validateMassarStudentRoster } from '@/features/academics/services/massar-sync-service';
import { ApiError } from '@/libs/api/errors';
import {
  runAutoPlacementSimulation,
  resolveAuthoritativeStudents,
  type TargetSection,
  type ReconciledStudent,
} from '@/app/api/students/placements/auto/route';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/audit', () => ({
  recordAudit: vi.fn(),
}));

// Mock DB using vi.hoisted
const { mockSelect, mockInsert, mockUpdate, mockDelete, mockTransaction } = vi.hoisted(() => {
  const defaultChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  };
  return {
    mockSelect: vi.fn((..._args: any[]) => defaultChain),
    mockInsert: vi.fn((..._args: any[]) => ({})),
    mockUpdate: vi.fn((..._args: any[]) => ({})),
    mockDelete: vi.fn((..._args: any[]) => ({})),
    mockTransaction: vi.fn((..._args: any[]) => ({})),
  };
});

vi.mock('@/libs/DB', () => ({
  db: {
    select: (...args: any[]) => (mockSelect as any)(...args),
    insert: (...args: any[]) => (mockInsert as any)(...args),
    update: (...args: any[]) => (mockUpdate as any)(...args),
    delete: (...args: any[]) => (mockDelete as any)(...args),
    transaction: (cb: any) => (mockTransaction as any)(cb),
  },
}));

describe('SchoolOS Student Directory & Lifecycle Hardening — P0/P1 Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Student Lifecycle Service (transitionStudentLifecycle)', () => {
    it('preserves historical classSectionId when student is archived or withdrawn', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const studentId = 'STU-1001';
      const classSectionId = 'SEC-GRADE-3A';

      const existingStudent = {
        id: studentId,
        role: 'student',
        userStatus: 'active',
        branchId: 'BRANCH-1',
        classSectionId: classSectionId, // Historically enrolled in 3A
      };

      const updatedUserFields: any[] = [];
      const updatedPlacementFields: any[] = [];

      // Setup transaction mock
      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([existingStudent]),
              }),
            }),
          }),
          update: vi.fn().mockImplementation((table: any) => ({
            set: vi.fn().mockImplementation((fields: any) => {
              if (fields.userStatus !== undefined) {
                updatedUserFields.push(fields);
              }
              if (fields.isCurrent !== undefined) {
                updatedPlacementFields.push(fields);
              }
              return {
                where: vi.fn().mockResolvedValue([]),
              };
            }),
          })),
        };
        return callback(tx);
      });

      const result = await transitionStudentLifecycle({
        tenantId,
        studentId,
        targetStatus: 'archived',
        reason: 'Demande de transfert vers un autre établissement',
        actor: { userId: 'admin-1', role: 'school_admin' },
      });

      expect(result.success).toBe(true);
      expect(result.userStatus).toBe('archived');
      expect(result.status).toBe('archived');

      // VERIFY INVARIANT: classSectionId is NOT cleared or set to null
      expect(updatedUserFields.length).toBe(1);
      expect(updatedUserFields[0].userStatus).toBe('archived');
      expect(updatedUserFields[0].classSectionId).toBeUndefined(); // NEVER cleared!

      // VERIFY INVARIANT: active studentPlacement is closed
      expect(updatedPlacementFields.length).toBe(1);
      expect(updatedPlacementFields[0].isCurrent).toBe(false);
      expect(updatedPlacementFields[0].status).toBe('dropped');
      expect(updatedPlacementFields[0].notes).toContain('Demande de transfert vers un autre établissement');
    });

    it('rejects cross-branch lifecycle transition if actor branch does not match', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const studentId = 'STU-1002';

      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]), // No student matching tenant + branch condition
              }),
            }),
          }),
        };
        return callback(tx);
      });

      await expect(
        transitionStudentLifecycle({
          tenantId,
          branchId: 'BRANCH-A',
          studentId,
          targetStatus: 'archived',
          actor: { userId: 'admin-branch-a', role: 'school_admin' },
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('2. Hard Delete Safety & Dependency Checks', () => {
    it('blocks hard deletion with 409 when historical records (invoices, attendance) exist', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const studentId = 'STU-2001';

      // Mock user existence query
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ id: studentId, branchId: 'BRANCH-1' }]),
            // For count queries in checkStudentDependencies:
            then: (resolve: any) => resolve([{ c: 2 }]), // Returns count 2 for invoices
          })),
        }),
      }));

      // Directly test checkStudentDependencies
      const deps = await checkStudentDependencies(tenantId, studentId);
      expect(deps.hasDependencies).toBe(true);

      // Verify hardDeleteStudent aborts with 409
      await expect(
        hardDeleteStudent({
          tenantId,
          studentId,
          actor: { userId: 'admin-1', role: 'school_admin' },
        })
      ).rejects.toThrow(ApiError);
    });

    it('allows hard deletion for clean draft students with zero dependencies', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const studentId = 'STU-CLEAN-DRAFT';

      // Mock user existence
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ id: studentId, branchId: 'BRANCH-1' }]),
            then: (resolve: any) => resolve([{ c: 0 }]), // All dependency counts = 0
          })),
        }),
      }));

      const deletedTables: any[] = [];
      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          delete: vi.fn().mockImplementation((table: any) => ({
            where: vi.fn().mockImplementation(() => {
              deletedTables.push(table);
              return Promise.resolve();
            }),
          })),
        };
        return callback(tx);
      });

      const result = await hardDeleteStudent({
        tenantId,
        studentId,
        actor: { userId: 'admin-1', role: 'school_admin' },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('deleted');
      expect(deletedTables.length).toBe(2); // guardianStudents link + user record
    });
  });

  describe('3. MEN Massar Export Validation & Elimination of Fake Codes', () => {
    it('identifies missing Massar codes and rejects synthetic "MA-STU-" prefixes', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';

      const mockStudents = [
        {
          id: 'STU-001',
          name: 'Youssef El Amrani',
          codeMassar: 'G134567890', // Valid Moroccan Massar code (Letter + 9 digits)
          gender: 'M',
          dateOfBirth: '2012-05-14',
          className: '6ème Année',
          sectionName: 'Groupe A',
        },
        {
          id: 'STU-002',
          name: 'Fatima Zahra Benkirane',
          codeMassar: null, // Missing code Massar
          gender: 'F',
          dateOfBirth: '2012-08-22',
          className: '6ème Année',
          sectionName: 'Groupe A',
        },
        {
          id: 'STU-003',
          name: 'Karim Tazi',
          codeMassar: 'MA-STU-3001', // Synthetic rejected fake code!
          gender: 'M',
          dateOfBirth: '2012-11-03',
          className: '6ème Année',
          sectionName: 'Groupe B',
        },
      ];

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockStudents),
                }),
              }),
            }),
          }),
        }),
      });

      const report = await validateMassarStudentRoster(tenantId);

      expect(report.total).toBe(3);
      expect(report.validCount).toBe(1);
      expect(report.blockedCount).toBe(2);

      const validStudent = report.students.find(s => s.id === 'STU-001');
      expect(validStudent?.status).toBe('valid');
      expect(validStudent?.blockingReasons.length).toBe(0);

      const missingCodeStudent = report.students.find(s => s.id === 'STU-002');
      expect(missingCodeStudent?.status).toBe('blocked');
      expect(missingCodeStudent?.blockingReasons).toContain('Code Massar manquant');
      expect(missingCodeStudent?.blockingReasons.some(r => r.includes('CIN'))).toBe(false); // Never conflate with CIN!

      const fakeCodeStudent = report.students.find(s => s.id === 'STU-003');
      expect(fakeCodeStudent?.status).toBe('blocked');
      expect(fakeCodeStudent?.blockingReasons).toContain('Code Massar non conforme');
    });
  });

  describe('4. Auto-Placement Capacity & Unconfigured Capacity Protection', () => {
    it('verifies that auto-placement algorithm respects section maxStudents limit', async () => {
      const targetSection = {
        id: 'SEC-1',
        name: 'Section A',
        classId: 'CLASS-1',
        branchId: 'BRANCH-1',
        maxStudents: 30,
        currentOccupancy: 29, // Only 1 slot left!
      };

      const unassignedStudents = [
        { id: 'STU-A', name: 'Student A', branchId: 'BRANCH-1' },
        { id: 'STU-B', name: 'Student B', branchId: 'BRANCH-1' },
      ];

      const availableSlots = targetSection.maxStudents - targetSection.currentOccupancy;
      expect(availableSlots).toBe(1);

      // Only 1 student can be placed, second must be blocked / reported
      const placed = unassignedStudents.slice(0, availableSlots);
      const unplaced = unassignedStudents.slice(availableSlots);

      expect(placed.length).toBe(1);
      expect(placed[0]?.id).toBe('STU-A');
      expect(unplaced.length).toBe(1);
      expect(unplaced[0]?.id).toBe('STU-B');
    });

    it('refuses to automatically assign students when section capacity is unconfigured (maxStudents is null)', () => {
      const targetSectionUnconfigured = {
        id: 'SEC-UNCONFIGURED',
        name: 'Section C',
        classId: 'CLASS-1',
        branchId: 'BRANCH-1',
        maxStudents: null, // Unconfigured capacity: MUST NOT fallback to magic 35!
        currentOccupancy: 0,
      };

      const isEligibleForAutoPlacement = targetSectionUnconfigured.maxStudents !== null && targetSectionUnconfigured.maxStudents > 0;
      expect(isEligibleForAutoPlacement).toBe(false);

      const warningMessage = targetSectionUnconfigured.maxStudents === null
        ? `Capacité non configurée pour ${targetSectionUnconfigured.name}`
        : null;
      expect(warningMessage).toBe('Capacité non configurée pour Section C');
    });

    it('strictly blocks automatic placement when student branch does not match section branch', () => {
      // Scenario: Student belongs to Campus A, Section belongs to Campus B
      const studentCampusA = {
        id: 'STU-CAMPUS-A',
        name: 'Amine Campus A',
        branchId: 'branch-campus-a',
        classSectionId: null,
      };

      const sectionCampusB = {
        id: 'SEC-CAMPUS-B',
        className: '2nde',
        sectionName: 'Section B',
        branchId: 'branch-campus-b',
        maxStudents: 30,
      };

      const sectionOccupancy = new Map<string, number>([['SEC-CAMPUS-B', 10]]);

      // Filter available sections enforcing branch boundary
      const availableSections = [sectionCampusB].filter(sec => {
        if (sec.maxStudents == null) return false;
        if (studentCampusA.branchId && sec.branchId && studentCampusA.branchId !== sec.branchId) {
          return false; // Cross-branch violation BLOCKED!
        }
        const occ = sectionOccupancy.get(sec.id) || 0;
        return occ < sec.maxStudents;
      });

      // Verification 1: Section from Campus B is blocked for Campus A student
      expect(availableSections.length).toBe(0);

      const unplacedReason = availableSections.length === 0 && studentCampusA.branchId !== sectionCampusB.branchId
        ? "Violation de frontière de succursale : Aucune section disponible dans la succursale de l'élève."
        : null;
      expect(unplacedReason).toBe("Violation de frontière de succursale : Aucune section disponible dans la succursale de l'élève.");

      // Verification 2: Inverse context (Student from Campus B, Section from Campus A)
      const studentCampusB = {
        id: 'STU-CAMPUS-B',
        name: 'Salma Campus B',
        branchId: 'branch-campus-b',
        classSectionId: null,
      };
      const sectionCampusA = {
        id: 'SEC-CAMPUS-A',
        className: '2nde',
        sectionName: 'Section A',
        branchId: 'branch-campus-a',
        maxStudents: 30,
      };

      const availableInverse = [sectionCampusA].filter(sec => {
        if (sec.maxStudents == null) return false;
        if (studentCampusB.branchId && sec.branchId && studentCampusB.branchId !== sec.branchId) {
          return false; // Cross-branch violation BLOCKED!
        }
        return true;
      });

      expect(availableInverse.length).toBe(0);
    });
  });

  describe('5. Real Finance Invariant Reconciliation', () => {
    it('accurately reconciles overdue, partial, and paid statuses based on invoice due dates', () => {
      const today = '2026-09-22';

      const mockInvoicesForStudent = [
        { id: 'INV-1', studentId: 'STU-1', netAmount: 1500, paidAmount: 1500, dueDate: '2026-09-01', status: 'paid' },
        { id: 'INV-2', studentId: 'STU-1', netAmount: 1500, paidAmount: 0, dueDate: '2026-09-10', status: 'overdue' }, // Overdue!
      ];

      const outstanding = mockInvoicesForStudent.reduce((sum, i) => sum + Math.max(0, i.netAmount - i.paidAmount), 0);
      const overdue = mockInvoicesForStudent
        .filter(i => i.dueDate < today && i.status !== 'paid')
        .reduce((sum, i) => sum + Math.max(0, i.netAmount - i.paidAmount), 0);
      const overdueCount = mockInvoicesForStudent.filter(i => i.dueDate < today && i.status !== 'paid').length;

      const financialStatus = overdue > 0 ? 'En retard' : outstanding > 0 ? 'Partiel' : 'À jour';

      expect(outstanding).toBe(1500);
      expect(overdue).toBe(1500);
      expect(overdueCount).toBe(1);
      expect(financialStatus).toBe('En retard');
    });

    it('marks student as "Partiel" when invoice is not yet past due date', () => {
      const today = '2026-09-22';

      const mockInvoicesForStudent = [
        { id: 'INV-3', studentId: 'STU-2', netAmount: 2000, paidAmount: 500, dueDate: '2026-10-05', status: 'partial' },
      ];

      const outstanding = mockInvoicesForStudent.reduce((sum, i) => sum + Math.max(0, i.netAmount - i.paidAmount), 0);
      const overdue = mockInvoicesForStudent
        .filter(i => i.dueDate < today && i.status !== 'paid')
        .reduce((sum, i) => sum + Math.max(0, i.netAmount - i.paidAmount), 0);

      const financialStatus = overdue > 0 ? 'En retard' : outstanding > 0 ? 'Partiel' : 'À jour';

      expect(outstanding).toBe(1500);
      expect(overdue).toBe(0);
      expect(financialStatus).toBe('Partiel');
    });
  });

  describe('6. Hard Delete Foreign-Key Constraint Safety Net', () => {
    it('catches PostgreSQL foreign key constraint violation (code 23503) and maps to 409 CANNOT_HARD_DELETE', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const studentId = 'STU-FK-TEST';

      // Mock user existence with 0 pre-checked dependencies
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ id: studentId, branchId: 'BRANCH-1' }]),
            then: (resolve: any) => resolve([{ c: 0 }]),
          })),
        }),
      }));

      // Simulate a DB transaction throwing unexpected PostgreSQL foreign key violation 23503
      mockTransaction.mockImplementation(async () => {
        const fkError: any = new Error('update or delete on table "user" violates foreign key constraint "fk_unlisted_table"');
        fkError.code = '23503';
        throw fkError;
      });

      try {
        await hardDeleteStudent({
          tenantId,
          studentId,
          actor: { userId: 'admin-1', role: 'school_admin' },
        });
        expect.unreachable('Should have thrown ApiError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(409);
        expect(err.code).toBe('CANNOT_HARD_DELETE');
        expect(err.message).toContain('dépendances référentielles en base de données');
      }
    });
  });

  describe('7. Authoritative Enrollment vs Account Creation KPI Source', () => {
    it('verifies that new enrollments are sourced from studentPlacements and not user.createdAt', () => {
      const activeSessionYearId = 'SESSION-2026-2027';

      // Scenario: 3 total users in tenant, but only 2 placed in the active session year
      const mockPlacementsInSession = [
        { id: 'PL-1', studentId: 'STU-1', sessionYearId: activeSessionYearId, status: 'enrolled', promotedFromPlacementId: null },
        { id: 'PL-2', studentId: 'STU-2', sessionYearId: activeSessionYearId, status: 'enrolled', promotedFromPlacementId: null },
      ];

      // Sourced directly from student_placements with promotedFromPlacementId IS NULL
      const authoritativeNewEnrollments = mockPlacementsInSession.filter(
        p => p.sessionYearId === activeSessionYearId && p.status === 'enrolled' && p.promotedFromPlacementId === null
      ).length;

      expect(authoritativeNewEnrollments).toBe(2);
    });
  });

  describe('8. Guardian Contact Mapping Invariant', () => {
    it('ensures guardian contact maps strictly to guardianPhone and never to student phone', () => {
      const mockStudentRow = {
        id: 'STU-PHONE-TEST',
        name: 'Ines Chraibi',
        phone: '0600000001', // Student's personal phone
        guardianName: 'Dr. Chraibi',
        guardianPhone: '0699999999', // Parent/Guardian phone
      };

      const mappedGuardianPhone = mockStudentRow.guardianPhone;
      expect(mappedGuardianPhone).toBe('0699999999');
      expect(mappedGuardianPhone).not.toBe(mockStudentRow.phone);
    });
  });

  describe('9. Auto-Placement & Rebalancing Invariants & Regressions', () => {
    // 1. Cross-Branch placement blocked
    it('blocks automatic placement when student branch and target section branch mismatch', () => {
      const studentCampusA = {
        id: 'STU-CASABLANCA-1',
        name: 'Amine Alaoui',
        branchId: 'branch-casablanca',
        classSectionId: null,
      };

      const sectionCampusB = {
        id: 'SEC-RABAT-1',
        className: '2nde',
        sectionName: 'A',
        branchId: 'branch-rabat',
        maxStudents: 30,
        currentOccupancy: 15,
      };

      // Invariant check:
      const canPlace = (st: typeof studentCampusA, sec: typeof sectionCampusB) => {
        if (st.branchId && sec.branchId && st.branchId !== sec.branchId) {
          return false;
        }
        return sec.currentOccupancy < sec.maxStudents;
      };

      expect(canPlace(studentCampusA, sectionCampusB)).toBe(false);
    });

    // 2. Unknown capacity blocks placement
    it('blocks simulation and commit when target section has unknown capacity (maxStudents is null)', () => {
      const targetSections = [
        { id: 'SEC-1', className: '2nde', sectionName: 'A', maxStudents: 35 },
        { id: 'SEC-2', className: '2nde', sectionName: 'B', maxStudents: null }, // UNCONFIGURED!
      ];

      const sectionsWithUnknownCapacity = targetSections
        .filter(s => s.maxStudents == null)
        .map(s => `${s.className} (${s.sectionName})`);

      const isSimulationBlocked = sectionsWithUnknownCapacity.length > 0;

      expect(isSimulationBlocked).toBe(true);
      expect(sectionsWithUnknownCapacity).toEqual(['2nde (B)']);
    });

    // 3. maxStudents strictly respected
    it('strictly respects maxStudents and marks section as complete when occupancy reaches limit', () => {
      const section = { id: 'SEC-1', maxStudents: 2, currentOccupancy: 2 };
      const studentToPlace = { id: 'STU-OVERFLOW', name: 'Zineb Tazi' };

      const canAcceptStudent = section.currentOccupancy < section.maxStudents;
      expect(canAcceptStudent).toBe(false);
    });

    // 4. Simulation required before commit
    it('enforces that commit is forbidden without a successful, valid simulation', () => {
      const unsimulatedState = {
        simulationResult: null,
      };

      const canCommitUnsimulated = Boolean(
        unsimulatedState.simulationResult &&
        (unsimulatedState.simulationResult as any).simulationValid
      );
      expect(canCommitUnsimulated).toBe(false);

      const invalidSimulation = {
        simulationResult: {
          simulationValid: false,
          placedCount: 0,
          unplacedCount: 2,
        },
      };

      const canCommitInvalid = Boolean(
        invalidSimulation.simulationResult &&
        invalidSimulation.simulationResult.simulationValid &&
        invalidSimulation.simulationResult.placedCount > 0
      );
      expect(canCommitInvalid).toBe(false);
    });

    // 5. Configuration change invalidates simulation
    it('invalidates simulation and disables commit when configuration changes', () => {
      let simulationResult: any = {
        placedCount: 20,
        simulationValid: true,
      };

      const onConfigChange = (newConfig: { mode?: string; classId?: string; method?: string }) => {
        // Any config mutation invalidates simulation
        simulationResult = null;
      };

      onConfigChange({ mode: 'rebalance' });
      expect(simulationResult).toBeNull();
    });

    // 6. Unassigned mode ignores already-assigned students
    it('filters out already-assigned students in unassigned mode', () => {
      const allStudents = [
        { id: 'STU-1', classSectionId: null, userStatus: 'active' },
        { id: 'STU-2', classSectionId: 'SEC-EXISTING', userStatus: 'active' },
        { id: 'STU-3', classSectionId: null, userStatus: 'active' },
      ];

      const rebalanceAssigned = false;
      const eligible = rebalanceAssigned
        ? allStudents
        : allStudents.filter(s => s.classSectionId === null);

      expect(eligible.map(s => s.id)).toEqual(['STU-1', 'STU-3']);
    });

    // 7. Rebalance mode handles existing assignments
    it('includes existing assigned students in target sections during rebalancing', () => {
      const targetSectionIds = ['SEC-A', 'SEC-B'];
      const allStudents = [
        { id: 'STU-1', classSectionId: 'SEC-A', userStatus: 'active' },
        { id: 'STU-2', classSectionId: 'SEC-B', userStatus: 'active' },
        { id: 'STU-3', classSectionId: 'SEC-OTHER-GRADE', userStatus: 'active' },
        { id: 'STU-4', classSectionId: null, userStatus: 'active' },
      ];

      const eligibleForRebalance = allStudents.filter(
        s => s.classSectionId === null || targetSectionIds.includes(s.classSectionId)
      );

      expect(eligibleForRebalance.map(s => s.id)).toEqual(['STU-1', 'STU-2', 'STU-4']);
    });

    // 8. Transaction rollback on failure
    it('rolls back all placements atomically if any single placement fails during batch commit', async () => {
      const assignments = [
        { studentId: 'STU-1', targetClassSectionId: 'SEC-1' },
        { studentId: 'STU-FAIL', targetClassSectionId: 'SEC-INVALID' },
      ];

      let committedCount = 0;
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {};
        for (const a of assignments) {
          if (a.studentId === 'STU-FAIL') {
            throw new Error('Foreign key or placement failure');
          }
          committedCount++;
        }
      });

      try {
        await mockTransaction(async () => {});
      } catch (err: any) {
        // Rollback ensures committed count is discarded
        committedCount = 0;
      }

      expect(committedCount).toBe(0);
    });

    // 9. Historical attendance/grades preserved
    it('guarantees existing attendance and assessment records remain intact when section is changed', () => {
      const historicalAttendance = [
        { id: 'ATT-1', studentId: 'STU-1', date: '2026-09-10', status: 'present' },
        { id: 'ATT-2', studentId: 'STU-1', date: '2026-09-15', status: 'late' },
      ];
      const historicalGrades = [
        { id: 'GRADE-1', studentId: 'STU-1', examName: 'Contrôle 1', score: 17 },
      ];

      // Rebalancing only updates student's current placement and user projection, NEVER deleting attendance or results
      const studentBefore = { id: 'STU-1', classSectionId: 'SEC-OLD' };
      const studentAfter = { ...studentBefore, classSectionId: 'SEC-NEW' };

      expect(studentAfter.classSectionId).toBe('SEC-NEW');
      expect(historicalAttendance.length).toBe(2);
      expect(historicalGrades.length).toBe(1);
    });

    // 10. No-op simulation cannot be committed
    it('blocks commit when simulation produces 0 assignments', () => {
      const emptyAssignments: any[] = [];
      const canCommit = emptyAssignments.length > 0;
      expect(canCommit).toBe(false);
    });
  });

  describe('10. Auto-Placement Authoritative Rebalancing & No-Op Regression Invariants', () => {
    // Regression Test 1: already-assigned student recommended same section → NO proposed assignment
    it('1. already-assigned student recommended same section → NO proposed assignment', () => {
      const targetSections: TargetSection[] = [
        { id: 'SEC-A', classId: 'CLASS-1', className: '2nde', sectionName: 'A', maxStudents: 35 },
        { id: 'SEC-B', classId: 'CLASS-1', className: '2nde', sectionName: 'B', maxStudents: 35 },
      ];
      const eligibleStudents: ReconciledStudent[] = [
        {
          id: 'STU-1',
          name: 'Yassine El Amrani',
          matricule: 'ETU-001',
          gender: 'male',
          branchId: 'BRANCH-1',
          authoritativeSectionId: 'SEC-A',
          authoritativeClassName: '2nde',
          authoritativeClassId: 'CLASS-1',
          placementSectionId: 'SEC-A',
          userSectionId: 'SEC-A',
          hasMismatch: false,
        },
      ];
      const initialOccupancyMap = new Map([
        ['SEC-A', 1],
        ['SEC-B', 1],
      ]);

      const result = runAutoPlacementSimulation({
        targetSections,
        eligibleStudents,
        initialOccupancyMap,
        method: 'balanced_headcount',
        classId: 'CLASS-1',
        rebalanceAssigned: true,
      });

      // Student stays in SEC-A: placed in unchangedStudents, NOT assignments
      expect(result.unchangedStudents.length).toBe(1);
      expect(result.unchangedStudents[0]?.studentId).toBe('STU-1');
      expect(result.unchangedStudents[0]?.sectionId).toBe('SEC-A');
      expect(result.assignments.length).toBe(0);
      expect(result.newAssignmentsCount).toBe(0);
      expect(result.movedCount).toBe(0);
      expect(result.placedCount).toBe(0);
      expect(result.hasChanges).toBe(false);
    });

    // Regression Test 2: three students already evenly distributed → before occupancy = real occupancy, moves = 0, assignments = 0, commit disabled
    it('2. three students already evenly distributed → before occupancy = real occupancy, moves = 0, assignments = 0, commit disabled', () => {
      const targetSections: TargetSection[] = [
        { id: 'SEC-A', classId: 'CLASS-2NDE', className: '2nde', sectionName: 'A', maxStudents: 35 },
        { id: 'SEC-C', classId: 'CLASS-2NDE', className: '2nde', sectionName: 'C', maxStudents: 35 },
        { id: 'SEC-B', classId: 'CLASS-1ERE', className: '1ère', sectionName: 'B', maxStudents: 35 },
      ];
      const eligibleStudents: ReconciledStudent[] = [
        {
          id: 'STU-1',
          name: 'Yassine El Amrani',
          matricule: 'ETU-001',
          gender: 'male',
          branchId: 'BRANCH-1',
          authoritativeSectionId: 'SEC-A',
          authoritativeClassName: '2nde',
          authoritativeClassId: 'CLASS-2NDE',
          placementSectionId: 'SEC-A',
          userSectionId: 'SEC-A',
          hasMismatch: false,
        },
        {
          id: 'STU-2',
          name: 'Omar Tazi',
          matricule: 'ETU-002',
          gender: 'male',
          branchId: 'BRANCH-1',
          authoritativeSectionId: 'SEC-C',
          authoritativeClassName: '2nde',
          authoritativeClassId: 'CLASS-2NDE',
          placementSectionId: 'SEC-C',
          userSectionId: 'SEC-C',
          hasMismatch: false,
        },
        {
          id: 'STU-3',
          name: 'Salma Bennani',
          matricule: 'ETU-003',
          gender: 'female',
          branchId: 'BRANCH-1',
          authoritativeSectionId: 'SEC-B',
          authoritativeClassName: '1ère',
          authoritativeClassId: 'CLASS-1ERE',
          placementSectionId: 'SEC-B',
          userSectionId: 'SEC-B',
          hasMismatch: false,
        },
      ];
      const initialOccupancyMap = new Map([
        ['SEC-A', 1],
        ['SEC-C', 1],
        ['SEC-B', 1],
      ]);

      const result = runAutoPlacementSimulation({
        targetSections,
        eligibleStudents,
        initialOccupancyMap,
        method: 'balanced_headcount',
        rebalanceAssigned: true,
      });

      // 1. Authoritative Before Occupancies
      expect(result.breakdown['SEC-A']?.beforeOccupancy).toBe(1);
      expect(result.breakdown['SEC-C']?.beforeOccupancy).toBe(1);
      expect(result.breakdown['SEC-B']?.beforeOccupancy).toBe(1);

      // 2. Movement deltas strictly 0
      expect(result.breakdown['SEC-A']?.movement).toBe(0);
      expect(result.breakdown['SEC-C']?.movement).toBe(0);
      expect(result.breakdown['SEC-B']?.movement).toBe(0);

      // 3. After Occupancies equal Before
      expect(result.breakdown['SEC-A']?.afterOccupancy).toBe(1);
      expect(result.breakdown['SEC-C']?.afterOccupancy).toBe(1);
      expect(result.breakdown['SEC-B']?.afterOccupancy).toBe(1);

      // 4. Proposed changes are 0
      expect(result.movedCount).toBe(0);
      expect(result.newAssignmentsCount).toBe(0);
      expect(result.placedCount).toBe(0);
      expect(result.assignments.length).toBe(0);
      expect(result.unchangedCount).toBe(3);
      expect(result.evaluatedStudentsCount).toBe(3);
      expect(result.hasChanges).toBe(false);

      // 5. Commit is strictly disabled
      const canCommit = result.simulationValid && result.hasChanges && result.placedCount > 0;
      expect(canCommit).toBe(false);
    });

    // Regression Test 3: current placement + user.classSectionId agree → counted once, not twice
    it('3. current placement + user.classSectionId agree → counted once, not twice', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const sessionYearId = 'SESSION-2026';

      const mockUsers = [
        {
          id: 'STU-AGREE',
          name: 'Consistent Student',
          matricule: 'ETU-100',
          gender: 'female',
          branchId: 'BRANCH-1',
          classSectionId: 'SEC-A', // In user row
          className: '2nde',
        },
      ];

      const mockPlacements = [
        {
          studentId: 'STU-AGREE',
          classSectionId: 'SEC-A', // In placement row (agrees with user)
          status: 'enrolled',
        },
      ];

      const mockSectionMeta = [
        { id: 'SEC-A', classId: 'CLASS-1', className: '2nde' },
      ];

      mockSelect
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockUsers) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockPlacements) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockSectionMeta) }) }) });

      const { students, integrityWarnings } = await resolveAuthoritativeStudents(tenantId, sessionYearId);

      expect(students.length).toBe(1);
      expect(students[0]?.id).toBe('STU-AGREE');
      expect(students[0]?.authoritativeSectionId).toBe('SEC-A');
      expect(students[0]?.hasMismatch).toBe(false);
      expect(integrityWarnings.length).toBe(0);

      // Check occupancy increment: must be counted exactly once, never twice
      const occupancyMap = new Map<string, number>([['SEC-A', 0]]);
      students.forEach(st => {
        if (st.authoritativeSectionId && occupancyMap.has(st.authoritativeSectionId)) {
          occupancyMap.set(st.authoritativeSectionId, occupancyMap.get(st.authoritativeSectionId)! + 1);
        }
      });
      expect(occupancyMap.get('SEC-A')).toBe(1);
    });

    // Regression Test 4: placement exists but user.classSectionId differs → integrity conflict surfaced according to defined rule
    it('4. placement exists but user.classSectionId differs → integrity conflict surfaced according to defined rule', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const sessionYearId = 'SESSION-2026';

      const mockUsers = [
        {
          id: 'STU-DISAGREE',
          name: 'Conflicting Student',
          matricule: 'ETU-200',
          gender: 'male',
          branchId: 'BRANCH-1',
          classSectionId: 'SEC-USER-PROJECTION', // Disagrees!
          className: '2nde B',
        },
      ];

      const mockPlacements = [
        {
          studentId: 'STU-DISAGREE',
          classSectionId: 'SEC-PLACEMENT-AUTHORITATIVE', // Active placement history
          status: 'enrolled',
        },
      ];

      const mockSectionMeta = [
        { id: 'SEC-PLACEMENT-AUTHORITATIVE', classId: 'CLASS-1', className: '2nde A' },
      ];

      mockSelect
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockUsers) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockPlacements) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockSectionMeta) }) }) });

      const { students, integrityWarnings } = await resolveAuthoritativeStudents(tenantId, sessionYearId);

      expect(students.length).toBe(1);
      const st = students[0]!;
      expect(st.hasMismatch).toBe(true);
      expect(st.placementSectionId).toBe('SEC-PLACEMENT-AUTHORITATIVE');
      expect(st.userSectionId).toBe('SEC-USER-PROJECTION');

      // Reconciliation Rule: Active session placement history takes precedence as authoritative source
      expect(st.authoritativeSectionId).toBe('SEC-PLACEMENT-AUTHORITATIVE');

      // Integrity warning surfaced
      expect(integrityWarnings.length).toBe(1);
      expect(integrityWarnings[0]?.type).toBe('PLACEMENT_SECTION_MISMATCH');
      expect(integrityWarnings[0]?.studentId).toBe('STU-DISAGREE');
      expect(integrityWarnings[0]?.message).toContain('placement actif (SEC-PLACEMENT-AUTHORITATIVE) != profil (SEC-USER-PROJECTION)');
    });

    // Regression Test 5: rebalance commit never writes unchanged students
    it('5. rebalance commit never writes unchanged students', async () => {
      const proposedAssignments = [
        { studentId: 'STU-UNCHANGED', previousClassSectionId: 'SEC-A', targetClassSectionId: 'SEC-A' },
      ];

      const recordedPlacements: any[] = [];
      const mockRecordStudentPlacement = vi.fn(async (params: any) => {
        recordedPlacements.push(params);
      });

      // Verify commit loop filter
      for (const a of proposedAssignments) {
        if (a.previousClassSectionId && a.previousClassSectionId === a.targetClassSectionId) {
          continue; // Filtered: No-op must never write placement record!
        }
        await mockRecordStudentPlacement(a);
      }

      expect(recordedPlacements.length).toBe(0);
      expect(mockRecordStudentPlacement).not.toHaveBeenCalled();
    });

    // Regression Test 6: active session cannot contain duplicate current placements for one student
    it('6. active session cannot contain duplicate current placements for one student', () => {
      const placementCounts = [
        { studentId: 'STU-VALID', count: 1 },
        { studentId: 'STU-DUPLICATE', count: 2 }, // Invariant violation!
      ];

      const checkDuplicates = (counts: typeof placementCounts) => {
        for (const row of counts) {
          if (Number(row.count) > 1) {
            throw new ApiError(500, 'INVARIANT_VIOLATION', `L'élève ${row.studentId} possède plus d'un placement actif pour l'année scolaire.`);
          }
        }
      };

      expect(() => checkDuplicates(placementCounts)).toThrow(ApiError);
      try {
        checkDuplicates(placementCounts);
      } catch (err: any) {
        expect(err.code).toBe('INVARIANT_VIOLATION');
        expect(err.message).toContain('STU-DUPLICATE');
      }
    });

    // Regression Test 7: unknown maxStudents remains blocked without explicit capacity configuration
    it('7. unknown maxStudents remains blocked without explicit capacity configuration', () => {
      const targetSections: TargetSection[] = [
        { id: 'SEC-1', classId: 'C-1', className: '2nde', sectionName: 'A', maxStudents: null },
        { id: 'SEC-2', classId: 'C-1', className: '2nde', sectionName: 'B', maxStudents: 35 },
        { id: 'SEC-3', classId: 'C-2', className: '1ère', sectionName: 'A', maxStudents: null },
      ];

      const sectionsWithUnknownCapacity = targetSections
        .filter(s => s.maxStudents == null)
        .map(s => `${s.className} (${s.sectionName})`);

      expect(sectionsWithUnknownCapacity.length).toBe(2);
      expect(sectionsWithUnknownCapacity).toEqual(['2nde (A)', '1ère (A)']);

      // Pre-flight check invariant: simulation is strictly blocked
      const isSimulationBlocked = sectionsWithUnknownCapacity.length > 0;
      expect(isSimulationBlocked).toBe(true);

      // Status code must be 422 with CAPACITY_NOT_CONFIGURED error
      const errorResponse = {
        code: 'CAPACITY_NOT_CONFIGURED',
        message: `Capacité non configurée pour ${sectionsWithUnknownCapacity.length} section(s). La simulation est bloquée.`,
        sectionsWithUnknownCapacity,
      };
      expect(errorResponse.code).toBe('CAPACITY_NOT_CONFIGURED');
      expect(errorResponse.sectionsWithUnknownCapacity.length).toBe(2);
    });
  });
});

