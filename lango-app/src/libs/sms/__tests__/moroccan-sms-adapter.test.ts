import { describe, expect, it } from 'vitest';
import {
  formatAbsenceSms,
  formatPaymentReminderSms,
  normalizeMoroccanPhone,
  sendMoroccanSms,
} from '../moroccan-sms-adapter';

describe('Moroccan SMS Adapter & Phone Normalizer (+212)', () => {
  it('normalizes local Moroccan numbers (06/07/05) to +212 E.164 format', () => {
    expect(normalizeMoroccanPhone('06 61 22 33 44')).toBe('+212661223344');
    expect(normalizeMoroccanPhone('0712345678')).toBe('+212712345678');
    expect(normalizeMoroccanPhone('05 22 11 22 33')).toBe('+212522112233');
    expect(normalizeMoroccanPhone('+212661223344')).toBe('+212661223344');
    expect(normalizeMoroccanPhone('00212661223344')).toBe('+212661223344');
  });

  it('formats absence alert SMS correctly', () => {
    const text = formatAbsenceSms('Youssef Benjelloun', '30 mai 2026');
    expect(text).toContain('Youssef Benjelloun');
    expect(text).toContain('30 mai 2026');
    expect(text).toContain('Lango Center');
  });

  it('formats payment reminder SMS correctly', () => {
    const text = formatPaymentReminderSms('Aya Benjelloun', 1200, '05 juin 2026');
    expect(text).toContain('Aya Benjelloun');
    expect(text).toContain('1200 MAD');
    expect(text).toContain('05 juin 2026');
  });

  it('dispatches SMS successfully with valid phone', async () => {
    const result = await sendMoroccanSms('06 61 22 33 44', 'Test message');
    expect(result.success).toBe(true);
    expect(result.normalizedPhone).toBe('+212661223344');
    expect(result.messageId).toContain('SMS-MA-');
  });

  it('throws an error for invalid phone numbers', async () => {
    await expect(sendMoroccanSms('123', 'Test')).rejects.toThrow();
  });
});
