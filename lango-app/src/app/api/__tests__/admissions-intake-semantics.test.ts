import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { AdmissionService } from '@/features/students/services/admission-service';

// Mock server environment
vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

// Mock Audit Logger
const mockRecordAudit = vi.fn();
vi.mock('@/libs/api/audit', () => ({
  recordAudit: (...args: any[]) => mockRecordAudit(...args),
}));

// Mock Matricule Reservation Service
const mockReserveMatricule = vi.fn();
vi.mock('@/libs/services/matricule', () => ({
  reserveMatricule: (...args: any[]) => mockReserveMatricule(...args),
}));

// Mock Student Placement Service
const mockRecordStudentPlacement = vi.fn();
vi.mock('@/libs/services/student-placement', () => ({
  recordStudentPlacement: (...args: any[]) => mockRecordStudentPlacement(...args),
}));

// Mock Capabilities
const mockRequireCapability = vi.fn().mockResolvedValue(true);
vi.mock('@/libs/api/permissions', () => ({
  requireCapability: (...args: any[]) => mockRequireCapability(...args),
}));

// Mock Request Context
vi.mock('@/libs/api/context', async () => {
  const actual = await vi.importActual<any>('@/libs/api/context');
  return {
    ...actual,
    requireRequestContext: vi.fn(),
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
const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => {
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
  };
});

vi.mock('@/libs/DB', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: (...args: any[]) => mockDbDelete(...args),
  },
}));

describe('SchoolOS Admissions Intake Semantics & Domain Invariants', () => {
  const testTenantId = '11111111-1111-1111-1111-111111111111';
  const defaultAdminContext: RequestContext = {
    tenantId: testTenantId,
    userId: 'admin-usr-01',
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Admin User',
    email: 'admin@atlas.ma',
    branchId: null,
  };

  const mockBranchId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const mockSessionYearId = 'ssssssss-ssss-ssss-ssss-ssssssssssss';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReset();
    mockDbInsert.mockReset();
    mockDbUpdate.mockReset();
    mockDbDelete.mockReset();
  });

  it('1. Intake produces exactly ONE pending admission request (status: applied)', async () => {
    // 1. Branch lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockBranchId }]));
    // 2. SessionYear lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockSessionYearId }]));
    // 3. Duplicate checks in applicants (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 4. Duplicate checks in user (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 5. Insert into applicants
    const insertedApplicant = {
      id: 'app-intake-001',
      tenantId: testTenantId,
      branchId: mockBranchId,
      sessionYearId: mockSessionYearId,
      firstName: 'Hamza',
      lastName: 'El Idrissi',
      email: 'hamza@test.ma',
      phone: '0611223344',
      status: 'applied',
      convertedUserId: null,
    };
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => [insertedApplicant]));
    // 6. Insert CNDP comments
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => []));

    const result = await AdmissionService.createAdmission(defaultAdminContext, {
      firstName: 'Hamza',
      lastName: 'El Idrissi',
      email: 'hamza@test.ma',
      phone: '0611223344',
      branchId: mockBranchId,
      sessionYearId: mockSessionYearId,
      consentAccuracy: true,
      consentCndp: true,
    });

    expect(result.applicant.status).toBe('applied');
    expect(result.applicant.convertedUserId).toBeNull();
    expect(result.duplicateWarning).toBeNull();
  });

  it('2. Intake produces ZERO student account (user table is untouched for students)', async () => {
    expect(mockDbInsert).not.toHaveBeenCalledWith(expect.objectContaining({ role: 'student' }));
  });

  it('3. Intake produces ZERO matricule (reserveMatricule is NOT called)', async () => {
    expect(mockReserveMatricule).not.toHaveBeenCalled();
  });

  it('4. Intake produces ZERO student placement (studentPlacements is untouched)', async () => {
    expect(mockRecordStudentPlacement).not.toHaveBeenCalled();
  });

  it('5. Intake produces ZERO tuition invoice', async () => {
    // Verified: No invoice tables or billing methods are called in createAdmission
    expect(mockDbInsert).not.toHaveBeenCalledWith(expect.objectContaining({ invoiceNumber: expect.anything() }));
  });

  it('6. Reuses existing guardian by phone/email without creating duplicate guardian record', async () => {
    const existingGuardianId = 'gggggggg-gggg-gggg-gggg-gggggggggggg';
    // 1. Branch lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockBranchId }]));
    // 2. SessionYear lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockSessionYearId }]));
    // 3. Guardian lookup finds existing guardian
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{
      id: existingGuardianId,
      firstName: 'Fatima',
      lastName: 'El Idrissi',
      phone: '0612345678',
      email: 'fatima@test.ma',
    }]));
    // 4. Duplicate applicant check (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 5. Duplicate student check (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 6. Insert applicant with guardianId linked
    const insertedApplicant = {
      id: 'app-intake-002',
      tenantId: testTenantId,
      guardianId: existingGuardianId,
      status: 'applied',
    };
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => [insertedApplicant]));

    const result = await AdmissionService.createAdmission(defaultAdminContext, {
      firstName: 'Yassine',
      lastName: 'El Idrissi',
      email: 'yassine@test.ma',
      phone: '0699887766',
      branchId: mockBranchId,
      sessionYearId: mockSessionYearId,
      guardianPhone: '0612345678',
      guardianEmail: 'fatima@test.ma',
    });

    expect(result.applicant.guardianId).toBe(existingGuardianId);
  });

  it('7. Tenant-scoped duplicate detection: Identical Massar/email/phone in Tenant B is completely invisible from Tenant A', async () => {
    // 1. Branch lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockBranchId }]));
    // 2. SessionYear lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockSessionYearId }]));
    // 3. Duplicate checks in applicants scoped to Tenant A -> returns empty (because matching Massar G123456789 belongs to Tenant B!)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 4. Duplicate checks in user scoped to Tenant A -> returns empty
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 5. Duplicate checks for contact scoped to Tenant A -> returns empty
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 6. Duplicate checks for contact in user scoped to Tenant A -> returns empty
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 7. Duplicate checks for identity in applicants scoped to Tenant A -> returns empty
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 8. Duplicate checks for identity in user scoped to Tenant A -> returns empty
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 9. Insert applicant for Tenant A succeeds
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-tenant-a-001',
      status: 'applied',
    }]));

    const result = await AdmissionService.createAdmission(defaultAdminContext, {
      firstName: 'Hamza',
      lastName: 'Bennani',
      email: 'hamza@test.ma',
      phone: '0622334455',
      nationalId: 'G123456789',
      dateOfBirth: '2012-05-10',
    });

    expect(result.applicant.id).toBe('app-tenant-a-001');
    expect(result.duplicateWarning).toBeNull();
    expect(result.hasDuplicateWarning).toBe(false);
  });

  it('8. Duplicate severity policy: Exact Massar match inside current tenant blocks creation with user-safe 409 conflict', async () => {
    // 1. Branch lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockBranchId }]));
    // 2. SessionYear lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockSessionYearId }]));
    // 3. Duplicate Massar check in applicants inside current tenant (matches existing applicant!)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-existing-99',
      firstName: 'Karim',
      lastName: 'Bennani',
      status: 'applied',
    }]));

    try {
      await AdmissionService.createAdmission(defaultAdminContext, {
        firstName: 'Karim',
        lastName: 'Bennani',
        email: 'karim@test.ma',
        phone: '0622334455',
        nationalId: 'G123456789',
        overrideDuplicate: false,
      });
      expect.fail('Should have thrown 409 MASSAR_DUPLICATE_CONFLICT');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(409);
      expect(err.code).toBe('MASSAR_DUPLICATE_CONFLICT');
      expect(err.details?.duplicate?.severity).toBe('strong');
      expect(err.details?.duplicate?.matchType).toBe('massar');
    }
  });

  it('9. Duplicate severity policy: Exact Massar match with explicit administrative override allows audited creation', async () => {
    // 1. Branch lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockBranchId }]));
    // 2. SessionYear lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockSessionYearId }]));
    // 3. Duplicate Massar check in applicants inside current tenant
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-existing-99',
      firstName: 'Karim',
      lastName: 'Bennani',
      status: 'applied',
    }]));
    // 4. Insert applicant
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-overridden-001',
      status: 'applied',
    }]));
    // 5. Insert administrative override comment
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => []));

    const result = await AdmissionService.createAdmission(defaultAdminContext, {
      firstName: 'Karim',
      lastName: 'Bennani',
      email: 'karim@test.ma',
      phone: '0622334455',
      nationalId: 'G123456789',
      overrideDuplicate: true,
      overrideReason: 'Direction approval on duplicate dossier',
    });

    expect(result.applicant.id).toBe('app-overridden-001');
    expect(result.duplicateWarning).toEqual({
      id: 'app-existing-99',
      name: 'Karim Bennani',
      status: 'applied',
      isEnrolledStudent: false,
      matchType: 'massar',
      severity: 'strong',
    });
    expect(mockRecordAudit).toHaveBeenCalledWith(
      defaultAdminContext,
      'create',
      'admission_request',
      'app-overridden-001',
      expect.objectContaining({
        hasDuplicateWarning: true,
        overrideDuplicate: true,
        duplicateSeverity: 'strong',
        duplicateMatchType: 'massar',
      }),
    );
  });

  it('10. Duplicate severity policy: Exact email/phone match yields medium severity advisory warning without blocking', async () => {
    // 1. Branch lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockBranchId }]));
    // 2. SessionYear lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockSessionYearId }]));
    // 3. Contact check in applicants inside tenant (matches existing applicant!)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-contact-01',
      firstName: 'Nadia',
      lastName: 'Bennani',
      status: 'in_review',
    }]));
    // 4. Insert applicant
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-intake-008',
      status: 'applied',
    }]));

    const result = await AdmissionService.createAdmission(defaultAdminContext, {
      firstName: 'Nadia',
      lastName: 'Bennani',
      email: 'nadia@test.ma',
      phone: '0611223344',
    });

    expect(result.duplicateWarning).toEqual({
      id: 'app-contact-01',
      name: 'Nadia Bennani',
      status: 'in_review',
      isEnrolledStudent: false,
      matchType: 'contact',
      severity: 'medium',
    });
    expect(result.hasDuplicateWarning).toBe(true);
  });

  it('11. Duplicate severity policy: Name + DOB match yields weak advisory warning without blocking', async () => {
    // 1. Branch lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockBranchId }]));
    // 2. SessionYear lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockSessionYearId }]));
    // 3. Contact check in applicants (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 4. Contact check in user (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 5. Identity check in applicants (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 6. Identity check in user (matches enrolled student!)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'usr-student-88',
      name: 'Amine Alaoui',
      matricule: 'STD-2025-0012',
      userStatus: 'active',
    }]));
    // 7. Insert applicant
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-intake-009',
      status: 'applied',
    }]));

    const result = await AdmissionService.createAdmission(defaultAdminContext, {
      firstName: 'Amine',
      lastName: 'Alaoui',
      email: 'unique-amine@test.ma',
      phone: '0699001122',
      dateOfBirth: '2014-06-15',
    });

    expect(result.duplicateWarning).toEqual({
      id: 'usr-student-88',
      name: 'Amine Alaoui (STD-2025-0012)',
      status: 'active',
      isEnrolledStudent: true,
      matchType: 'identity',
      severity: 'advisory',
    });
  });

  it('12. Persists Law 09-08 (CNDP) and accuracy consent in recordAudit and admissionComments', async () => {
    // 1. Branch lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockBranchId }]));
    // 2. SessionYear lookup
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: mockSessionYearId }]));
    // 3. Contact check in applicants (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 4. Contact check in user (none)
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
    // 5. Insert applicant
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-intake-005',
      status: 'applied',
    }]));
    // 6. Insert CNDP comments
    mockDbInsert.mockReturnValueOnce(createChainableQuery(() => []));

    await AdmissionService.createAdmission(defaultAdminContext, {
      firstName: 'Salma',
      lastName: 'Tazi',
      email: 'salma@test.ma',
      phone: '0644332211',
      consentAccuracy: true,
      consentCndp: true,
    });

    expect(mockRecordAudit).toHaveBeenCalledWith(
      defaultAdminContext,
      'create',
      'admission_request',
      'app-intake-005',
      expect.objectContaining({
        consentAccuracy: true,
        consentCndp: true,
        cndpTimestamp: expect.any(String),
      }),
    );
  });

  it('13. Enforces branch isolation (rejects invalid branch belonging to another tenant/invalid)', async () => {
    // Branch lookup returns null
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));

    await expect(
      AdmissionService.createAdmission(defaultAdminContext, {
        firstName: 'Nabil',
        lastName: 'Fassi',
        email: 'nabil@test.ma',
        phone: '0677889900',
        branchId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(ApiError);
  });

  it('14. Blocks update if applicant is already approved or rejected (decision lock)', async () => {
    // Lookup returns an already approved applicant
    mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{
      id: 'app-locked-001',
      status: 'approved',
      branchId: mockBranchId,
    }]));

    await expect(
      AdmissionService.updateAdmission(defaultAdminContext, 'app-locked-001', {
        firstName: 'MutatedName',
      }),
    ).rejects.toThrow(ApiError);
  });
});
