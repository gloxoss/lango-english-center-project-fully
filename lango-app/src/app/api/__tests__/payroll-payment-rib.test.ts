import { describe, expect, it } from 'vitest';
import { isBankPaymentMethod, missingBankRibCount } from '@/features/workforce/services/payment-bank';

describe('bank payment recipients', () => {
  it('counts missing employee profiles, empty RIBs and whitespace-only RIBs', () => {
    expect(missingBankRibCount([
      { bankRib: null },
      { bankRib: '' },
      { bankRib: '   ' },
      { bankRib: '123456789012345678901234' },
    ])).toBe(3);
  });
  it('recognizes current and legacy bank batch methods', () => {
    expect(isBankPaymentMethod('bank')).toBe(true);
    expect(isBankPaymentMethod('bank_transfer')).toBe(true);
    expect(isBankPaymentMethod('cash')).toBe(false);
  });
});
