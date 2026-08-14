// Pure SMS encoding helpers: determine GSM-7 vs UCS-2 and count multipart
// segments the way carriers bill. Tested via vitest (scripts/verify/…).
// GSM-7 single: 160 chars; multipart: 153 (7-byte UDH). UCS-2 single: 70;
// multipart: 67.

const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);

const GSM7_EXTENDED = new Set('^{}\\[~]|€');

export function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (GSM7_BASIC.has(ch)) continue;
    if (GSM7_EXTENDED.has(ch)) continue;
    return false;
  }
  return true;
}

/** Number of GSM-7 characters a message occupies (extended chars cost 2). */
export function gsm7Length(text: string): number {
  let n = 0;
  for (const ch of text) {
    n += GSM7_EXTENDED.has(ch) ? 2 : 1;
  }
  return n;
}

export type SmsEncoding = 'gsm7' | 'ucs2';

export type SmsSegments = {
  encoding: SmsEncoding;
  segments: number;
  charsPerSegment: number;
  costUnits: number;
};

export function countSmsSegments(text: string): SmsSegments {
  const gsm7 = isGsm7(text);
  if (gsm7) {
    const len = gsm7Length(text);
    const per = len <= 160 ? 160 : 153;
    const segments = Math.max(1, Math.ceil(len / per));
    return { encoding: 'gsm7', segments, charsPerSegment: per, costUnits: segments };
  }
  const len = [...text].length;
  const per = len <= 70 ? 70 : 67;
  const segments = Math.max(1, Math.ceil(len / per));
  return { encoding: 'ucs2', segments, charsPerSegment: per, costUnits: segments };
}
