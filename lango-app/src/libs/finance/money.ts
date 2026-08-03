import { ApiError } from '@/libs/api/errors';

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export function moneyToCents(value: string): bigint {
  if (!MONEY_PATTERN.test(value)) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Le montant doit être un nombre décimal positif avec deux décimales au maximum.');
  }
  const [units = '0', fraction = ''] = value.split('.');
  return BigInt(units) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}

export function centsToMoney(value: bigint): string {
  const zero = BigInt(0);
  const hundred = BigInt(100);
  const sign = value < zero ? '-' : '';
  const absolute = value < zero ? -value : value;
  return `${sign}${absolute / hundred}.${String(absolute % hundred).padStart(2, '0')}`;
}

export function normalizeMoney(value: string): string {
  return centsToMoney(moneyToCents(value));
}
