import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { pino } from 'pino';

// W8 regression: the redaction key list that src/libs/logger.ts applies must
// censor PII (Law 09-08) wherever it appears as a top-level or nested object
// key in emitted JSON. Mirrors the key list — if a key is added to one place
// but not the other, this test fails.
const REDACTED_KEYS = [
  'email', 'phone', 'guardianPhone', 'guardianEmail', 'studentName',
  'memberName', 'contactName', 'firstName', 'lastName', 'matricule',
  'amount', 'allocatedAmount',
];

function buildCapturingLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const log = pino(
    {
      level: 'info',
      redact: {
        paths: REDACTED_KEYS.flatMap((k) => [k, `*.${k}`, `*. *.${k}`]),
        censor: '[REDACTED]',
      },
    },
    stream,
  );
  return { log, lines };
}

describe('logger PII redaction (W8, Law 09-08)', () => {
  it('censors PII keys in emitted JSON, keeps non-PII keys readable', async () => {
    const { log, lines } = buildCapturingLogger();
    log.info(
      {
        event: 'import_row_failed',
        line: 12,
        studentName: 'Fatima El Amrani',
        email: 'parent@example.com',
        phone: '+212 6 12-345678',
        amount: '1250.00',
        nested: { matricule: 'MAT-2026-0042', contactName: 'Youssef Benali' },
      },
      'row failed',
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(lines).toHaveLength(1);
    const out = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(out.studentName).toBe('[REDACTED]');
    expect(out.email).toBe('[REDACTED]');
    expect(String(out.phone)).toBe('[REDACTED]');
    expect(String(out.amount)).toBe('[REDACTED]');
    const nested = out.nested as Record<string, unknown>;
    expect(nested.matricule).toBe('[REDACTED]');
    expect(nested.contactName).toBe('[REDACTED]');
    expect(out.event).toBe('import_row_failed');
    expect(out.line).toBe(12);
  });
});
