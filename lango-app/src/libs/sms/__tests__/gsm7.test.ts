import { describe, it, expect } from 'vitest';
import {
  isGsm7String,
  getNonGsm7Characters,
  gsm7Length,
  analyzeSmsText,
  sanitizeToGsm7,
  isValidMoroccanMobile,
  formatMoroccanE164,
} from '../gsm7';

describe('Moroccan GSM-7 SMS Assistant', () => {
  it('identifies standard GSM-7 text correctly', () => {
    expect(isGsm7String('Bonjour Mme/M., rappel de paiement.')).toBe(true);
    expect(isGsm7String('Café déjà payé')).toBe(true); // à, é are standard GSM-7
  });

  it('flags non-GSM characters like circumflex and smart quotes', () => {
    expect(isGsm7String('Fête de fin d’année')).toBe(false); // ê and ’ are not in basic GSM-7
    const nonGsm = getNonGsm7Characters('Fête d’août');
    expect(nonGsm).toContain('ê');
    expect(nonGsm).toContain('’');
    expect(nonGsm).toContain('û');
  });

  it('correctly calculates segments for GSM-7 and UCS-2', () => {
    const textGsm = 'A'.repeat(160);
    const analysisGsm = analyzeSmsText(textGsm);
    expect(analysisGsm.encoding).toBe('gsm7');
    expect(analysisGsm.segments).toBe(1);

    const textGsm2 = 'A'.repeat(161);
    const analysisGsm2 = analyzeSmsText(textGsm2);
    expect(analysisGsm2.encoding).toBe('gsm7');
    expect(analysisGsm2.segments).toBe(2);

    // Single non-GSM char triggers UCS-2 (70 chars limit)
    const textUcs = 'A'.repeat(71) + 'ê';
    const analysisUcs = analyzeSmsText(textUcs);
    expect(analysisUcs.encoding).toBe('ucs2');
    expect(analysisUcs.segments).toBe(2); // 72 chars > 70 => 2 segments in UCS-2
  });

  it('sanitizes text to safe GSM-7 without mangling plain text', () => {
    const input = 'Fête de l’école : « Bienvenue aux élèves d’août ! »';
    const sanitized = sanitizeToGsm7(input);
    expect(isGsm7String(sanitized)).toBe(true);
    expect(sanitized).toBe('Fete de l\'école : " Bienvenue aux élèves d\'aout ! "');
  });

  it('validates and formats Moroccan mobile phone numbers', () => {
    expect(isValidMoroccanMobile('0661123456')).toBe(true);
    expect(isValidMoroccanMobile('0770987654')).toBe(true);
    expect(isValidMoroccanMobile('+212661123456')).toBe(true);
    expect(isValidMoroccanMobile('212770987654')).toBe(true);
    expect(isValidMoroccanMobile('0522123456')).toBe(false); // Fixed line, not mobile
    expect(isValidMoroccanMobile('12345')).toBe(false);

    expect(formatMoroccanE164('0661123456')).toBe('+212661123456');
    expect(formatMoroccanE164('+212770987654')).toBe('+212770987654');
  });
});
