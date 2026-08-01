import { asc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { tenants } from './Schema';

const DEFAULT_TENANT_SLUG = 'atlas';

// ponytail: the routes need a tenant id and there is no session wiring yet - the
// previous SQLite code hardcoded 'SCH-01' for the same reason. This resolves the
// seeded tenant instead, so queries are genuinely scoped (CLAUDE.md rule 2) rather
// than reading across all tenants. Replace the body with a lookup from the
// better-auth session once login exists; every caller keeps working.
let cached: string | undefined;

export async function getDefaultTenantId(): Promise<string> {
  if (cached) {
    return cached;
  }

  const [bySlug] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, DEFAULT_TENANT_SLUG))
    .limit(1);

  if (bySlug) {
    cached = bySlug.id;
    return cached;
  }

  // Fall back to the oldest tenant so a database seeded under a different slug
  // still works rather than throwing on every request.
  const [oldest] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .orderBy(asc(tenants.createdAt))
    .limit(1);

  if (!oldest) {
    throw new Error(
      'No tenant exists. Run `npm run db:seed` before using the students/users API.',
    );
  }

  cached = oldest.id;
  return cached;
}
