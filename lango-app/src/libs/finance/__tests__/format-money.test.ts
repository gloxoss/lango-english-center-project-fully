import { describe, expect, it } from 'vitest';
import { formatAmount, formatMoney } from '@/libs/finance/format-money';

// Intl uses a narrow no-break space as the fr-FR group separator.
const plain = (s: string) => s.replace(/[\u202F\u00A0]/g, ' ');

describe('formatMoney', () => {
  it('groups thousands and puts the currency last with exactly two decimals', () => {
    expect(plain(formatMoney(24000))).toBe('24 000,00 MAD');
    expect(plain(formatMoney('146746.5'))).toBe('146 746,50 MAD');
    expect(plain(formatMoney(1250))).toBe('1 250,00 MAD');
  });

  it('never shows float noise or invalid values', () => {
    expect(plain(formatAmount(0.1 + 0.2))).toBe('0,30');
    expect(formatAmount(null)).toBe('0,00');
    expect(formatAmount('not a number')).toBe('0,00');
  });
});
