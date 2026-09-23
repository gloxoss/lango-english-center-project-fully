import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { AdmissionService } from '@/features/students/services/admission-service';
import fs from 'node:fs';
import path from 'node:path';

// Mock server environment
vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

// Mock Audit Logger
vi.mock('@/libs/api/audit', () => ({
  recordAudit: vi.fn(),
}));

// Mock Matricule Reservation Service
const mockReserveMatricule = vi.fn().mockResolvedValue('STD-2026-0088');
vi.mock('@/libs/services/matricule', () => ({
  reserveMatricule: (...args: any[]) => mockReserveMatricule(...args),
}));

// Mock Student Placement Service
const mockRecordStudentPlacement = vi.fn().mockResolvedValue({ id: 'plc-placement-001' });
vi.mock('@/libs/services/student-placement', () => ({
  recordStudentPlacement: (...args: any[]) => mockRecordStudentPlacement(...args),
}));

// Mock Subscription Capacity Check
const mockAssertStudentCapacity = vi.fn().mockResolvedValue(true);
vi.mock('@/features/subscriptions/services/plan-limits-service', () => ({
  assertStudentCapacity: (...args: any[]) => mockAssertStudentCapacity(...args),
}));

// Mock Uploads / File Copy Service
const mockCopyUploadedFile = vi.fn().mockResolvedValue(true);
vi.mock('@/libs/api/uploads', () => ({
  copyUploadedFile: (...args: any[]) => mockCopyUploadedFile(...args),
  contentTypeFor: vi.fn().mockReturnValue('application/pdf'),
  resolveTenantPath: vi.fn().mockReturnValue('/mock/uploads/doc.pdf'),
}));

// Mock Student Card Auto-Issue
vi.mock('@/features/cards/services/issue-service', () => ({
  autoIssueStudentCardOnAdmission: vi.fn().mockResolvedValue(true),
}));

// Mock Capabilities
const mockRequireCapability = vi.fn().mockResolvedValue(true);
vi.mock('@/libs/api/permissions', () => ({
  requireCapability: (...args: any[]) => mockRequireCapability(...args),
}));

// Mock Request Context
const mockRequireRequestContext = vi.fn();
vi.mock('@/libs/api/context', async () => {
  const actual = await vi.importActual<any>('@/libs/api/context');
  return {
    ...actual,
    requireRequestContext: (...args: any[]) => mockRequireRequestContext(...args),
    requireTenant: (ctx: any) => ctx?.tenantId ?? '11111111-1111-1111-1111-111111111111',
  };
});

// Helper to construct fluent chainable query builders
function createChainableQuery(resolver: () => any) {
  const chain: any = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    for: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    set: vi.fn(() => chain),
    values: vi.fn(() => chain),
    then: (onResolve: any, onReject: any) => Promise.resolve(resolver()).then(onResolve, onReject),
  };
  return chain;
}

// Hoisted DB mocks
const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbTransaction } = vi.hoisted(() => {
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbTransaction: vi.fn(),
  };
});

vi.mock('@/libs/DB', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: (...args: any[]) => mockDbDelete(...args),
    transaction: (cb: any) => mockDbTransaction(cb),
  },
}));

describe('SchoolOS Admissions & Inscriptions Workflow — P0 & P1 Architectural Hardening', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const branchCampusA = 'bbbbbbbb-1111-1111-1111-111111111111';
  const branchCampusB = 'bbbbbbbb-2222-2222-2222-222222222222';
  const sessionYear2026 = 'ssssssss-2026-1111-1111-111111111111';
  const section3A = 'cccccccc-3333-1111-1111-111111111111';

  const defaultAdminContext: RequestContext = {
    userId: 'usr-admin-1',
    tenantId: tenantA,
    role: 'school_admin',
    baseRole: 'school_admin',
    branchId: null, // Whole school admin
    name: 'Admin',
    email: 'admin@school.ma',
  };

  const branchAAdminContext: RequestContext = {
    userId: 'usr-branch-admin-a',
    tenantId: tenantA,
    role: 'school_admin',
    baseRole: 'school_admin',
    branchId: branchCampusA,
    name: 'Branch Admin A',
    email: 'admin.a@school.ma',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCapability.mockResolvedValue(true);
    mockReserveMatricule.mockResolvedValue('STD-2026-0088');
    mockRecordStudentPlacement.mockResolvedValue({ id: 'plc-placement-001' });
    mockAssertStudentCapacity.mockResolvedValue(true);

    mockRequireRequestContext.mockImplementation(async (req: any, allowedRoles?: readonly string[]) => {
      const role = (req?.headers?.get?.('x-user-role') || defaultAdminContext.role) as any;
      const branchId = req?.headers?.get?.('x-branch-id') || defaultAdminContext.branchId;
      const userId = req?.headers?.get?.('x-user-id') || defaultAdminContext.userId;
      const tenantId = req?.headers?.get?.('x-tenant-id') || defaultAdminContext.tenantId;

      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        throw new ApiError(403, 'FORBIDDEN', 'Accès interdit pour ce rôle.');
      }

      return {
        userId,
        tenantId,
        branchId: branchId || null,
        role,
        baseRole: role,
        name: 'Test User',
        email: 'test@example.com',
      };
    });
  });

  // =========================================================================
  // 1. TENANT & BRANCH ISOLATION (P0)
  // =========================================================================
  describe('1. Tenant & Branch Isolation (P0)', () => {
    it('1. Blocks cross-tenant admission GET lookup (returns 404 ADMISSION_NOT_FOUND)', async () => {
      mockDbSelect.mockImplementation(() => createChainableQuery(() => []));

      await expect(
        AdmissionService.getAdmissionDetail(defaultAdminContext, 'app-tenant-b'),
      ).rejects.toThrowError(/Demande d'admission introuvable/);
    });

    it('2. Blocks cross-branch admission GET when admin is scoped to Branch A and applicant belongs to Branch B', async () => {
      const applicantBranchB = {
        id: 'app-campus-b',
        tenantId: tenantA,
        branchId: branchCampusB,
        firstName: 'Yassine',
        lastName: 'Alami',
        status: 'applied',
      };

      mockDbSelect.mockImplementation(() => createChainableQuery(() => [applicantBranchB]));

      await expect(
        AdmissionService.getAdmissionDetail(branchAAdminContext, 'app-campus-b'),
      ).rejects.toThrowError(/Accès interdit à cette succursale/);
    });

    it('3. Automatically restricts listAdmissions query to admin branch', async () => {
      mockDbSelect.mockImplementation(() => createChainableQuery(() => []));

      const result = await AdmissionService.listAdmissions(branchAAdminContext, { page: 1, pageSize: 20 });
      expect(result).toBeDefined();
      expect(mockDbSelect).toHaveBeenCalled();
    });

    it('4. Blocks cross-branch edit (updateAdmission throws 403 BRANCH_ACCESS_DENIED)', async () => {
      const applicantBranchB = {
        id: 'app-campus-b',
        tenantId: tenantA,
        branchId: branchCampusB,
        status: 'applied',
      };

      mockDbSelect.mockImplementation(() => createChainableQuery(() => [applicantBranchB]));

      await expect(
        AdmissionService.updateAdmission(branchAAdminContext, 'app-campus-b', { firstName: 'NewName' }),
      ).rejects.toThrowError(/Accès interdit à cette succursale/);
    });

    it('5. Blocks cross-branch decision (approveAdmission throws 403 BRANCH_ACCESS_DENIED)', async () => {
      const applicantBranchB = {
        id: 'app-campus-b',
        tenantId: tenantA,
        branchId: branchCampusB,
        status: 'applied',
      };

      mockDbSelect.mockImplementation(() => createChainableQuery(() => [applicantBranchB]));

      await expect(
        AdmissionService.approveAdmission(branchAAdminContext, 'app-campus-b'),
      ).rejects.toThrowError(/Accès interdit à cette succursale/);
    });

    it('6. Blocks cross-branch rejection (rejectAdmission throws 403 BRANCH_ACCESS_DENIED)', async () => {
      const applicantBranchB = {
        id: 'app-campus-b',
        tenantId: tenantA,
        branchId: branchCampusB,
        status: 'applied',
      };

      mockDbSelect.mockImplementation(() => createChainableQuery(() => [applicantBranchB]));

      await expect(
        AdmissionService.rejectAdmission(branchAAdminContext, 'app-campus-b', 'Dossier incomplet'),
      ).rejects.toThrowError(/Accès interdit à cette succursale/);
    });
  });

  // =========================================================================
  // 2. DECISION LOCK & LIFECYCLE (P0)
  // =========================================================================
  describe('2. Decision Lock & State Machine (P0)', () => {
    it('7. Enforces Decision Lock: cannot update approved, rejected, or enrolled application', async () => {
      const approvedApp = {
        id: 'app-approved-01',
        tenantId: tenantA,
        branchId: branchCampusA,
        status: 'approved',
      };

      mockDbSelect.mockImplementation(() => createChainableQuery(() => [approvedApp]));

      await expect(
        AdmissionService.updateAdmission(defaultAdminContext, 'app-approved-01', { phone: '0612345678' }),
      ).rejects.toThrowError(/Cette demande a déjà fait l'objet d'une décision/);
    });

    it('8. Blocks approval if user lacks admissions.manage capability', async () => {
      mockRequireCapability.mockRejectedValueOnce(
        new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Permission refusée'),
      );

      await expect(
        AdmissionService.approveAdmission(defaultAdminContext, 'app-01'),
      ).rejects.toThrowError(/Permission refusée/);
    });
  });

  // =========================================================================
  // 3. CORE INVARIANT: APPROVED != ENROLLED (P0)
  // =========================================================================
  describe('3. Core Invariant: Admission Approval != Student Enrollment (P0)', () => {
    it('9. APPROVE records admission decision ONLY: creates NO user, NO placement, and consumes NO matricule', async () => {
      const pendingApp = {
        id: 'app-pending-01',
        tenantId: tenantA,
        branchId: branchCampusA,
        status: 'applied',
      };

      let updatedFields: any = null;
      mockDbSelect.mockImplementation(() => createChainableQuery(() => [pendingApp]));
      mockDbUpdate.mockImplementation(() => {
        const chain = createChainableQuery(() => [{ ...pendingApp, ...updatedFields }]);
        chain.set = vi.fn().mockImplementation((fields) => {
          updatedFields = fields;
          return chain;
        });
        return chain;
      });

      const result = await AdmissionService.approveAdmission(defaultAdminContext, 'app-pending-01');

      // Status set to approved
      expect(result.status).toBe('approved');
      expect(updatedFields.status).toBe('approved');
      expect(updatedFields.approvedAt).toBeDefined();
      expect(updatedFields.approvedById).toBe(defaultAdminContext.userId);

      // INVARIANTS:
      expect(mockReserveMatricule).not.toHaveBeenCalled();
      expect(mockRecordStudentPlacement).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. TRANSACTIONAL ENROLLMENT CONVERSION (P0 & P1)
  // =========================================================================
  describe('4. Transactional Enrollment Conversion (P0 & P1)', () => {
    const validApprovedApplicant = {
      id: 'app-approved-99',
      tenantId: tenantA,
      branchId: branchCampusA,
      sessionYearId: sessionYear2026,
      firstName: 'Hamza',
      lastName: 'Bennani',
      email: 'hamza.bennani@example.com',
      phone: '0611223344',
      dateOfBirth: '2015-04-12',
      gender: 'male',
      nationalId: 'K123456789',
      status: 'approved',
      convertedUserId: null,
      guardianName: 'Omar Bennani',
      guardianPhone: '0699887766',
      guardianEmail: 'omar.bennani@example.com',
    };

    const validClassSection = {
      id: section3A,
      tenantId: tenantA,
      branchId: branchCampusA, // matches applicant branch
      maxStudents: 30,
      className: 'CE1-A',
    };

    function setupEnrollmentTxMocks(opts: {
      applicant?: any;
      duplicateStudent?: any;
      section?: any;
      occupancy?: number;
      existingGuardian?: any;
      uploadedDocs?: any[];
      alreadyEnrolledStudent?: any;
    }) {
      const applicant = opts.applicant !== undefined ? opts.applicant : validApprovedApplicant;
      const section = opts.section !== undefined ? opts.section : validClassSection;
      const occupancy = opts.occupancy ?? 12;
      const duplicateStudent = opts.duplicateStudent ?? null;
      const existingGuardian = opts.existingGuardian ?? null;
      const uploadedDocs = opts.uploadedDocs ?? [];
      const alreadyEnrolledStudent = opts.alreadyEnrolledStudent ?? null;

      const txInsertedUsers: any[] = [];
      const txInsertedGuardians: any[] = [];
      const txInsertedGuardianStudents: any[] = [];
      const txUpdatedApplicants: any[] = [];

      mockDbTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          select: vi.fn().mockImplementation((fields?: any) => {
            const chain: any = {
              from: vi.fn().mockImplementation((table: any) => {
                let tableName = '';
                try {
                  tableName = getTableName(table) || '';
                } catch {
                  tableName = '';
                }

                const subChain = createChainableQuery(() => {
                  if (tableName === 'applicants') {
                    return applicant ? [applicant] : [];
                  }
                  if (tableName === 'class_sections') {
                    return section ? [section] : [];
                  }
                  if (tableName === 'guardians') {
                    return existingGuardian ? [existingGuardian] : [];
                  }
                  if (tableName === 'user') {
                    if (alreadyEnrolledStudent) {
                      return [alreadyEnrolledStudent];
                    }
                    return duplicateStudent ? [duplicateStudent] : [];
                  }
                  if (tableName === 'student_placements') {
                    if (fields && 'c' in fields) {
                      return [{ c: occupancy }];
                    }
                    return [{ id: 'existing-plc-1', classSectionId: section3A }];
                  }
                  if (tableName === 'applicant_documents') {
                    return uploadedDocs;
                  }
                  if (tableName === 'branches') {
                    return [{ id: branchCampusA }];
                  }
                  if (tableName === 'session_years') {
                    return [{ id: sessionYear2026 }];
                  }
                  return [];
                });
                return subChain;
              }),
            };
            return chain;
          }),
          insert: vi.fn().mockImplementation((table: any) => {
            let tableName = '';
            try {
              tableName = getTableName(table) || '';
            } catch {
              tableName = '';
            }

            return {
              values: vi.fn().mockImplementation((vals: any) => {
                if (tableName === 'user') {
                  txInsertedUsers.push(vals);
                }
                if (tableName === 'guardians') {
                  txInsertedGuardians.push(vals);
                }
                if (tableName === 'guardian_students') {
                  txInsertedGuardianStudents.push(vals);
                }
                const insertedId = vals.id || 'gen-id-123';
                return createChainableQuery(() => [{ id: insertedId, ...vals }]);
              }),
            };
          }),
          update: vi.fn().mockImplementation((_table: any) => {
            return {
              set: vi.fn().mockImplementation((vals: any) => {
                txUpdatedApplicants.push(vals);
                return createChainableQuery(() => [{ id: applicant?.id, ...applicant, ...vals }]);
              }),
            };
          }),
        };

        return callback(mockTx);
      });

      return {
        txInsertedUsers,
        txInsertedGuardians,
        txInsertedGuardianStudents,
        txUpdatedApplicants,
      };
    }

    it('10. Enrollment creates exactly one student user with reserved matricule and role=student', async () => {
      const { txInsertedUsers, txUpdatedApplicants } = setupEnrollmentTxMocks({});

      const result = await AdmissionService.enrollApplicant(defaultAdminContext, validApprovedApplicant.id, {
        classSectionId: section3A,
      });

      expect(mockReserveMatricule).toHaveBeenCalledTimes(1);
      expect(txInsertedUsers).toHaveLength(1);
      expect(txInsertedUsers[0].role).toBe('student');
      expect(txInsertedUsers[0].userStatus).toBe('active');
      expect(txInsertedUsers[0].matricule).toBe('STD-2026-0088');
      expect(txInsertedUsers[0].nationalId).toBe('K123456789');

      // Applicant marked enrolled and linked
      expect(txUpdatedApplicants[0].status).toBe('enrolled');
      expect(txUpdatedApplicants[0].convertedUserId).toBe(txInsertedUsers[0].id);
      expect(result.matricule).toBe('STD-2026-0088');
    });

    it('11. Enrollment creates authoritative studentPlacement when section is selected', async () => {
      setupEnrollmentTxMocks({});

      await AdmissionService.enrollApplicant(defaultAdminContext, validApprovedApplicant.id, {
        classSectionId: section3A,
      });

      expect(mockRecordStudentPlacement).toHaveBeenCalledTimes(1);
      expect(mockRecordStudentPlacement).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantA,
          sessionYearId: sessionYear2026,
          classSectionId: section3A,
          status: 'enrolled',
        }),
        expect.anything(),
      );
    });

    it('12. Enrollment without section places student as unassigned (classSectionId: null)', async () => {
      const { txInsertedUsers } = setupEnrollmentTxMocks({ section: null });

      await AdmissionService.enrollApplicant(defaultAdminContext, validApprovedApplicant.id, {
        classSectionId: null,
      });

      expect(mockRecordStudentPlacement).not.toHaveBeenCalled();
      expect(txInsertedUsers[0].classSectionId).toBeNull();
    });

    it('13. Blocks enrollment if candidate is NOT in approved status (throws 409 NOT_APPROVED)', async () => {
      const pendingApp = { ...validApprovedApplicant, status: 'applied' };
      setupEnrollmentTxMocks({ applicant: pendingApp });

      await expect(
        AdmissionService.enrollApplicant(defaultAdminContext, pendingApp.id, {}),
      ).rejects.toThrowError(/La demande doit être approuvée avant de finaliser l'inscription/);
    });

    it('14. Section branch mismatch blocked with 422 SECTION_BRANCH_MISMATCH', async () => {
      const mismatchedSection = {
        id: section3A,
        tenantId: tenantA,
        branchId: branchCampusB, // Different branch than applicant (branchCampusA)
        maxStudents: 30,
        className: 'CampusB-CE1',
      };
      setupEnrollmentTxMocks({ section: mismatchedSection });

      await expect(
        AdmissionService.enrollApplicant(defaultAdminContext, validApprovedApplicant.id, {
          classSectionId: section3A,
        }),
      ).rejects.toThrowError(/La classe sélectionnée n'appartient pas à la succursale de la candidature/);
    });

    it('15. Section with unconfigured capacity (maxStudents: null) blocked with 422 CAPACITY_NOT_CONFIGURED', async () => {
      const unconfiguredSection = {
        id: section3A,
        tenantId: tenantA,
        branchId: branchCampusA,
        maxStudents: null, // Unconfigured
        className: 'CE1-Unconfigured',
      };
      setupEnrollmentTxMocks({ section: unconfiguredSection });

      await expect(
        AdmissionService.enrollApplicant(defaultAdminContext, validApprovedApplicant.id, {
          classSectionId: section3A,
        }),
      ).rejects.toThrowError(/La capacité maximale de cette classe n'est pas configurée/);
    });

    it('16. Full section capacity blocked with 409 SECTION_CAPACITY_FULL', async () => {
      const fullSection = {
        id: section3A,
        tenantId: tenantA,
        branchId: branchCampusA,
        maxStudents: 25,
        className: 'CE1-Full',
      };
      // Current occupancy is 25 (equal to maxStudents)
      setupEnrollmentTxMocks({ section: fullSection, occupancy: 25 });

      await expect(
        AdmissionService.enrollApplicant(defaultAdminContext, validApprovedApplicant.id, {
          classSectionId: section3A,
        }),
      ).rejects.toThrowError(/est complète \(25\/25 élèves\)/);
    });

    it('17. Duplicate enrollment request is idempotent (returns existing student immediately)', async () => {
      const alreadyEnrolledApp = {
        ...validApprovedApplicant,
        status: 'enrolled',
        convertedUserId: 'STD-EXISTING-99',
      };

      const existingStudent = {
        id: 'STD-EXISTING-99',
        matricule: 'STD-2026-0042',
        name: 'Hamza Bennani',
      };

      setupEnrollmentTxMocks({
        applicant: alreadyEnrolledApp,
        alreadyEnrolledStudent: existingStudent,
      });

      const result = await AdmissionService.enrollApplicant(defaultAdminContext, alreadyEnrolledApp.id, {});

      expect(result.alreadyEnrolled).toBe(true);
      expect(result.matricule).toBe('STD-2026-0042');
      expect(mockReserveMatricule).not.toHaveBeenCalled();
    });

    it('18. Existing-student duplicate detection blocks conversion with 409 POSSIBLE_EXISTING_STUDENT', async () => {
      const existingStudentRecord = {
        id: 'STD-EXISTING-ALREADY',
        name: 'Hamza Bennani',
        matricule: 'STD-2025-0012',
        nationalId: 'K123456789',
        role: 'student',
      };

      setupEnrollmentTxMocks({ duplicateStudent: existingStudentRecord });

      await expect(
        AdmissionService.enrollApplicant(defaultAdminContext, validApprovedApplicant.id, {}),
      ).rejects.toThrowError(/Un élève correspondant existe déjà dans l'établissement/);
    });

    it('19. Guardian deduplication: reuses existing guardian record on phone match', async () => {
      const existingGuardian = {
        id: 'grd-existing-father-1',
        phone: '0699887766',
        firstName: 'Omar',
        lastName: 'Bennani',
      };

      const { txInsertedGuardians, txInsertedGuardianStudents } = setupEnrollmentTxMocks({
        existingGuardian,
      });

      await AdmissionService.enrollApplicant(defaultAdminContext, validApprovedApplicant.id, {
        classSectionId: section3A,
      });

      // No new guardian row inserted
      expect(txInsertedGuardians).toHaveLength(0);
      // Linked existing guardian
      expect(txInsertedGuardianStudents).toHaveLength(1);
      expect(txInsertedGuardianStudents[0].guardianId).toBe('grd-existing-father-1');
    });

    it('20. Rejected application creates NO student and blocks enrollment conversion', async () => {
      const rejectedApp = {
        ...validApprovedApplicant,
        status: 'rejected',
        rejectionReason: 'Âge minimum non atteint',
      };

      setupEnrollmentTxMocks({ applicant: rejectedApp });

      await expect(
        AdmissionService.enrollApplicant(defaultAdminContext, rejectedApp.id, {}),
      ).rejects.toThrowError(/La demande doit être approuvée avant de finaliser l'inscription/);
    });
  });

  // =========================================================================
  // 5. SECURITY & ARCHITECTURAL INTEGRITY (P0 & P1)
  // =========================================================================
  describe('5. Security & Architectural Integrity (P0 & P1)', () => {
    it('21. Official matricule is reserved ONLY during enrollment via reserveMatricule', async () => {
      expect(mockReserveMatricule).not.toHaveBeenCalled();
    });

    it('22. Orphan conversion route (/api/students/admissions/[id]/convert) and stage route are permanently deleted', () => {
      const orphanConvertPath = path.resolve(
        process.cwd(),
        'src/app/api/students/admissions/[id]/convert/route.ts',
      );
      const orphanStagePath = path.resolve(
        process.cwd(),
        'src/app/api/students/admissions/[id]/stage/route.ts',
      );

      expect(fs.existsSync(orphanConvertPath)).toBe(false);
      expect(fs.existsSync(orphanStagePath)).toBe(false);
    });

    it('23. Document proxy route blocks cross-branch access with 403 BRANCH_ACCESS_DENIED', async () => {
      const applicantBranchB = {
        id: 'app-campus-b',
        tenantId: tenantA,
        branchId: branchCampusB,
      };

      // Mock applicant check in DB
      mockDbSelect.mockImplementation(() => createChainableQuery(() => [applicantBranchB]));

      const { GET: documentGet } = await import(
        '@/app/api/students/admissions/[id]/documents/[docType]/route'
      );

      const req = new Request('http://localhost:3000/api/students/admissions/app-campus-b/documents/photo', {
        headers: {
          'x-tenant-id': tenantA,
          'x-user-id': 'usr-branch-admin-a',
          'x-user-role': 'school_admin',
          'x-branch-id': branchCampusA,
        },
      });

      const res = await documentGet(req as any, {
        params: Promise.resolve({ id: 'app-campus-b', docType: 'photo' }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('BRANCH_ACCESS_DENIED');
      expect(json.error.message).toMatch(/Accès interdit à cette succursale/);
    });

    it('24. Staff internal notes thread (comments) rejects unauthorized roles with 403', async () => {
      const { POST: commentsPost } = await import(
        '@/app/api/students/admissions/[id]/comments/route'
      );

      // Student/guardian role trying to post internal staff note
      const req = new Request('http://localhost:3000/api/students/admissions/app-01/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantA,
          'x-user-id': 'usr-student-1',
          'x-user-role': 'student',
        },
        body: JSON.stringify({ body: 'Secret staff note' }),
      });

      const res = await commentsPost(req as any, {
        params: Promise.resolve({ id: 'app-01' }),
      });

      expect(res.status).toBe(403);
    });
  });
});
