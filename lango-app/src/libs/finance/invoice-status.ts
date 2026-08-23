export type InvoicePaidStatus = 'pending' | 'partial' | 'paid';

/** Derive the paid-state status from cents balances (used by payment reversal
 *  and refund linkage, where an invoice's paidAmount can move down again). */
export function recomputePaidStatus(paidCents: bigint, netCents: bigint): InvoicePaidStatus {
  if (paidCents <= BigInt(0)) return 'pending';
  if (paidCents >= netCents) return 'paid';
  return 'partial';
}
