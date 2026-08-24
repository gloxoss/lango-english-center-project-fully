import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { listAddonDefinitions } from '@/libs/api/addon-catalog';
import { listEntitlements } from '@/libs/api/entitlements';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { licensePayments, schoolLicenses, tenants } from '@/models/Schema';

export type LicenseStatus = 'active' | 'expiring' | 'expired' | 'suspended' | 'cancelled' | 'none';

export type LicenseRow = {
  id: string;
  tenantId: string;
  licenseKey: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  lastUpgradeAt: string | null;
  notes: string | null;
  issuedById: string | null;
};

export type PaymentRow = {
  id: string;
  tenantId: string;
  licenseId: string | null;
  planTier: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  transactionRef: string | null;
  purchasedAt: string | null;
  expiresAtAtPurchase: string | null;
  requestedMonths: number | null;
  requestedById: string | null;
  createdAt: string | null;
};

const EXPIRING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function generateLicenseKey(): string {
  const block = () => randomBytes(4).toString('hex').toUpperCase();
  return `SCHOOLOS-${block()}-${block()}-${block()}`;
}

export function deriveLicenseStatus(license: { status: string; expiresAt: string | null } | null): LicenseStatus {
  if (!license) return 'none';
  if (license.status === 'suspended') return 'suspended';
  if (license.status === 'cancelled') return 'cancelled';
  if (license.expiresAt) {
    const exp = new Date(license.expiresAt).getTime();
    if (exp <= Date.now()) return 'expired';
    if (exp - Date.now() < EXPIRING_WINDOW_MS) return 'expiring';
  }
  return 'active';
}

export async function getSchoolLicense(tenantId: string): Promise<LicenseRow | null> {
  const [row] = await db
    .select()
    .from(schoolLicenses)
    .where(eq(schoolLicenses.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

export async function listTenantPayments(tenantId: string): Promise<PaymentRow[]> {
  const rows = await db
    .select()
    .from(licensePayments)
    .where(eq(licensePayments.tenantId, tenantId))
    .orderBy(desc(licensePayments.createdAt));
  return rows;
}

export async function listPendingPayments(): Promise<PaymentRow[]> {
  const rows = await db
    .select()
    .from(licensePayments)
    .where(eq(licensePayments.status, 'pending'))
    .orderBy(desc(licensePayments.createdAt));
  return rows;
}

// One shape shared by the school-facing page and the super-admin per-school
// detail: tenant identity, the license (with derived display status), the
// payment ledger, and the addon catalog joined with this tenant's grants.
export async function getSubscriptionDetail(tenantId: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) throw new ApiError(404, 'NOT_FOUND', 'Établissement introuvable.');

  const [license, payments, grants, addons] = await Promise.all([
    getSchoolLicense(tenantId),
    listTenantPayments(tenantId),
    listEntitlements(tenantId),
    listAddonDefinitions(),
  ]);

  const grantById = new Map(grants.map(g => [g.addonId, g]));

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      planTier: tenant.planTier,
      subscriptionStatus: tenant.subscriptionStatus,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
    },
    license: license
      ? {
          id: license.id,
          licenseKey: license.licenseKey,
          status: license.status,
          issuedAt: license.issuedAt,
          expiresAt: license.expiresAt,
          lastUpgradeAt: license.lastUpgradeAt,
          notes: license.notes,
        }
      : null,
    licenseStatus: deriveLicenseStatus(license),
    payments: payments.map(p => ({
      id: p.id,
      planTier: p.planTier,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: p.status,
      transactionRef: p.transactionRef,
      purchasedAt: p.purchasedAt,
      expiresAtAtPurchase: p.expiresAtAtPurchase,
      requestedMonths: p.requestedMonths,
      createdAt: p.createdAt,
    })),
    addons: addons.map(addon => {
      const grant = grantById.get(addon.id);
      return {
        addonId: addon.id,
        name: addon.name,
        description: addon.description,
        built: addon.enabled,
        active: Boolean(grant && grant.active),
        expiresAt: grant?.expiresAt ?? null,
      };
    }),
  };
}

export async function listSchoolsWithLicenses() {
  const [rows, pending] = await Promise.all([
    db
      .select({
        tenant: {
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          planTier: tenants.planTier,
          subscriptionStatus: tenants.subscriptionStatus,
          isActive: tenants.isActive,
        },
        license: {
          id: schoolLicenses.id,
          licenseKey: schoolLicenses.licenseKey,
          status: schoolLicenses.status,
          issuedAt: schoolLicenses.issuedAt,
          expiresAt: schoolLicenses.expiresAt,
          lastUpgradeAt: schoolLicenses.lastUpgradeAt,
          notes: schoolLicenses.notes,
        },
      })
      .from(tenants)
      .leftJoin(schoolLicenses, eq(schoolLicenses.tenantId, tenants.id)),
    listPendingPayments(),
  ]);

  const pendingByTenant = new Map<string, number>();
  for (const p of pending) {
    pendingByTenant.set(p.tenantId, (pendingByTenant.get(p.tenantId) ?? 0) + 1);
  }

  const schools = rows.map(({ tenant, license }) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    planTier: tenant.planTier,
    subscriptionStatus: tenant.subscriptionStatus,
    isActive: tenant.isActive,
    license: license ? {
      id: license.id,
      licenseKey: license.licenseKey,
      status: license.status,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt,
      lastUpgradeAt: license.lastUpgradeAt,
    } : null,
    licenseStatus: deriveLicenseStatus(license),
    pendingPaymentsCount: pendingByTenant.get(tenant.id) ?? 0,
  }));

  const count = (s: string) => schools.filter(x => x.licenseStatus === s).length;
  const summary = {
    total: schools.length,
    active: count('active'),
    expiring: count('expiring'),
    expired: count('expired'),
    suspended: count('suspended'),
    cancelled: count('cancelled'),
    none: count('none'),
    pendingPayments: pending.length,
  };

  return { schools, summary };
}

function monthsFromNow(months: number, base?: string | null): string {
  const start = base ? new Date(base) : new Date();
  if (base && start.getTime() > Date.now()) {
    start.setUTCMonth(start.getUTCMonth() + months);
    return start.toISOString();
  }
  const now = new Date();
  now.setUTCMonth(now.getUTCMonth() + months);
  return now.toISOString();
}

export async function issueLicense(
  ctx: RequestContext,
  tenantId: string,
  opts: { months?: number; expiresAt?: string | null; note?: string | null },
): Promise<LicenseRow> {
  const existing = await getSchoolLicense(tenantId);
  const expiresAt = opts.expiresAt ?? (opts.months ? monthsFromNow(opts.months) : null);

  if (existing) {
    const [row] = await db
      .update(schoolLicenses)
      .set({
        status: 'active',
        expiresAt: expiresAt ?? existing.expiresAt,
        lastUpgradeAt: new Date().toISOString(),
        notes: opts.note ?? existing.notes,
        issuedById: ctx.userId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schoolLicenses.id, existing.id))
      .returning();
    recordAudit({ ...ctx, tenantId }, 'update', 'school_license', row!.id, {
      action: 'issue',
      expiresAt,
      note: opts.note,
    });
    return row!;
  }

  const [row] = await db
    .insert(schoolLicenses)
    .values({
      tenantId,
      licenseKey: generateLicenseKey(),
      status: 'active',
      issuedAt: new Date().toISOString(),
      expiresAt,
      lastUpgradeAt: new Date().toISOString(),
      notes: opts.note ?? null,
      issuedById: ctx.userId,
    })
    .returning();
  recordAudit({ ...ctx, tenantId }, 'create', 'school_license', row!.id, {
    action: 'issue',
    expiresAt,
    note: opts.note,
  });
  return row!;
}

export async function extendLicense(
  ctx: RequestContext,
  tenantId: string,
  months: number,
): Promise<LicenseRow> {
  const existing = await getSchoolLicense(tenantId);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Aucune licence existante pour cet établissement.');

  const expiresAt = monthsFromNow(months, existing.expiresAt);
  const [row] = await db
    .update(schoolLicenses)
    .set({
      status: 'active',
      expiresAt,
      lastUpgradeAt: new Date().toISOString(),
      issuedById: ctx.userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schoolLicenses.id, existing.id))
    .returning();
  recordAudit({ ...ctx, tenantId }, 'update', 'school_license', row!.id, {
    action: 'extend',
    months,
    expiresAt,
  });
  return row!;
}

export async function revokeLicense(ctx: RequestContext, tenantId: string): Promise<LicenseRow> {
  const existing = await getSchoolLicense(tenantId);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Aucune licence existante pour cet établissement.');

  const [row] = await db
    .update(schoolLicenses)
    .set({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schoolLicenses.id, existing.id))
    .returning();
  recordAudit({ ...ctx, tenantId }, 'update', 'school_license', row!.id, { action: 'revoke' });
  return row!;
}

// A school-admin renewal request. Creates a pending license_payment the
// super-admin approves or rejects — the honest "Renew" action without a
// payment gateway (SUBSCRIPTION-AND-LICENSING-SYSTEM.md, open question #2).
export async function requestRenewal(
  ctx: RequestContext,
  tenantId: string,
  opts: { months: number; note?: string },
): Promise<PaymentRow> {
  const [tenant] = await db
    .select({ planTier: tenants.planTier })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) throw new ApiError(404, 'NOT_FOUND', 'Établissement introuvable.');

  const [row] = await db
    .insert(licensePayments)
    .values({
      tenantId,
      planTier: tenant.planTier,
      amount: '0',
      method: 'bank_transfer',
      status: 'pending',
      requestedMonths: opts.months,
      requestedById: ctx.userId,
    })
    .returning();
  recordAudit(ctx, 'create', 'license_payment', row!.id, {
    kind: 'renewal_request',
    months: opts.months,
    note: opts.note,
  });
  return row!;
}

// Super-admin decides a pending payment. Approving records the payment as paid
// and extends the school license by the requested months; rejecting closes the
// request without touching the license.
export async function decidePayment(
  ctx: RequestContext,
  tenantId: string,
  paymentId: string,
  opts: { approved: boolean; amount?: number },
): Promise<PaymentRow> {
  const [payment] = await db
    .select()
    .from(licensePayments)
    .where(and(eq(licensePayments.id, paymentId), eq(licensePayments.tenantId, tenantId)))
    .limit(1);
  if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Paiement introuvable.');
  if (payment.status !== 'pending') {
    throw new ApiError(409, 'PAYMENT_ALREADY_DECIDED', 'Cette demande a déjà été traitée.');
  }

  if (!opts.approved) {
    const [row] = await db
      .update(licensePayments)
      .set({ status: 'rejected', recordedById: ctx.userId })
      .where(eq(licensePayments.id, payment.id))
      .returning();
    recordAudit({ ...ctx, tenantId }, 'update', 'license_payment', row!.id, { decision: 'rejected' });
    return row!;
  }

  const months = payment.requestedMonths ?? 1;
  let license = await getSchoolLicense(tenantId);
  if (!license) {
    license = await issueLicense(ctx, tenantId, { months });
  } else {
    license = await extendLicense(ctx, tenantId, months);
  }

  const [row] = await db
    .update(licensePayments)
    .set({
      status: 'paid',
      licenseId: license.id,
      amount: (opts.amount ?? 0).toFixed(2),
      purchasedAt: new Date().toISOString(),
      expiresAtAtPurchase: license.expiresAt,
      recordedById: ctx.userId,
    })
    .where(eq(licensePayments.id, payment.id))
    .returning();
  recordAudit({ ...ctx, tenantId }, 'update', 'license_payment', row!.id, {
    decision: 'approved',
    months,
    amount: opts.amount ?? 0,
  });
  return row!;
}
