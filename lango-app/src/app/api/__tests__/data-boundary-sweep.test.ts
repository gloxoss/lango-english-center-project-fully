import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Audit 3, P0-E: several staff finance and student-admin routes gated only by
// a capability that parents and students hold (finance.read / students.read),
// letting any family read other families' money. This sweep walks every route
// under src/app/api/{finance,students,hr,academics}, calls GET as a parent and
// as a student, and demands 403 — unless the route is on the documented
// self-service allowlist below.

let currentSessionUserId: string | null = null;
vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId }, session: { id: 'sweep-session' } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { tenants, user } = await import('@/models/Schema');

const hasDb = Boolean(process.env.DATABASE_URL);

// Routes where parent/student role is legitimately accepted by design
// (self-service portals and student exam flow). Anything not listed here must
// 403 a parent/student session.
const SELF_SERVICE_ALLOWLIST = [
  // student online-exam flow
  'academics/online-exams/submit/route.ts',
  'academics/online-exams/[examId]/take/route.ts',
  // school syllabus content — families are an intended audience
  'academics/syllabus/route.ts',
  // homework detail serves the student's own assignments (student role by design)
  'academics/homework/[id]/route.ts',
  // employee self-service (caller-scoped: own payslips, own balances,
  // own eligibility) — a parent sees only their own (empty) rows
  'hr/payslips/route.ts',
  'hr/payslips/[id]/route.ts',
  'hr/leave/balances/route.ts',
  'hr/me/self-service-eligibility/route.ts',
];

const SWEPT_ROOTS = ['finance', 'students', 'hr', 'academics'];

function findRouteFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  let list: fs.Dirent[];
  try {
    list = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of list) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findRouteFiles(full, baseDir));
    else if (entry.isFile() && entry.name === 'route.ts') {
      results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return results;
}

describe.skipIf(!hasDb)('P0-E parent/student data-boundary sweep', () => {
  const suffix = Date.now();
  const tenantId = crypto.randomUUID();
  const parentId = `SWEEP-PARENT-${suffix}`;
  const studentId = `SWEEP-STUDENT-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Boundary Sweep School', slug: `sweep-${suffix}` });
    await db.insert(user).values([
      { id: parentId, tenantId, name: 'Sweep Parent', email: `sweep-p-${suffix}@test.local`, role: 'parent', userStatus: 'active' },
      { id: studentId, tenantId, name: 'Sweep Student', email: `sweep-s-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
  const routes = SWEPT_ROOTS.flatMap(root => findRouteFiles(path.join(apiDir, root)).map(rel => `${root}/${rel}`));

  const ABSENT_ID = '00000000-0000-0000-0000-000000000000';
  function paramsFor(relPath: string): { params: Promise<Record<string, string>> } | undefined {
    const names = [...relPath.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)].map(m => m[1]!);
    if (names.length === 0) return undefined;
    return { params: Promise.resolve(Object.fromEntries(names.map(n => [n, ABSENT_ID]))) };
  }

  it('found a meaningful number of routes to sweep', () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  for (const rel of routes) {
    const isSelfService = SELF_SERVICE_ALLOWLIST.some(a => rel === a || rel.startsWith(a));

    it(`parent session on GET /api/${rel.replace('/route.ts', '')} -> 403${isSelfService ? ' (self-service: exempt)' : ''}`, async () => {
      const mod = await import(`../${rel.replace('.ts', '')}`);
      if (!mod.GET) return;
      currentSessionUserId = parentId;
      const res = await mod.GET(new Request(`http://localhost/api/${rel.replace('/route.ts', '')}`), paramsFor(rel));
      if (isSelfService) {
        expect(res.status).not.toBe(500);
      } else {
        expect(res.status).toBe(403);
      }
    });

    it(`student session on GET /api/${rel.replace('/route.ts', '')} -> 403${isSelfService ? ' (self-service: exempt)' : ''}`, async () => {
      const mod = await import(`../${rel.replace('.ts', '')}`);
      if (!mod.GET) return;
      currentSessionUserId = studentId;
      const res = await mod.GET(new Request(`http://localhost/api/${rel.replace('/route.ts', '')}`), paramsFor(rel));
      if (isSelfService) {
        expect(res.status).not.toBe(500);
      } else {
        expect(res.status).toBe(403);
      }
    });
  }
});
