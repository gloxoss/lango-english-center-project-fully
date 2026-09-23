import type { RequestContext } from '@/libs/api/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getMatricules, PATCH as patchMatricules, POST as postMatricules } from '@/app/api/students/matricules/route';
import { previewMatricule, reserveMatricule } from '@/libs/services/matricule';

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

// Mock Capabilities and Plan Limits
const mockRequireCapability = vi.fn().mockResolvedValue(true);
vi.mock('@/libs/api/permissions', () => ({
  requireCapability: (...args: any[]) => mockRequireCapability(...args),
}));

vi.mock('@/features/subscriptions/services/plan-limits-service', () => ({
  assertStudentCapacity: vi.fn().mockResolvedValue(true),
}));

// Mock Request Context
let currentRequestContext: RequestContext | null = null;
vi.mock('@/libs/api/context', async () => {
  const actual = await vi.importActual<any>('@/libs/api/context');
  return {
    ...actual,
    requireRequestContext: vi.fn(async () => currentRequestContext),
    requireTenant: (ctx: any) => ctx?.tenantId ?? '11111111-1111-1111-1111-111111111111',
  };
});

// Fluent chainable query builder helper
function createChainableQuery(resolver: () => any) {
  const chain: any = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    for: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    set: vi.fn(() => chain),
    values: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => chain),
    then: (onResolve: any, onReject: any) => Promise.resolve(resolver()).then(onResolve, onReject),
  };
  return chain;
}

// Hoisted DB mocks
const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbExecute, mockDbTransaction } = vi.hoisted(() => {
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbExecute: vi.fn(),
    mockDbTransaction: vi.fn((cb: any) => cb({
      select: (...args: any[]) => mockDbSelect(...args),
      insert: (...args: any[]) => mockDbInsert(...args),
      update: (...args: any[]) => mockDbUpdate(...args),
      delete: (...args: any[]) => mockDbDelete(...args),
      execute: (...args: any[]) => mockDbExecute(...args),
    })),
  };
});

vi.mock('@/libs/DB', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: (...args: any[]) => mockDbDelete(...args),
    execute: (...args: any[]) => mockDbExecute(...args),
    transaction: (cb: any) => mockDbTransaction(cb),
  },
}));

describe('SchoolOS Matricule & Student Identifier Authoritative Domain', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const _tenantB = '22222222-2222-2222-2222-222222222222';

  const adminTenantA: RequestContext = {
    tenantId: tenantA,
    userId: 'admin-a',
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Admin Atlas',
    email: 'admin@atlas.ma',
    branchId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReset();
    mockDbInsert.mockReset();
    mockDbUpdate.mockReset();
    mockDbDelete.mockReset();
    mockDbExecute.mockReset();
    currentRequestContext = adminTenantA;
  });

  // --------------------------------------------------------------------------
  // 1. Authoritative Sequential Service: previewMatricule & reserveMatricule
  // --------------------------------------------------------------------------
  describe('Authoritative Generator Service (reserveMatricule & previewMatricule)', () => {
    it('1. previewMatricule is purely non-mutating (zero DB inserts/updates)', async () => {
      // Return series counter at 5
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ currentVal: 5 }]));
      // No higher user matricules
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));

      const preview1 = await previewMatricule({ select: mockDbSelect }, tenantA);
      const year = new Date().getFullYear();

      expect(preview1).toBe(`STD-${year}-0006`);

      // Verify ZERO database mutations were performed
      expect(mockDbInsert).not.toHaveBeenCalled();
      expect(mockDbUpdate).not.toHaveBeenCalled();
      expect(mockDbDelete).not.toHaveBeenCalled();
    });

    it('2. reserveMatricule auto-reconciles upwards above existing user matricules', async () => {
      // Naming series counter is currently only at 2
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ currentVal: 2 }]));
      // But an imported or pre-existing student exists with STD-2026-0045!
      const year = new Date().getFullYear();
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [
        { matricule: `STD-${year}-0001` },
        { matricule: `STD-${year}-0045` },
        { matricule: `STD-${year}-0012` },
      ]));
      mockDbUpdate.mockReturnValue(createChainableQuery(() => [{}]));

      const reserved = await reserveMatricule({
        select: mockDbSelect,
        update: mockDbUpdate,
        insert: mockDbInsert,
        execute: mockDbExecute,
      }, tenantA);

      // Must auto-reconcile upwards to 46 (never collide with 45)
      expect(reserved).toBe(`STD-${year}-0046`);
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('3. reserveMatricule acquires transaction advisory lock for concurrency safety', async () => {
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ currentVal: 10 }]));
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
      mockDbUpdate.mockReturnValue(createChainableQuery(() => [{}]));

      await reserveMatricule({
        select: mockDbSelect,
        update: mockDbUpdate,
        insert: mockDbInsert,
        execute: mockDbExecute,
      }, tenantA);

      expect(mockDbExecute).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/students/matricules (Stats & Authoritative Incomplete Counter)
  // --------------------------------------------------------------------------
  describe('GET /api/students/matricules', () => {
    it('4. Returns accurate KPI counters including authoritative incomplete count', async () => {
      const year = new Date().getFullYear();
      mockDbSelect.mockImplementation((fields?: any) => {
        if (fields && typeof fields === 'object' && 'total' in fields) {
          return createChainableQuery(() => [{
            total: 100,
            assigned: 95,
            missing: 5,
            assignedMassar: 90,
            missingMassar: 10,
            incomplete: 12,
          }]);
        }
        if (fields && typeof fields === 'object' && 'matricule' in fields) {
          return createChainableQuery(() => []);
        }
        return createChainableQuery(() => [{ currentVal: 8 }]);
      });

      const req = new Request('http://localhost/api/students/matricules');
      const res = await getMatricules(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.matricule).toBe(`STD-${year}-0009`);
      expect(json.stats).toEqual({
        total: 100,
        assigned: 95,
        missing: 5,
        assignedMassar: 90,
        missingMassar: 10,
        incomplete: 12,
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. POST /api/students/matricules (Truthful Allocation, Zero Orphan Burns)
  // --------------------------------------------------------------------------
  describe('POST /api/students/matricules', () => {
    it('5. Assigns next matricule to first unmatriculated student without orphan burning', async () => {
      const year = new Date().getFullYear();
      // Unassigned student lookup finds student 'stu-unassigned-1'
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [
        { id: 'stu-unassigned-1', name: 'Karim Bennani' },
      ]));
      // Inside reserveMatricule: series lookup + user lookup
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ currentVal: 3 }]));
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
      mockDbUpdate.mockReturnValue(createChainableQuery(() => [{}]));

      const req = new Request('http://localhost/api/students/matricules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await postMatricules(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.matricule).toBe(`STD-${year}-0004`);
      expect(json.assignedStudent).toEqual({
        id: 'stu-unassigned-1',
        fullName: 'Karim Bennani',
      });
      expect(mockRecordAudit).toHaveBeenCalledWith(
        adminTenantA,
        'update',
        'student_matricule',
        'stu-unassigned-1',
        expect.objectContaining({ matricule: `STD-${year}-0004` }),
      );
    });

    it('6. Does NOT burn orphan sequence when all students already have a matricule', async () => {
      // Unassigned student lookup returns EMPTY (all students are matriculated)
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
      // previewMatricule runs to show next available
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ currentVal: 15 }]));
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));

      const req = new Request('http://localhost/api/students/matricules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await postMatricules(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.allAssigned).toBe(true);

      const year = new Date().getFullYear();

      expect(json.matricule).toBe(`STD-${year}-0016`);
      // Crucial invariant: Update MUST NOT have been called on namingSeries!
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 4. PATCH /api/students/matricules (Massar Validation, Tenant Duplicates, IDOR)
  // --------------------------------------------------------------------------
  describe('PATCH /api/students/matricules', () => {
    it('7. Rejects malformed Moroccan Code Massar with 422 FORMAT_INVALID', async () => {
      // Student exists in tenant
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [
        { id: 'stu-01', name: 'Nadia Tazi', matricule: 'STD-2026-0001', nationalId: null },
      ]));

      const req = new Request('http://localhost/api/students/matricules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'stu-01',
          codeMassar: 'INVALID123', // Not 1 letter + 9 digits!
        }),
      });

      const res = await patchMatricules(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe('FORMAT_INVALID');
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('8. Rejects duplicate Code Massar in the same tenant with 409 MASSAR_CONFLICT', async () => {
      // 1. Target student lookup
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [
        { id: 'stu-01', name: 'Nadia Tazi', matricule: 'STD-2026-0001', nationalId: null },
      ]));
      // 2. Duplicate Massar check finds student 'stu-02' with G134567890 in tenantA
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [
        { id: 'stu-02' },
      ]));

      const req = new Request('http://localhost/api/students/matricules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'stu-01',
          codeMassar: 'G134567890',
        }),
      });

      const res = await patchMatricules(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('MASSAR_CONFLICT');
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('9. Rejects duplicate internal matricule in the same tenant with 409 MATRICULE_CONFLICT', async () => {
      // 1. Target student lookup
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [
        { id: 'stu-01', name: 'Nadia Tazi', matricule: 'STD-2026-0001', nationalId: null },
      ]));
      // 2. Duplicate matricule check finds collision
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [
        { id: 'stu-99' },
      ]));

      const req = new Request('http://localhost/api/students/matricules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'stu-01',
          matricule: 'STD-2026-0099',
        }),
      });

      const res = await patchMatricules(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('MATRICULE_CONFLICT');
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('10. Prevents cross-tenant IDOR: modifying a student belonging to Tenant B throws 404', async () => {
      // Target student query scoped with eq(tenantId, tenantA) returns empty!
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));

      const req = new Request('http://localhost/api/students/matricules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'stu-in-tenant-b',
          codeMassar: 'G134567890',
        }),
      });

      const res = await patchMatricules(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('STUDENT_NOT_FOUND');
    });

    it('11. Records comprehensive audit log with previous and next values upon update', async () => {
      // 1. Target student lookup
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [
        { id: 'stu-01', name: 'Nadia Tazi', matricule: 'STD-2026-0001', nationalId: 'R123456789' },
      ]));
      // 2. Matricule dup check (none)
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
      // 3. Massar dup check (none)
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
      // 4. Update returning
      mockDbUpdate.mockReturnValue(createChainableQuery(() => [
        { id: 'stu-01', name: 'Nadia Tazi', matricule: 'STD-2026-0002', nationalId: 'G134567890' },
      ]));

      const req = new Request('http://localhost/api/students/matricules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'stu-01',
          matricule: 'STD-2026-0002',
          codeMassar: 'g134567890', // Lowercase must be normalized to uppercase!
        }),
      });

      const res = await patchMatricules(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.codeMassar).toBe('G134567890');
      expect(mockRecordAudit).toHaveBeenCalledWith(
        adminTenantA,
        'update',
        'student_matricule',
        'stu-01',
        {
          previous: {
            matricule: 'STD-2026-0001',
            codeMassar: 'R123456789',
          },
          next: {
            matricule: 'STD-2026-0002',
            codeMassar: 'G134567890',
          },
        },
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Invariant: Unified Generator across Direct Creation, Ingestion & Matricules
  // --------------------------------------------------------------------------
  describe('Unified Generator & Ingestion Paths', () => {
    it('12. Direct student creation generates sequential matricule via reserveMatricule when omitted', async () => {
      const year = new Date().getFullYear();
      // 1. Inside reserveMatricule: namingSeries query
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ currentVal: 12 }]));
      // 2. Inside reserveMatricule: existing user matricules query
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));
      mockDbUpdate.mockReturnValue(createChainableQuery(() => [{}]));

      // 3. rawMassar duplicate check in user
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => []));

      // 4. Default branch lookup in branches
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: 'branch-default' }]));

      // 5. User insert
      const insertedRow = {
        id: 'STU-test-direct-01',
        tenantId: tenantA,
        branchId: 'branch-default',
        matricule: `STD-${year}-0013`,
        nationalId: 'M123456789',
        name: 'Sara Idrissi',
        email: 'sara@atlas.ma',
        role: 'student',
        classSectionId: null,
        userStatus: 'active',
        paymentStatus: 'À jour',
      };
      mockDbInsert.mockReturnValue(createChainableQuery(() => [insertedRow]));

      const { POST: postStudent } = await import('@/app/api/students/route');

      const req = new Request('http://localhost/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Sara Idrissi',
          email: 'sara@atlas.ma',
          codeMassar: 'm123456789', // Normalization test!
        }),
      });

      const res = await postStudent(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.matricule).toBe(`STD-${year}-0013`);
      expect(json.data.codeMassar).toBe('M123456789');
    });

    it('13. Direct student creation rejects duplicate manual matricule with 409 MATRICULE_CONFLICT', async () => {
      // Duplicate matricule check finds collision
      mockDbSelect.mockReturnValueOnce(createChainableQuery(() => [{ id: 'existing-stu' }]));

      const { POST: postStudent } = await import('@/app/api/students/route');

      const req = new Request('http://localhost/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Amine Alaoui',
          matricule: 'STD-2026-0001',
        }),
      });

      const res = await postStudent(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('MATRICULE_CONFLICT');
    });
  });
});
