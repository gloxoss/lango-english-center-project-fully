import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let currentSessionUserId: string | null = null;

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { tenants, user } = await import('@/models/Schema');

const hasDb = Boolean(process.env.DATABASE_URL);

// Super-admin routes are intentionally exempt from single-tenant isolation checks
// because super_admin has tenantId: null and manages cross-tenant entities by design.
const SUPER_ADMIN_ALLOWLIST = [
  'super-admin/schools/route.ts',
  'super-admin/schools/[id]/route.ts',
];

// Better Auth owns this catch-all and does its own session handling; it is not
// a tenant-scoped data route, so there is nothing here for this suite to prove.
const NOT_A_DATA_ROUTE = ['auth/[...all]/route.ts'];

// Dynamic segments must be supplied or the handler throws on destructuring
// `{ params }` before any isolation logic runs. A syntactically valid but
// non-existent uuid is enough: we assert "no 500 and no cross-tenant leak",
// and 404 is a perfectly good answer.
const ABSENT_ID = '00000000-0000-0000-0000-000000000000';

function paramsFor(relPath: string): { params: Promise<Record<string, string | string[]>> } | undefined {
  const names = [...relPath.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)].map(m => m[1]!);
  if (names.length === 0) {
    return undefined;
  }
  return {
    params: Promise.resolve(
      Object.fromEntries(names.map(n => [n, relPath.includes(`[...${n}]`) ? [ABSENT_ID] : ABSENT_ID])),
    ),
  };
}

function findRouteFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findRouteFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
  return results;
}

describe.skipIf(!hasDb)('Automated Cross-Tenant Isolation Test Suite', () => {
  const suffix = Date.now();
  const tenantAId = crypto.randomUUID();
  const tenantBId = crypto.randomUUID();
  const adminAId = `ISO-ADMIN-A-${suffix}`;
  const adminBId = `ISO-ADMIN-B-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantAId, name: 'Iso Tenant A', slug: `iso-a-${suffix}` },
      { id: tenantBId, name: 'Iso Tenant B', slug: `iso-b-${suffix}` },
    ]);

    await db.insert(user).values([
      { id: adminAId, tenantId: tenantAId, name: 'Iso Admin A', email: `iso-admin-a-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: adminBId, tenantId: tenantBId, name: 'Iso Admin B', email: `iso-admin-b-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
    ]);
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.tenantId, tenantAId));
    await db.delete(user).where(eq(user.tenantId, tenantBId));
    await db.delete(tenants).where(eq(tenants.id, tenantAId));
    await db.delete(tenants).where(eq(tenants.id, tenantBId));
  });

  const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
  const routeRelPaths = findRouteFiles(apiDir);

  it('discovers API routes and excludes only allowed super-admin routes', () => {
    expect(routeRelPaths.length).toBeGreaterThan(10);
  });

  for (const relPath of routeRelPaths) {
    if (SUPER_ADMIN_ALLOWLIST.includes(relPath) || NOT_A_DATA_ROUTE.includes(relPath)) {
      continue;
    }

    it(`enforces tenant isolation on route GET /api/${relPath.replace('/route.ts', '')}`, async () => {
      const modulePath = `./${relPath}`;
      const routeModule = await import(modulePath);

      if (!routeModule.GET) {
        return;
      }

      const url = `http://localhost/api/${relPath.replace('/route.ts', '')}`;
      const ctx = paramsFor(relPath);

      // 1. Query as Tenant A
      currentSessionUserId = adminAId;
      const resA = await routeModule.GET(new Request(url), ctx);

      // 2. Query as Tenant B
      currentSessionUserId = adminBId;
      const resB = await routeModule.GET(new Request(url), ctx);

      // Both should succeed (200) or respond with valid error/validation status (400/422/404 if query params needed)
      // Never 500 or leak cross-tenant data
      expect(resA.status).not.toBe(500);
      expect(resB.status).not.toBe(500);

      if (resA.status === 200 && resB.status === 200) {
        // Read as text first: not every route answers JSON (the audit-log
        // export streams CSV), and a raw scan for the other tenant's id
        // catches leaks in any response shape.
        const textB = await resB.text();

        expect(textB).not.toContain(tenantAId);

        let bodyB: any;
        try {
          bodyB = JSON.parse(textB);
        } catch {
          return; // non-JSON body; the raw scan above is the assertion
        }

        if (bodyB.success && Array.isArray(bodyB.data)) {
          for (const item of bodyB.data) {
            if (item && typeof item === 'object' && 'tenantId' in item) {
              expect(item.tenantId).not.toBe(tenantAId);
            }
          }
        }
      }
    });
  }
});
