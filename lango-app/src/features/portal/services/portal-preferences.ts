import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { portalPreferences } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Portal preferences — tenant+user scoped, key allowlisted. A key outside the
// allowlist is rejected so clients can never stash arbitrary JSON server-side.
// ---------------------------------------------------------------------------

export const PORTAL_PREFERENCE_KEYS = [
  'locale',
  'theme',
  'navCollapsed',
  'notificationsEnabled',
  // Parent Portal consent flags (P7) — stored under the same allowlisted
  // preferences table so there is exactly one PATCH write path for parent
  // settings, tenant+user scoped, and no client-stashed arbitrary JSON.
  'contactConsent',
  'mediaConsent',
  'transportConsent',
  'hostelConsent',
  'eventConsent',
] as const;
export type PortalPreferenceKey = (typeof PORTAL_PREFERENCE_KEYS)[number];

function isAllowedKey(key: string): key is PortalPreferenceKey {
  return (PORTAL_PREFERENCE_KEYS as readonly string[]).includes(key);
}

export async function getPortalPreferences(tenantId: string, userId: string, key?: string) {
  const scope = and(
    eq(portalPreferences.tenantId, tenantId),
    eq(portalPreferences.userId, userId),
  );
  const rows = key
    ? await db.select().from(portalPreferences).where(and(scope, eq(portalPreferences.prefKey, key)))
    : await db.select().from(portalPreferences).where(scope);

  return rows.map((r) => ({ key: r.prefKey, value: r.value }));
}

export async function setPortalPreference(tenantId: string, userId: string, key: string, value: unknown): Promise<void> {
  if (!isAllowedKey(key)) {
    throw new ApiError(400, 'INVALID_PREFERENCE_KEY', 'Clé de préférence inconnue.');
  }

  const now = new Date().toISOString();
  const [existing] = await db
    .select({ id: portalPreferences.id })
    .from(portalPreferences)
    .where(
      and(
        eq(portalPreferences.tenantId, tenantId),
        eq(portalPreferences.userId, userId),
        eq(portalPreferences.prefKey, key),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(portalPreferences)
      .set({ value, updatedAt: now })
      .where(eq(portalPreferences.id, existing.id));
  } else {
    await db.insert(portalPreferences).values({
      tenantId,
      userId,
      prefKey: key,
      value,
      updatedAt: now,
    });
  }
}
