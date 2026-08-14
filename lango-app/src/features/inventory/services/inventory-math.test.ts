import { describe, expect, it } from 'vitest';
import { milliToQty, qtyFromInput, qtyTimesPrice, qtyTimesRatio, qtyToMilli } from './inventory-math';

describe('qtyToMilli / milliToQty round-trips', () => {
  it('parses integer, decimal and 3-decimal quantities', () => {
    expect(qtyToMilli('12')).toBe(BigInt(12000));
    expect(qtyToMilli('12.5')).toBe(BigInt(12500));
    expect(qtyToMilli('12.345')).toBe(BigInt(12345));
    expect(qtyToMilli('0.5')).toBe(BigInt(500));
    expect(qtyToMilli('0')).toBe(BigInt(0));
  });
  it('serializes back to canonical trimmed strings', () => {
    expect(milliToQty(BigInt(12345))).toBe('12.345');
    expect(milliToQty(BigInt(12000))).toBe('12');
    expect(milliToQty(BigInt(500))).toBe('0.5');
    expect(milliToQty(BigInt(0))).toBe('0');
    expect(milliToQty(BigInt(-2000))).toBe('-2');
  });
  it('rejects malformed or negative quantities', () => {
    expect(() => qtyToMilli('abc')).toThrow();
    expect(() => qtyToMilli('-1')).toThrow();
    expect(() => qtyToMilli('12.3456')).toThrow();
  });
  it('qtyFromInput accepts finite numbers', () => {
    expect(qtyFromInput(2.5)).toBe(BigInt(2500));
    expect(qtyFromInput('2.5')).toBe(BigInt(2500));
    expect(() => qtyFromInput(-1)).toThrow();
  });
});

describe('qty × price → cents (no float drift)', () => {
  it('computes line totals in cents with half-up rounding', () => {
    expect(qtyTimesPrice(BigInt(2000), BigInt(1250))).toBe(BigInt(2500)); // 2 × 12.50 = 25.00
    expect(qtyTimesPrice(BigInt(1000), BigInt(999))).toBe(BigInt(999));   // 1 × 9.99 = 9.99
    expect(qtyTimesPrice(BigInt(3000), BigInt(100))).toBe(BigInt(300));   // 3 × 1.00 = 3.00
    // 0.333 × 10.00 = 3.33 (half-up on the 3rd decimal)
    expect(qtyTimesPrice(BigInt(333), BigInt(1000))).toBe(BigInt(333));
  });
});

describe('qty × unitRatio → base qty', () => {
  it('converts purchase units to sale units via ratio', () => {
    // 2 purchase units × 12 sale-units-per-purchase-unit = 24 sale units
    expect(qtyTimesRatio(BigInt(2000), BigInt(12000))).toBe(BigInt(24000));
    // 1.5 purchase units × 1.0 = 1.5
    expect(qtyTimesRatio(BigInt(1500), BigInt(1000))).toBe(BigInt(1500));
    // half carton: 0.5 × 24 = 12
    expect(qtyTimesRatio(BigInt(500), BigInt(24000))).toBe(BigInt(12000));
  });
});
