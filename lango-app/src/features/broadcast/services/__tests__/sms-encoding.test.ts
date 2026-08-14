import { describe, expect, it } from 'vitest';
import { countSmsSegments, gsm7Length, isGsm7 } from '../sms-encoding';

describe('SMS encoding (GSM-7 vs UCS-2) and segment billing', () => {
  it('detects GSM-7 text', () => {
    expect(isGsm7('Hello world 123!?')).toBe(true);
    expect(isGsm7('Café déjà vu')).toBe(true);
    expect(isGsm7('你好世界')).toBe(false);
    expect(isGsm7('ΓΛΩ')).toBe(true); // uppercase Greek GSM-7 subset
    expect(isGsm7('γειά')).toBe(false); // lowercase/tonos Greek is not GSM-7
  });

  it('counts extended GSM-7 chars as 2 units', () => {
    expect(gsm7Length('a')).toBe(1);
    expect(gsm7Length('€')).toBe(2);
    expect(gsm7Length('a€')).toBe(3);
  });

  it('single-segment GSM-7 at 160 chars', () => {
    const r = countSmsSegments('a'.repeat(160));
    expect(r).toEqual({ encoding: 'gsm7', segments: 1, charsPerSegment: 160, costUnits: 1 });
  });

  it('multipart GSM-7 at 161 chars uses 153-char pages', () => {
    const r = countSmsSegments('a'.repeat(161));
    expect(r).toEqual({ encoding: 'gsm7', segments: 2, charsPerSegment: 153, costUnits: 2 });
  });

  it('UCS-2 single at 70 chars, multipart at 71 (67-char pages)', () => {
    const single = countSmsSegments('你'.repeat(70));
    expect(single.encoding).toBe('ucs2');
    expect(single.segments).toBe(1);
    const multi = countSmsSegments('你'.repeat(71));
    expect(multi.encoding).toBe('ucs2');
    expect(multi.segments).toBe(2);
    expect(multi.charsPerSegment).toBe(67);
  });

  it('extended chars consume double budget (€ × 80 = 160 units → 1 segment; 81 → 2)', () => {
    const one = countSmsSegments('€'.repeat(80));
    expect(one.encoding).toBe('gsm7');
    expect(one.segments).toBe(1);
    const two = countSmsSegments('€'.repeat(81));
    expect(two.segments).toBe(2);
  });

  it('empty text is still one billable segment', () => {
    const r = countSmsSegments('');
    expect(r.segments).toBe(1);
  });
});
