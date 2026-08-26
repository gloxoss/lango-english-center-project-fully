import { and, eq, gt, isNotNull, lt } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { db } from '@/libs/DB';
import { licensePayments, schoolLicenses, tenants } from '@/models/Schema';

const POLL_INTERVAL_MS = 3 * 60 * 60 * 1000;

// Background system actor for audit entries written outside a request context.
function systemContext(tenantId: string): RequestContext {
  return {
    userId: 'system',
    tenantId,
    branchId: null,
    role: 'super_admin',
    baseRole: 'super_admin',
    name: 'Système',
    email: 'system@schoolos.local',
  };
}

// Suspends any tenant whose active license has passed its expiresAt with no
// paid renewal extending it. Mirrors the settings-worker cross-tenant scan: a
// background system process, not a user request.
export async function runLicenseExpirySweep(): Promise<{ suspended: number }> {
  const now = new Date().toISOString();

  const expired = await db
    .select({
      id: schoolLicenses.id,
      tenantId: schoolLicenses.tenantId,
      expiresAt: schoolLicenses.expiresAt,
    })
    .from(schoolLicenses)
    .where(
      and(
        eq(schoolLicenses.status, 'active'),
        isNotNull(schoolLicenses.expiresAt),
        lt(schoolLicenses.expiresAt, now),
      ),
    );

  let suspended = 0;
  for (const license of expired) {
    // Defensive: skip if a paid renewal already extends this tenant past now
    // (guards against a stale expiresAt on the license row).
    const [renewal] = await db
      .select({ id: licensePayments.id })
      .from(licensePayments)
      .where(
        and(
          eq(licensePayments.tenantId, license.tenantId),
          eq(licensePayments.status, 'paid'),
          isNotNull(licensePayments.expiresAtAtPurchase),
          gt(licensePayments.expiresAtAtPurchase, now),
        ),
      )
      .limit(1);
    if (renewal) continue;

    const [updated] = await db
      .update(tenants)
      .set({ subscriptionStatus: 'suspended' })
      .where(and(eq(tenants.id, license.tenantId), eq(tenants.subscriptionStatus, 'active')))
      .returning({ id: tenants.id });

    if (updated) {
      recordAudit(systemContext(license.tenantId), 'update', 'tenant', license.tenantId, {
        action: 'license_expired',
        licenseId: license.id,
        expiresAt: license.expiresAt,
      });
      suspended += 1;
    }
  }

  return { suspended };
}

let started = false;

// Singleton in-process poller, same pattern as settings-worker. The `started`
// guard prevents duplicate intervals if register() is ever invoked more than
// once. Fail-open: a sweep failure must never affect request handling.
export function startLicenseExpiryWorker(): void {
  if (started) {
    return;
  }
  started = true;

  setInterval(() => {
    runLicenseExpirySweep().catch(err => console.error('[license-expiry-worker] sweep failed:', err));
  }, POLL_INTERVAL_MS);
}
