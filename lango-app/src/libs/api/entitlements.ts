import { and, eq } from 'drizzle-orm';
import { ADDONS } from '@/addons/registry';
import { db } from '@/libs/DB';
import { addonEntitlements } from '@/models/Schema';
import { ApiError } from './errors';

export type Entitlement = {
  addonId: string;
  isEnabled: boolean;
  expiresAt: string | null;
  active: boolean;
};

const KNOWN_ADDON_IDS = new Set(ADDONS.map(a => a.id));

export function assertKnownAddon(addonId: string): void {
  if (!KNOWN_ADDON_IDS.has(addonId)) {
    throw new ApiError(422, 'UNKNOWN_ADDON', `Module inconnu: ${addonId}.`);
  }
}

export function isActive(row: { isEnabled: boolean; expiresAt: string | null }): boolean {
  if (!row.isEnabled) {
    return false;
  }
  // expiresAt is a date-only-ish timestamp string; compare as instants.
  return !row.expiresAt || new Date(row.expiresAt).getTime() > Date.now();
}

export async function listEntitlements(tenantId: string): Promise<Entitlement[]> {
  const rows = await db
    .select({
      addonId: addonEntitlements.addonId,
      isEnabled: addonEntitlements.isEnabled,
      expiresAt: addonEntitlements.expiresAt,
    })
    .from(addonEntitlements)
    .where(eq(addonEntitlements.tenantId, tenantId));

  return rows.map(r => ({ ...r, active: isActive(r) }));
}

export async function hasAddon(tenantId: string, addonId: string): Promise<boolean> {
  const [row] = await db
    .select({ isEnabled: addonEntitlements.isEnabled, expiresAt: addonEntitlements.expiresAt })
    .from(addonEntitlements)
    .where(and(eq(addonEntitlements.tenantId, tenantId), eq(addonEntitlements.addonId, addonId)))
    .limit(1);

  return Boolean(row && isActive(row));
}

/**
 * Gate an addon route. Call right after requireTenant().
 * No entitlement row, disabled row, or expired row all deny identically -
 * the caller learns "not activated", never which of the three it was.
 */
export async function requireAddon(tenantId: string, addonId: string): Promise<void> {
  assertKnownAddon(addonId);
  if (!(await hasAddon(tenantId, addonId))) {
    throw new ApiError(
      403,
      'ADDON_NOT_ACTIVATED',
      'Ce module n\'est pas activé pour votre établissement.',
    );
  }
}
