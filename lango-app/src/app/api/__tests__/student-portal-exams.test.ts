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

import { GET } from '@/app/api/student/me/exams/route';

describe('Student Portal — S3: Exams API (GET /api/student/me/exams)', () => {
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
  });

  it('rejects non-student roles with 403 Forbidden', async () => {
    currentContext = teacherContext;
    const req = new Request('http://localhost:3000/api/student/me/exams');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('correctly splits exams into upcoming and past around a fixed now timestamp', async () => {
    // Fixed now: 2026-09-25T12:00:00Z
    const fixedNow = '2026-09-25T12:00:00Z';

    const mockSchedules = [
      {
        id: 'sch-past',
        examTermId: 'term-1',
        title: 'Examen de Mathématiques (Passé)',
        subjectId: 'sub-math',
        subjectName: 'Mathématiques',
        startTime: '2026-09-20T09:00:00Z',
        endTime: '2026-09-20T11:00:00Z',
        hallName: 'Salle B101',
        seatNumber: 14,
        deskLabel: 'Table 14',
        candidateNumber: 'CAND-001',
      },
      {
        id: 'sch-upcoming',
        examTermId: 'term-1',
        title: 'Examen de Physique (À venir)',
        subjectId: 'sub-phy',
        subjectName: 'Physique-Chimie',
        startTime: '2026-09-28T09:00:00Z',
        endTime: '2026-09-28T11:00:00Z',
        hallName: 'Amphi Atlas',
        seatNumber: 14,
        deskLabel: 'Table 14',
        candidateNumber: 'CAND-001',
      },
    ];

    const mockOnlineExams = [
      {
        id: 'oe-1',
        title: 'QCM Anglais',
        durationMinutes: 45,
        totalMarks: '20.00',
        startsAt: '2026-09-25T10:00:00Z',
        endsAt: '2026-09-25T18:00:00Z',
        subjectName: 'Anglais',
      },
    ];

    // Mock DB queries:
    // 1. user -> classSectionId
    // 2. classSections -> classId
    // 3. classSubjects -> id list
    // 4. examSchedules -> mockSchedules
    // 5. onlineExams -> mockOnlineExams
    mockDbSelect
      .mockImplementationOnce(() => createChainableQuery(() => [{ classSectionId: 'sec-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => [{ classId: 'cls-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => [{ id: 'cs-1' }, { id: 'cs-2' }]))
      .mockImplementationOnce(() => createChainableQuery(() => mockSchedules))
      .mockImplementationOnce(() => createChainableQuery(() => mockOnlineExams));

    const req = new Request('http://localhost:3000/api/student/me/exams', {
      headers: { 'x-test-now': fixedNow },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    expect(body.data.upcoming).toHaveLength(1);
    expect(body.data.upcoming[0]).toMatchObject({
      id: 'sch-upcoming',
      title: 'Examen de Physique (À venir)',
      subject: 'Physique-Chimie',
      hall: 'Amphi Atlas',
      seat: {
        seatNumber: 14,
        deskLabel: 'Table 14',
        candidateNumber: 'CAND-001',
      },
    });

    expect(body.data.past).toHaveLength(1);
    expect(body.data.past[0]).toMatchObject({
      id: 'sch-past',
      title: 'Examen de Mathématiques (Passé)',
      subject: 'Mathématiques',
      hall: 'Salle B101',
      seat: {
        seatNumber: 14,
      },
    });

    expect(body.data.onlineExams).toHaveLength(1);
    expect(body.data.onlineExams[0]).toMatchObject({
      id: 'oe-1',
      title: 'QCM Anglais',
      subject: 'Anglais',
      isOpen: true,
      isExpired: false,
      takeUrl: '/api/academics/online-exams/oe-1/take',
    });
  });

  it('hides exams if student is not assigned to a class section', async () => {
    mockDbSelect.mockImplementationOnce(() => createChainableQuery(() => [{ classSectionId: null }]));

    const req = new Request('http://localhost:3000/api/student/me/exams');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual({ upcoming: [], past: [], onlineExams: [] });
  });

  it('seat is null if no exam_seat exists for this student', async () => {
    const fixedNow = '2026-09-25T12:00:00Z';
    const scheduleWithoutSeat = [
      {
        id: 'sch-noseat',
        examTermId: 'term-1',
        title: 'Examen sans place',
        subjectId: 'sub-svt',
        subjectName: 'SVT',
        startTime: '2026-09-30T09:00:00Z',
        endTime: '2026-09-30T11:00:00Z',
        hallName: 'Salle C2',
        seatNumber: null,
        deskLabel: null,
        candidateNumber: null,
      },
    ];

    mockDbSelect
      .mockImplementationOnce(() => createChainableQuery(() => [{ classSectionId: 'sec-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => [{ classId: 'cls-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => [{ id: 'cs-1' }]))
      .mockImplementationOnce(() => createChainableQuery(() => scheduleWithoutSeat))
      .mockImplementationOnce(() => createChainableQuery(() => []));

    const req = new Request('http://localhost:3000/api/student/me/exams', {
      headers: { 'x-test-now': fixedNow },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.upcoming[0].seat).toBeNull();
  });

  it('another tenant sees empty exams', async () => {
    currentContext = {
      ...studentContext,
      tenantId: tenantB,
    };

    mockDbSelect.mockImplementationOnce(() => createChainableQuery(() => []));

    const req = new Request('http://localhost:3000/api/student/me/exams');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ upcoming: [], past: [], onlineExams: [] });
  });
});
