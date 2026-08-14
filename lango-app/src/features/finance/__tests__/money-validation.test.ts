import { describe, expect, it } from 'vitest';
import { moneyInput } from '@/libs/finance/validation';

describe('moneyInput', () => {
  it('accepts valid positive amounts as a string or a number', () => {
    expect(moneyInput.parse('12.50')).toBe('12.50');
    expect(moneyInput.parse('0.01')).toBe('0.01');
    expect(moneyInput.parse('123456789012.34')).toBe('123456789012.34');
    expect(moneyInput.parse('100')).toBe('100');
    expect(moneyInput.parse(100)).toBe('100.00');
    expect(moneyInput.parse(12.34)).toBe('12.34');
  });

  it('rejects zero, negative and malformed amounts', () => {
    expect(() => moneyInput.parse('0')).toThrow();
    expect(() => moneyInput.parse('0.00')).toThrow();
    expect(() => moneyInput.parse('-5')).toThrow();
    expect(() => moneyInput.parse('12.345')).toThrow();
    expect(() => moneyInput.parse('abc')).toThrow();
    expect(() => moneyInput.parse(0)).toThrow();
    expect(() => moneyInput.parse(-1)).toThrow();
  });
});
