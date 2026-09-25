import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { addonEntitlements } from '@/models/Schema';
import { getAddonDefinition, listAddonDefinitions } from './addon-catalog';
import { ApiError } from './errors';

export type Entitlement = {
  addonId: string;
  isEnabled: boolean;
  expiresAt: string | null;
  active: boolean;
};

export async function assertKnownAddon(addonId: string): Promise<void> {
  if (!(await getAddonDefinition(addonId))) {
    throw new ApiError(422, 'UNKNOWN_ADDON', `Module inconnu: ${addonId}.`);
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True once the paid period has actually ended.
 *
 * expiresAt comes in two shapes and they mean different things:
 *   - a date-only string ('2026-12-31', what the entitlement and licence
 *     screens submit via z.iso.date()) names a DAY the customer paid through,
 *     so it only expires at the end of that Casablanca business day. Reading
 *     it as an instant put the cut-off at 00:00 and pulled the module ~23h
 *     early on the last paid day.
 *   - a value carrying a time is an exact instant and is honoured to the second.
 *
 * Exported so the licence suspension worker uses the identical rule; if the two
 * ever drift, a tenant can be suspended while the gate still lets it in.
 */
export function isExpiredAt(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) {
    return false;
  }
  if (DATE_ONLY.test(expiresAt)) {
    return casablancaTodayIso(now) > expiresAt;
  }
  // A naive time-bearing value carries no offset, and `new Date(naive)` reads it
  // as SERVER-LOCAL, moving the cut-off by the host offset. Normalise to UTC the
  // way AUD-OPS-01 treats stored naive timestamps. Writers today send either a
  // date-only string or a Z-suffixed instant, so this is defensive.
  const isoish = expiresAt.trim().replace(' ', 'T');
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoish);
  return new Date(hasOffset ? isoish : `${isoish}Z`).getTime() < now.getTime();
}

export function isActive(row: { isEnabled: boolean; expiresAt: string | null }): boolean {
  if (!row.isEnabled) {
    return false;
  }
  return !isExpiredAt(row.expiresAt);
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
  await assertKnownAddon(addonId);
  if (!(await hasAddon(tenantId, addonId))) {
    throw new ApiError(
      403,
      'ADDON_NOT_ACTIVATED',
      'Ce module n\'est pas activé pour votre établissement.',
    );
  }
}

/**
 * Gate any payroll-workforce route. Enforces both the add-on entitlement and
 * its hard Human Resources dependency, so a payroll route can never run in a
 * tenant that lacks the employee-profile foundation.
 */
export async function requireWorkforceAddon(tenantId: string): Promise<void> {
  await requireAddon(tenantId, 'payroll-workforce');
  if (!(await hasAddon(tenantId, 'human-resources'))) {
    throw new ApiError(
      403,
      'ADDON_NOT_ACTIVATED',
      'Ce module requiert le module "human-resources" pour fonctionner.',
    );
  }
}

/**
 * Check that every add-on this one depends on is already entitled and active.
 * Called at activation time so an add-on can never be switched on without its
 * required foundation. `human-resources` is the hard dependency of
 * `payroll-workforce`; the same check also blocks an HR **deactivation** that
 * would strand an active payroll tenant (handled by callers passing the target
 * state).
 */
export async function assertAddonDependencies(tenantId: string, addonId: string, targetActive: boolean): Promise<void> {
  const def = await getAddonDefinition(addonId);
  if (!def) {
    throw new ApiError(422, 'UNKNOWN_ADDON', `Module inconnu: ${addonId}.`);
  }
  if (targetActive) {
    for (const dependencyId of def.requires ?? []) {
      await assertKnownAddon(dependencyId);
      if (!(await hasAddon(tenantId, dependencyId))) {
        throw new ApiError(
          409,
          'ADDON_DEPENDENCY_MISSING',
          `Le module "${def.name}" requiert le module "${dependencyId}" d'abord activé.`,
        );
      }
    }
    return;
  }
  // Deactivation: an add-on that others depend on cannot be turned off while a
  // dependent add-on is still active for this tenant.
  for (const dependent of await listAddonDefinitions()) {
    if ((dependent.requires ?? []).includes(addonId) && (await hasAddon(tenantId, dependent.id))) {
      throw new ApiError(
        409,
        'ADDON_DEPENDENCY_ACTIVE',
        `Le module "${addonId}" ne peut pas être désactivé tant que "${dependent.id}" est actif.`,
      );
    }
  }
}
