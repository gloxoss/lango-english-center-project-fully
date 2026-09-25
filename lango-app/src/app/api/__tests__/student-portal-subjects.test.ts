import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';

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

// Mock Capabilities & Permissions
vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/features/platform/services/domains-service', () => ({
  listApprovedDomains: vi.fn().mockResolvedValue([]),
}));

let currentContext: RequestContext | null = null;
vi.mock('@/libs/api/context', async () => {
  const actual = await vi.importActual<any>('@/libs/api/context');
  return {
    ...actual,
    requireRequestContext: vi.fn(async (_req: Request, allowedRoles?: string[]) => {
      if (!currentContext) {
        throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
      }
      if (allowedRoles && !allowedRoles.includes(currentContext.role)) {
        throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
      }
      return currentContext;
    }),
    requireTenant: (ctx: any) => {
      if (!ctx?.tenantId) {
        throw new ApiError(400, 'Tenant required', 'TENANT_REQUIRED');
      }
      return ctx.tenantId;
    },
  };
});

function createChainableQuery(resolver: () => any) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    limit: vi.fn((n?: number) => {
      const res = resolver();
      if (Array.isArray(res) && typeof n === 'number') {
        return Promise.resolve(res.slice(0, n));
      }
      return Promise.resolve(res);
    }),
    then: (onResolve: any, onReject: any) => Promise.resolve(resolver()).then(onResolve, onReject),
  };
  return chain;
}

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
  },
}));

const mockGetPublishedResults = vi.fn();
vi.mock('@/features/assessment/services/published-results', () => ({
  getPublishedResultsForStudent: (...args: any[]) => mockGetPublishedResults(...args),
}));

const mockGetHomeworkForStudent = vi.fn();
vi.mock('@/features/assessment/services/homework-service', () => ({
  HomeworkService: {
    getHomeworkForStudent: (...args: any[]) => mockGetHomeworkForStudent(...args),
  },
}));

import { GET } from '@/app/api/student/me/subjects/route';

describe('Student Portal — S5: Enriched Subjects API (GET /api/student/me/subjects)', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const studentA = 'stu-0001';

  const studentContext: RequestContext = {
    userId: studentA,
    tenantId: tenantA,
    role: 'student',
    baseRole: 'student',
    branchId: null,
    name: 'Karim Atlas',
    email: 'etudiant.0001@atlas.ma',
  };

  const teacherContext: RequestContext = {
    userId: 'tch-0001',
    tenantId: tenantA,
    role: 'teacher',
    baseRole: 'teacher',
    branchId: null,
    name: 'Prof Amrani',
    email: 'teacher@atlas.ma',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentContext = studentContext;
    mockDbSelect.mockImplementation(() => createChainableQuery(() => []));
    mockGetPublishedResults.mockResolvedValue([]);
    mockGetHomeworkForStudent.mockResolvedValue([]);
  });

  it('rejects non-student roles with 403 Forbidden', async () => {
    currentContext = teacherContext;
    const req = new Request('http://localhost:3000/api/student/me/subjects');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns enriched subjects with coefficient, provisionalAverage20, and openHomework count', async () => {
    // Subject 1: Mathématiques (has published grades, coefficient 3, 1 open homework)
    // Subject 2: Histoire-Géo (no published grades, coefficient 1, 0 open homework)
    const mockSubjectTeachers = [
      {
        subjectId: 'sub-math',
        subjectName: 'Mathématiques',
        teacherName: 'M. Amrani',
      },
      {
        subjectId: 'sub-hg',
        subjectName: 'Histoire-Géographie',
        teacherName: 'Mme. Bennani',
      },
    ];

    const mockClassSubjects = [
      { subjectId: 'sub-math', coefficient: '3.00' },
      { subjectId: 'sub-hg', coefficient: '1.00' },
    ];

    const mockResults = [
      {
        assessmentId: 'a1',
        subjectId: 'sub-math',
        subjectName: 'Mathématiques',
        status: 'graded',
        normalizedScore: '16.00',
        rawScore: '16.00',
        maximumScore: '20.00',
        maximumScoreSnapshot: '20.00',
      },
      {
        assessmentId: 'a2',
        subjectId: 'sub-math',
        subjectName: 'Mathématiques',
        status: 'graded',
        normalizedScore: '14.00',
        rawScore: '14.00',
        maximumScore: '20.00',
        maximumScoreSnapshot: '20.00',
      },
    ];

    const mockHomeworks = [
      {
        id: 'hw-1',
        title: 'Devoir Math',
        closeAt: '2026-09-30T23:59:59Z',
      },
    ];

    const mockHwDefs = [
      {
        id: 'hw-1',
        subjectId: 'sub-math',
      },
    ];

    // DB query sequence:
    // 1. user -> me.classSectionId
    // 2. subjectTeachers -> mockSubjectTeachers
    // 3. classSections -> section.classId
    // 4. classSubjects -> mockClassSubjects
    // 5. assessmentDefinitions + classSubjects for hwIds -> mockHwDefs
    mockDbSelect
      .mockImplementationOnce(() => createChainableQuery(() => [{ classSectionId: 'sec-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => mockSubjectTeachers))
      .mockImplementationOnce(() => createChainableQuery(() => [{ classId: 'cls-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => mockClassSubjects))
      .mockImplementationOnce(() => createChainableQuery(() => mockHwDefs));

    mockGetPublishedResults.mockResolvedValueOnce(mockResults);
    mockGetHomeworkForStudent.mockResolvedValueOnce(mockHomeworks);

    const req = new Request('http://localhost:3000/api/student/me/subjects', {
      headers: { 'x-test-now': '2026-09-25T12:00:00Z' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.subjects).toHaveLength(2);

    const math = body.data.subjects.find((s: any) => s.subjectId === 'sub-math');
    expect(math).toMatchObject({
      subjectId: 'sub-math',
      subjectName: 'Mathématiques',
      teacherName: 'M. Amrani',
      coefficient: 3,
      provisionalAverage20: 15, // (16 + 14) / 2
      openHomework: 1,
    });

    const hg = body.data.subjects.find((s: any) => s.subjectId === 'sub-hg');
    expect(hg).toMatchObject({
      subjectId: 'sub-hg',
      subjectName: 'Histoire-Géographie',
      teacherName: 'Mme. Bennani',
      coefficient: 1,
      provisionalAverage20: null, // No grades yet
      openHomework: 0,
    });
  });

  it('handles student without class section gracefully', async () => {
    mockDbSelect.mockImplementationOnce(() => createChainableQuery(() => [{ classSectionId: null }]));

    const req = new Request('http://localhost:3000/api/student/me/subjects');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.subjects).toEqual([]);
  });

  it('scopes by tenantId (another tenant sees empty)', async () => {
    currentContext = {
      ...studentContext,
      tenantId: tenantB,
    };

    mockDbSelect.mockImplementationOnce(() => createChainableQuery(() => []));

    const req = new Request('http://localhost:3000/api/student/me/subjects');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.subjects).toEqual([]);
  });
});
