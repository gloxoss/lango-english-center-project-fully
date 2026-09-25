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

// Mock HomeworkService
const mockGetHomeworkForStudent = vi.fn();
vi.mock('@/features/assessment/services/homework-service', () => ({
  HomeworkService: {
    getHomeworkForStudent: (...args: any[]) => mockGetHomeworkForStudent(...args),
  },
}));

import { GET } from '@/app/api/student/me/homework/route';

describe('Student Portal — S4: Homework API (GET /api/student/me/homework)', () => {
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
  });

  it('rejects non-student roles with 403 Forbidden', async () => {
    currentContext = parentContext;
    const req = new Request('http://localhost:3000/api/student/me/homework');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns published homework for own section with attempts and attachments', async () => {
    const mockHomeworkList = [
      {
        id: 'hw-1',
        title: 'Devoir Maison : Fonctions Logarithmes',
        description: 'Exercices 12 à 18 page 94',
        maximumScore: '20.00',
        status: 'published',
        createdAt: '2026-09-24T10:00:00Z',
        instructions: 'Rendre sous format PDF',
        allowAttachments: true,
        closeAt: '2026-09-30T23:59:59Z',
        submission: null,
        attachments: [{ name: 'sujet.pdf', url: '/uploads/sujet.pdf' }],
        linkedResources: [],
      },
    ];

    mockGetHomeworkForStudent.mockResolvedValueOnce(mockHomeworkList);

    const req = new Request('http://localhost:3000/api/student/me/homework');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('hw-1');
    expect(body.data[0].title).toBe('Devoir Maison : Fonctions Logarithmes');
    expect(mockGetHomeworkForStudent).toHaveBeenCalledWith(tenantA, studentA);
  });

  it('filters by tenantId and studentId (does not return another student or tenant homework)', async () => {
    currentContext = {
      ...studentContext,
      tenantId: tenantB,
      userId: 'stu-other',
    };

    mockGetHomeworkForStudent.mockResolvedValueOnce([]);

    const req = new Request('http://localhost:3000/api/student/me/homework');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(mockGetHomeworkForStudent).toHaveBeenCalledWith(tenantB, 'stu-other');
  });
});
