// Finance adapter — the ONLY place the hostel module touches Finance tables.
// Finance stays authoritative: this boundary writes the hostel_charge_links
// ledger row first, then attempts to materialize a real invoice. Any Finance
// failure marks the link `failed` and raises FinanceUnavailableError — the
// caller decides whether the business operation may proceed (check-in/check-out
// always may; a failed charge can be retried later, never blocks the resident).
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { invoiceItems, invoices, namingSeries } from '@/models/Schema';
import { hostelChargeLinks } from '@/features/hostel/models/hostel-schema';
import { firstRow } from '@/features/hostel/server/db-utils';

export class FinanceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceUnavailableError';
  }
}

export type ChargeType = 'residence_fee' | 'deposit' | 'damage';

async function reserveInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  // Tenant-scoped prefix: namingSeries.prefix is a single GLOBAL primary key,
  // so a shared `HSTINV-YYYY-` prefix would hand different tenants the same
  // invoice numbers. Slicing the tenant id keeps numbers unique per tenant AND
  // lets the counter increment be a single atomic upsert — no read-modify-write
  // race on current_val under concurrent check-outs.
  const prefix = `HSTINV-${year}-${tenantId.slice(0, 8).toUpperCase()}-`;
  const row = firstRow(await db.insert(namingSeries)
    .values({ prefix, tenantId, currentVal: 1 })
    .onConflictDoUpdate({
      target: [namingSeries.tenantId, namingSeries.prefix],
      set: { currentVal: sql`${namingSeries.currentVal} + 1` },
    })
    .returning({ currentVal: namingSeries.currentVal }));
  return `${prefix}${String(row.currentVal).padStart(4, '0')}`;
}

async function createChargeLink(tenantId: string, data: {
  allocationId: string;
  chargeType: ChargeType;
  amount: string;
  feeStructureId?: string | null;
}): Promise<string> {
  const row = firstRow(await db.insert(hostelChargeLinks).values({
    tenantId,
    allocationId: data.allocationId,
    feeStructureId: data.feeStructureId ?? null,
    chargeType: data.chargeType,
    amount: data.amount,
    status: 'pending',
  }).returning({ id: hostelChargeLinks.id }));
  return row.id;
}

/**
 * Emit a residence charge. Records the ledger link, then materializes an
 * invoice. On any Finance failure: the link is marked `failed` (so the charge
 * is visible and retryable) and FinanceUnavailableError is raised.
 */
export async function emitCharge(tenantId: string, opts: {
  allocationId: string;
  studentId: string;
  chargeType: ChargeType;
  amount: string;
  feeStructureId?: string | null;
  description: string;
}): Promise<{ chargeLinkId: string; invoiceId: string; invoiceItemId: string }> {
  const chargeLinkId = await createChargeLink(tenantId, opts);
  try {
    const invoiceNumber = await reserveInvoiceNumber(tenantId);
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    const dueDate = `${due.getFullYear()}-${`${due.getMonth() + 1}`.padStart(2, '0')}-${`${due.getDate()}`.padStart(2, '0')}`;

    const invoice = firstRow(await db.insert(invoices).values({
      tenantId,
      studentId: opts.studentId,
      feeStructureId: opts.feeStructureId ?? null,
      invoiceNumber,
      amount: Number(opts.amount),
      discountAmount: 0,
      netAmount: Number(opts.amount),
      paidAmount: 0,
      dueDate,
    }).returning());

    const item = firstRow(await db.insert(invoiceItems).values({
      tenantId,
      invoiceId: invoice.id,
      description: opts.description,
      amount: Number(opts.amount),
    }).returning());

    await db.update(hostelChargeLinks)
      .set({ status: 'linked', invoiceId: invoice.id, invoiceItemId: item.id, updatedAt: new Date().toISOString() })
      .where(eq(hostelChargeLinks.id, chargeLinkId));

    return { chargeLinkId, invoiceId: invoice.id, invoiceItemId: item.id };
  } catch (error) {
    await db.update(hostelChargeLinks)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message.slice(0, 500) : 'Finance unavailable',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hostelChargeLinks.id, chargeLinkId))
      .catch(() => undefined);
    throw new FinanceUnavailableError('Le service financier est indisponible.');
  }
}

/**
 * Record a charge link as failed WITHOUT touching Finance — used only by the
 * explicit `simulateFinanceFailure` test hook so T6 (finance failure cannot
 * block emergency departure) is verifiable by hand. Never reached in normal
 * operation.
 */
export async function recordSimulatedFinanceFailure(tenantId: string, opts: {
  allocationId: string;
  chargeType: ChargeType;
  amount: string;
  feeStructureId?: string | null;
}): Promise<{ chargeLinkId: string }> {
  const chargeLinkId = await createChargeLink(tenantId, opts);
  await db.update(hostelChargeLinks)
    .set({
      status: 'failed',
      error: 'FinanceUnavailableError (simulated failure)',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(hostelChargeLinks.id, chargeLinkId));
  throw new FinanceUnavailableError('Le service financier est indisponible.');
}
