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

// Mock renderPdf from document-studio
vi.mock('@/libs/document-studio/render', () => ({
  renderPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock pdf content')),
}));

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

import { GET as getReportCards } from '@/app/api/student/me/report-cards/route';
import { GET as getReportCardPdf } from '@/app/api/student/me/report-cards/[id]/pdf/route';

describe('Student Portal — S2: Report Cards API', () => {
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

  describe('GET /api/student/me/report-cards', () => {
    it('rejects non-student roles with 403 Forbidden', async () => {
      currentContext = teacherContext;
      const req = new Request('http://localhost:3000/api/student/me/report-cards');
      const res = await getReportCards(req);
      expect(res.status).toBe(403);
    });

    it('returns issued active report cards projected safely from snapshot', async () => {
      const mockDoc = {
        id: 'doc-001',
        issuedAt: '2026-09-20T10:00:00Z',
        renderDataSnapshot: {
          title: 'Bulletin du 1er Semestre',
          studentName: 'Karim Atlas',
          className: '2BAC BIOF - A',
          matricule: 'ETU-2026-0001',
          generalAverage: 'Moyenne générale : 15.42 / 20',
          mention: 'Mention : Bien',
          rank: 'Rang : 2 / 28',
          status: 'Admis',
          subjects: 'Maths ...',
        },
      };

      mockDbSelect.mockImplementationOnce(() => createChainableQuery(() => [mockDoc]));

      const req = new Request('http://localhost:3000/api/student/me/report-cards');
      const res = await getReportCards(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0]).toEqual({
        id: 'doc-001',
        termLabel: 'Bulletin du 1er Semestre',
        schoolYear: '2BAC BIOF - A',
        generalAverage: 15.42,
        mention: 'Bien',
        decision: 'Admis',
        rank: 2,
        classSize: 28,
        issuedDate: '2026-09-20T10:00:00Z',
      });
      // Ensure internal fields never exposed
      expect(json.data[0]).not.toHaveProperty('renderDataSnapshot');
      expect(json.data[0]).not.toHaveProperty('publicTokenHash');
    });

    it('returns empty list if no active non-revoked report cards exist', async () => {
      mockDbSelect.mockImplementationOnce(() => createChainableQuery(() => []));

      const req = new Request('http://localhost:3000/api/student/me/report-cards');
      const res = await getReportCards(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual([]);
    });

    it('another tenant sees nothing', async () => {
      currentContext = {
        ...studentContext,
        tenantId: tenantB,
      };

      mockDbSelect.mockImplementationOnce(() => createChainableQuery(() => []));

      const req = new Request('http://localhost:3000/api/student/me/report-cards');
      const res = await getReportCards(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual([]);
    });
  });

  describe('GET /api/student/me/report-cards/[id]/pdf', () => {
    it('returns PDF for student own active bulletin', async () => {
      const mockDoc = {
        id: 'doc-001',
        tenantId: tenantA,
        templateVersionId: 'tpl-v1',
        renderDataSnapshot: {
          title: 'Bulletin scolaire',
          studentName: 'Karim Atlas',
        },
      };

      const mockTemplateVersion = {
        id: 'tpl-v1',
        tenantId: tenantA,
        schemaJson: { basePdf: {}, schemas: [] },
      };

      mockDbSelect
        .mockImplementationOnce(() => createChainableQuery(() => [mockDoc]))
        .mockImplementationOnce(() => createChainableQuery(() => [mockTemplateVersion]));

      const req = new Request('http://localhost:3000/api/student/me/report-cards/doc-001/pdf');
      const res = await getReportCardPdf(req, { params: Promise.resolve({ id: 'doc-001' }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(res.headers.get('content-disposition')).toContain('bulletin-doc-001.pdf');
    });

    it('returns 404 if bulletin is not found, revoked, or belongs to another student', async () => {
      mockDbSelect.mockImplementationOnce(() => createChainableQuery(() => []));

      const req = new Request('http://localhost:3000/api/student/me/report-cards/foreign-id/pdf');
      const res = await getReportCardPdf(req, { params: Promise.resolve({ id: 'foreign-id' }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('rejects unauthorized roles with 403', async () => {
      currentContext = teacherContext;
      const req = new Request('http://localhost:3000/api/student/me/report-cards/doc-001/pdf');
      const res = await getReportCardPdf(req, { params: Promise.resolve({ id: 'doc-001' }) });
      expect(res.status).toBe(403);
    });
  });
});
