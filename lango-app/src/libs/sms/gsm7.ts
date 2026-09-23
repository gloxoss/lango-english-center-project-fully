// Moroccan Telco & International GSM-7 Utilities
// Conforms to 3GPP TS 23.038 / GSM 03.38 standard for SMS transmission
// Prevents accidental UCS-2 multi-segment billing traps for French/Arabic school notifications

export const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);

export const GSM7_EXTENDED = new Set('^{}\\[~]|€');

export function isGsm7Char(ch: string): boolean {
  return GSM7_BASIC.has(ch) || GSM7_EXTENDED.has(ch);
}

export function isGsm7String(text: string): boolean {
  for (const ch of text) {
    if (!isGsm7Char(ch)) return false;
  }
  return true;
}

export function getNonGsm7Characters(text: string): string[] {
  const nonGsm = new Set<string>();
  for (const ch of text) {
    if (!isGsm7Char(ch)) {
      nonGsm.add(ch);
    }
  }
  return Array.from(nonGsm);
}

export function gsm7Length(text: string): number {
  let n = 0;
  for (const ch of text) {
    n += GSM7_EXTENDED.has(ch) ? 2 : 1;
  }
  return n;
}

export interface SmsAnalysis {
  charCount: number;
  encoding: 'gsm7' | 'ucs2';
  segments: number;
  charsPerSegment: number;
  costUnits: number;
  remainingInSegment: number;
  nonGsmChars: string[];
}

export function analyzeSmsText(text: string): SmsAnalysis {
  const gsm7 = isGsm7String(text);
  const nonGsmChars = gsm7 ? [] : getNonGsm7Characters(text);

  if (gsm7) {
    const len = gsm7Length(text);
    const per = len <= 160 ? 160 : 153;
    const segments = Math.max(1, Math.ceil(len / per));
    const remaining = segments * per - len;
    return {
      charCount: len,
      encoding: 'gsm7',
      segments,
      charsPerSegment: per,
      costUnits: segments,
      remainingInSegment: remaining,
      nonGsmChars: [],
    };
  }

  const len = [...text].length;
  const per = len <= 70 ? 70 : 67;
  const segments = Math.max(1, Math.ceil(len / per));
  const remaining = segments * per - len;
  return {
    charCount: len,
    encoding: 'ucs2',
    segments,
    charsPerSegment: per,
    costUnits: segments,
    remainingInSegment: remaining,
    nonGsmChars,
  };
}

/**
 * Normalizes text to strictly fit within the standard GSM-7 7-bit alphabet.
 * Converts common French accented characters not in GSM-7 (ê, ë, î, ï, ô, û) to their plain base forms,
 * and fixes smart quotes, curly apostrophes, and dashes commonly pasted from macOS/iOS or Word.
 */
export function sanitizeToGsm7(text: string): string {
  const REPLACEMENTS: Record<string, string> = {
    // Circumflex & Trema accents not in basic GSM-7
    'ê': 'e', 'Ê': 'E',
    'ë': 'e', 'Ë': 'E',
    'î': 'i', 'Î': 'I',
    'ï': 'i', 'Ï': 'I',
    'ô': 'o', 'Ô': 'O',
    'û': 'u', 'Û': 'U',
    'ç': 'c', // lowercase ç is not in strict GSM-7 (only uppercase Ç is standard 0x09)
    'œ': 'oe', 'Œ': 'OE',
    'æ': 'ae', // GSM has æ but some gateways mangle it

    // Smart punctuation & quotes
    '’': "'", '‘': "'", '`': "'", '´': "'",
    '“': '"', '”': '"', '«': '"', '»': '"', '„': '"',
    '—': '-', '–': '-', '―': '-',
    '…': '...',
    '•': '-',

    // Spaces
    '\u00A0': ' ', // Non-breaking space
    '\u202F': ' ', // Narrow no-break space
    '\u200B': '',  // Zero-width space
    '\uFEFF': '',  // BOM
  };

  let cleaned = '';
  for (const ch of text) {
    if (REPLACEMENTS[ch] !== undefined) {
      cleaned += REPLACEMENTS[ch];
    } else {
      cleaned += ch;
    }
  }

  return cleaned;
}

/**
 * Validates Moroccan phone number format:
 * - Local formats: 06XXXXXXXX or 07XXXXXXXX (10 digits)
 * - International: +2126XXXXXXXX or +2127XXXXXXXX or 2126XXXXXXXX / 2127XXXXXXXX
 */
export function isValidMoroccanMobile(phone: string): boolean {
  const cleaned = phone.replace(/[\s.-]/g, '');
  return /^(0[67]\d{8}|(\+?212)[67]\d{8})$/.test(cleaned);
}

/**
 * Formats a Moroccan mobile number to international E.164 standard (+2126XXXXXXXX)
 */
export function formatMoroccanE164(phone: string): string {
  const cleaned = phone.replace(/[\s.-]/g, '');
  if (cleaned.startsWith('+212')) return cleaned;
  if (cleaned.startsWith('212')) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `+212${cleaned.substring(1)}`;
  }
  return cleaned;
}
