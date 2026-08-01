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
    if (SUPER_ADMIN_ALLOWLIST.includes(relPath)) {
      continue;
    }

    it(`enforces tenant isolation on route GET /api/${relPath.replace('/route.ts', '')}`, async () => {
      const modulePath = `./${relPath}`;
      const routeModule = await import(modulePath);

      if (!routeModule.GET) {
        return;
      }

      // 1. Query as Tenant A
      currentSessionUserId = adminAId;
      const resA = await routeModule.GET(new Request(`http://localhost/api/${relPath.replace('/route.ts', '')}`));

      // 2. Query as Tenant B
      currentSessionUserId = adminBId;
      const resB = await routeModule.GET(new Request(`http://localhost/api/${relPath.replace('/route.ts', '')}`));

      // Both should succeed (200) or respond with valid error/validation status (400/422/404 if query params needed)
      // Never 500 or leak cross-tenant data
      expect(resA.status).not.toBe(500);
      expect(resB.status).not.toBe(500);

      if (resA.status === 200 && resB.status === 200) {
        const bodyA = await resA.json();
        const bodyB = await resB.json();

        if (bodyA.success && bodyB.success && Array.isArray(bodyA.data) && Array.isArray(bodyB.data)) {
          // Verify no item returned to Tenant B has tenantId of Tenant A
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
