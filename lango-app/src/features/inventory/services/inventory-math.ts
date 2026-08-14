// Decimal-safe inventory arithmetic.
//
// Money follows @/libs/finance/money (cents, BigInt). Quantities are stored as
// numeric(14,3) and represented here as millis (thousandths) BigInt — the same
// scaled-int discipline as money, so no float drift ever reaches a line total.
// Every stock-document total is computed server-side from these primitives.
import { ApiError } from '@/libs/api/errors';
import { moneyToCents } from '@/libs/finance/money';

const QTY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;

const THOUSAND = BigInt(1000);
const HALF = BigInt(500);
const ZERO = BigInt(0);

/** "12.345" | "12" | "0.5" → 12345 (thousandths). Throws 400 on bad/negative. */
export function qtyToMilli(value: string): bigint {
  if (!QTY_PATTERN.test(value)) {
    throw new ApiError(400, 'INVALID_QUANTITY', 'La quantité doit être un nombre décimal positif avec trois décimales au maximum.');
  }
  const [units = '0', fraction = ''] = value.split('.');
  return BigInt(units) * THOUSAND + BigInt(fraction.padEnd(3, '0'));
}

/** 12345 → "12.345"; 12000 → "12"; -2000 → "-2". Trimmed, canonical. */
export function milliToQty(value: bigint): string {
  const sign = value < ZERO ? '-' : '';
  const absolute = value < ZERO ? -value : value;
  const whole = absolute / THOUSAND;
  const frac = absolute % THOUSAND;
  const fracStr = frac.toString().padStart(3, '0').replace(/0+$/, '');
  return `${sign}${whole}${fracStr ? `.${fracStr}` : ''}`;
}

/** Accept a client quantity as decimal string or finite number. */
export function qtyFromInput(input: string | number): bigint {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) {
      throw new ApiError(400, 'INVALID_QUANTITY', 'Quantité invalide.');
    }
    return qtyToMilli(input.toFixed(3));
  }
  return qtyToMilli(input);
}

/** qty_base = qty(purchase units) × unitRatio(sale-units per purchase-unit), half-up. */
export function qtyTimesRatio(qtyMilli: bigint, ratioMilli: bigint): bigint {
  return (qtyMilli * ratioMilli + HALF) / THOUSAND;
}

/** line total in cents = qty(units) × unitPrice, half-up. */
export function qtyTimesPrice(qtyMilli: bigint, priceCents: bigint): bigint {
  return (qtyMilli * priceCents + HALF) / THOUSAND;
}

/** Convenience: qty string/number × money string → cents. */
export function lineTotalFromInputs(qtyInput: string | number, priceInput: string): bigint {
  return qtyTimesPrice(qtyFromInput(qtyInput), moneyToCents(priceInput));
}

/** Negate a qty millis for a compensating movement. */
export function negateQty(qtyMilli: bigint): bigint {
  return -qtyMilli;
}
