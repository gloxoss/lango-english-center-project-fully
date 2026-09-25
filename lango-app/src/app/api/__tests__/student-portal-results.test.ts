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

import { GET } from '@/app/api/student/me/results/route';
import { getPublishedResultsForStudent } from '@/features/assessment/services/published-results';

describe('Student Portal — S1: Results API (GET /api/student/me/results)', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const studentA = 'stu-0001';
  const studentB = 'stu-0002';

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

  const parentContext: RequestContext = {
    userId: 'prt-0001',
    tenantId: tenantA,
    role: 'parent',
    baseRole: 'parent',
    branchId: null,
    name: 'Parent Atlas',
    email: 'parent@atlas.ma',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentContext = studentContext;
    mockDbSelect.mockImplementation(() => createChainableQuery(() => []));
  });

  it('rejects non-student roles with 403 Forbidden', async () => {
    currentContext = teacherContext;
    const req = new Request('http://localhost:3000/api/student/me/results');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);

    currentContext = parentContext;
    const resParent = await GET(req);
    expect(resParent.status).toBe(403);
  });

  it('returns own published grades with provisional /20 average and coefficients', async () => {
    const publishedGrades = [
      {
        assessmentId: 'asm-1',
        title: 'Contrôle 1 Algèbre',
        type: 'exam',
        subjectId: 'sub-math',
        subjectName: 'Mathématiques',
        maximumScore: '20.00',
        rawScore: '16.00',
        normalizedScore: '16.00',
        maximumScoreSnapshot: '20.00',
        grade: 'A',
        status: 'graded',
        gradedAt: '2026-09-20T10:00:00Z',
      },
      {
        assessmentId: 'asm-2',
        title: 'Contrôle 2 Géométrie',
        type: 'exam',
        subjectId: 'sub-math',
        subjectName: 'Mathématiques',
        maximumScore: '20.00',
        rawScore: '14.00',
        normalizedScore: '14.00',
        maximumScoreSnapshot: '20.00',
        grade: 'B',
        status: 'graded',
        gradedAt: '2026-09-22T10:00:00Z',
      },
      {
        assessmentId: 'asm-3',
        title: 'Expression Écrite',
        type: 'homework',
        subjectId: 'sub-fr',
        subjectName: 'Français',
        maximumScore: '20.00',
        rawScore: '15.00',
        normalizedScore: '15.00',
        maximumScoreSnapshot: '20.00',
        grade: 'B+',
        status: 'graded',
        gradedAt: '2026-09-21T10:00:00Z',
      },
    ];

    // Mock sequence of db.select:
    // 1. getPublishedResultsForStudent
    // 2. user (me.classSectionId)
    // 3. classSections (section.classId)
    // 4. classSubjects (coefficients)
    mockDbSelect
      .mockImplementationOnce(() => createChainableQuery(() => publishedGrades))
      .mockImplementationOnce(() => createChainableQuery(() => [{ classSectionId: 'sec-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => [{ classId: 'cls-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => [
        { subjectId: 'sub-math', coefficient: '3.00' },
        { subjectId: 'sub-fr', coefficient: '2.00' },
      ]));

    const req = new Request('http://localhost:3000/api/student/me/results');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.results).toHaveLength(3);
    expect(body.data.results[0]).toMatchObject({
      assessmentId: 'asm-1',
      title: 'Contrôle 1 Algèbre',
      score: 16,
      maximumScore: 20,
      subject: 'Mathématiques',
    });

    const mathSummary = body.data.summary.find((s: any) => s.subjectId === 'sub-math');
    expect(mathSummary).toBeDefined();
    expect(mathSummary.count).toBe(2);
    expect(mathSummary.provisionalAverage20).toBe(15); // (16 + 14) / 2
    expect(mathSummary.coefficient).toBe(3);

    const frSummary = body.data.summary.find((s: any) => s.subjectId === 'sub-fr');
    expect(frSummary).toBeDefined();
    expect(frSummary.count).toBe(1);
    expect(frSummary.provisionalAverage20).toBe(15);
    expect(frSummary.coefficient).toBe(2);
  });

  it('hides unpublished, draft, withheld results from student', async () => {
    // getPublishedResultsForStudent query has strict SQL WHERE filter.
    // If the DB returns empty because outcomes were draft or withheld:
    mockDbSelect
      .mockImplementationOnce(() => createChainableQuery(() => []))
      .mockImplementationOnce(() => createChainableQuery(() => [{ classSectionId: 'sec-1' }]));

    const req = new Request('http://localhost:3000/api/student/me/results');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.results).toEqual([]);
    expect(body.data.summary).toEqual([]);
  });

  it('another tenant sees empty results', async () => {
    currentContext = {
      ...studentContext,
      tenantId: tenantB,
      userId: 'stu-foreign',
    };

    mockDbSelect
      .mockImplementationOnce(() => createChainableQuery(() => []))
      .mockImplementationOnce(() => createChainableQuery(() => []));

    const req = new Request('http://localhost:3000/api/student/me/results');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.results).toEqual([]);
  });
});
