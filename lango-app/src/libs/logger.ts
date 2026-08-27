import pino from 'pino';

// Structured logging (roadmap 3.7 / Wave 3 W8). One pino instance per process,
// JSON to stdout in every environment (docker logs / journald ingest JSON),
// pino-pretty only for local developer comfort.
//
// Moroccan Law 09-08 applies to logs: they must not carry personal data.
// `redact` below censors PII keys wherever they appear as a top-level or
// first-nested key of the logged object — emails, phone numbers, names,
// matricules, guardian contacts and money amounts. Log call sites must pass
// such values as object properties (never interpolated into the message
// string) for redaction to reach them.
const REDACTED_KEYS = [
  'email',
  'phone',
  'guardianPhone',
  'guardianEmail',
  'studentName',
  'memberName',
  'contactName',
  'firstName',
  'lastName',
  'matricule',
  'amount',
  'allocatedAmount',
];

function redactPaths(): string[] {
  const paths: string[] = [];
  for (const key of REDACTED_KEYS) {
    paths.push(key, `*.${key}`, `*. *.${key}`);
  }
  return paths;
}

export const logger = pino({
  level: process.env.NEXT_PUBLIC_LOGGING_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: redactPaths(),
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : {}),
});

export type Logger = typeof logger;
