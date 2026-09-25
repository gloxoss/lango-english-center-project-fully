import { beforeEach, describe, expect, it, vi } from 'vitest';

// Any teacher of the school could read another class's student documents
// (guardian CNI, birth certificate) and report cards. A teacher now only
// reaches the sections they teach; admins are unchanged.

const selectResults: unknown[][] = [];
let role = 'teacher';
const assignedSections = vi.fn(async () => ['sec-mine']);

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async () => ({ userId: 'u1', tenantId: 't1', role, branchId: null })),
  requireTenant: vi.fn(() => 't1'),
}));
vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
  requireAnyCapability: vi.fn(async () => undefined),
}));
vi.mock('@/libs/api/teacher-scope', () => ({ getTeacherClassSectionIds: assignedSections }));
vi.mock('@/features/academics/services/report-card-service', () => ({ getClassReportCards: vi.fn(async () => []) }));
vi.mock('@/libs/DB', () => ({
  db: {
    select: vi.fn(() => {
      const b: Record<string, unknown> = {};
      for (const m of ['from', 'where', 'innerJoin', 'leftJoin', 'orderBy']) {
        b[m] = () => b;
      }
      b.limit = async () => selectResults.shift() ?? [];
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve(selectResults.shift() ?? []).then(ok);
      return b;
    }),
  },
}));

const docs = await import('@/app/api/students/documents/route');
const reportCard = await import('@/app/api/students/report-card/route');

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;
  role = 'teacher';
});

describe('student documents', () => {
  it('refuses a teacher who does not teach the student', async () => {
    selectResults.push([{ id: 's1', branchId: null, classSectionId: 'sec-other' }]);
    const res = await docs.GET(new Request('http://localhost/api/students/documents?studentId=s1'));

    expect(res.status).toBe(403);
  });

  it('lets a teacher list documents of their own student', async () => {
    selectResults.push([{ id: 's1', branchId: null, classSectionId: 'sec-mine' }], []);
    const res = await docs.GET(new Request('http://localhost/api/students/documents?studentId=s1'));

    expect(res.status).toBe(200);
  });

  it('does not restrict an admin', async () => {
    role = 'school_admin';
    selectResults.push([{ id: 's1', branchId: null, classSectionId: 'sec-other' }], []);
    const res = await docs.GET(new Request('http://localhost/api/students/documents?studentId=s1'));

    expect(res.status).toBe(200);
    expect(assignedSections).not.toHaveBeenCalled();
  });

  it('refuses a teacher deleting another class’s document', async () => {
    selectResults.push([{ id: 's1', branchId: null, classSectionId: 'sec-other' }]);
    const res = await docs.DELETE(new Request('http://localhost/api/students/documents?studentId=s1&documentType=guardian_cni', { method: 'DELETE' }));

    expect(res.status).toBe(403);
  });
});

describe('report cards', () => {
  it('refuses a teacher asking for another class', async () => {
    const res = await reportCard.GET(new Request('http://localhost/api/students/report-card?classSectionId=sec-other'));

    expect(res.status).toBe(403);
  });

  it('refuses a teacher asking for a student of another class', async () => {
    selectResults.push([{ classSectionId: 'sec-other' }]);
    const res = await reportCard.GET(new Request('http://localhost/api/students/report-card?studentId=s9'));

    expect(res.status).toBe(403);
  });
});
