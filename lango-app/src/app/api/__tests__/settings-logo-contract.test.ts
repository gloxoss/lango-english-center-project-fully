import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';

// Regression: /dashboard/settings/onboarding issued GET /api/settings/logo?t=...
// that answered 404 on every load.
//
// tenants.logoUrl is only a claim. The settings page treated a non-empty value
// as "there is a logo" and rendered an <img> at the logo endpoint, which serves
// the tenant's uploaded FILE and can only 404 when none exists. The seeded
// tenant names /uploads/seed/atlas-logo.png, which exists nowhere - neither in
// public/ nor in the tenant's upload directory.
//
// The page now asks uploadedFileExists() instead of trusting the column. This
// test pins both halves of that bargain: the flag the page reads and the status
// the endpoint returns must agree, in both directions.
const UPLOADS_DIR = path.join(os.tmpdir(), `lango-logo-test-${crypto.randomUUID()}`);
process.env.UPLOADS_DIR = UPLOADS_DIR;

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const tenantId = crypto.randomUUID();
const ADMIN_ID = `USR-${crypto.randomUUID()}`;

describe.skipIf(!dbReachable)('GET /api/settings/logo agrees with the page’s hasLogo', () => {
  let uploadedFileExists: (tenantId: string, subpath: string) => Promise<boolean>;

  beforeAll(async () => {
    await mkdir(path.join(UPLOADS_DIR, tenantId), { recursive: true });
    // Imported after UPLOADS_DIR is set: UPLOADS_ROOT is read at module load.
    uploadedFileExists = (await import('@/libs/api/uploads')).uploadedFileExists;
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Admin',
      email: 'admin@test.local',
    } as RequestContext);

    await db.insert(tenants).values({
      id: tenantId,
      name: 'Logo Contract Test',
      slug: `logo-${tenantId}`,
      // Exactly what the seeder writes: a path to an asset that is not there.
      logoUrl: '/uploads/seed/atlas-logo.png',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await rm(UPLOADS_DIR, { recursive: true, force: true });
  });

  it('reports no logo when the column names a file that does not exist', async () => {
    const { GET } = await import('@/app/api/settings/logo/route');

    // The page reads this flag to decide whether to render the <img> at all.
    expect(await uploadedFileExists(tenantId, 'logo.png')).toBe(false);

    const res = await GET(new Request('http://localhost/api/settings/logo'));
    expect(res.status).toBe(404);
  });

  it('reports a logo once the file is really there, and serves it', async () => {
    // A 1x1 PNG: enough for the endpoint to answer with real bytes.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await writeFile(path.join(UPLOADS_DIR, tenantId, 'logo.png'), png);

    expect(await uploadedFileExists(tenantId, 'logo.png')).toBe(true);

    const { GET } = await import('@/app/api/settings/logo/route');
    const res = await GET(new Request('http://localhost/api/settings/logo'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });
});
