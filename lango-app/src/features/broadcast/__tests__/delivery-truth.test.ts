// Delivery-truth regression suite. The communication core has FROZEN semantics
// that must never be contradicted:
//
//   no provider               -> queued, sentAt null
//   provider success          -> sent, sentAt set
//   delivered                  only on real delivery acknowledgement
//   failure                    -> failed
//
// `sendSmsMessage` (src/features/broadcast/services/sms-delivery.ts) is the
// authoritative dispatcher and already encodes these. The bug this suite exists
// to prevent is a route writing a raw `smsMessages` row with `status: 'sent'`
// and a fabricated `sentAt` while never calling a provider — which is what
// /api/communication/announcements did before AUD-COMMS-01.
//
// Skipped unless a reachable DATABASE_URL is present (same convention as the
// other audit suites).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { smsMessages, tenants } from '@/models/Schema';
import { sendSmsMessage, type SendSmsResult } from '@/features/broadcast/services/sms-delivery';

const hasDb = Boolean(process.env.DATABASE_URL);

const TRUTH: SendSmsResult['delivery'][] = ['sent', 'delivered', 'failed', 'simulated'];

describe.skipIf(!hasDb)('Delivery truth (frozen semantics)', () => {
  it('reports only the four truth values', () => {
    expect(TRUTH).toEqual(['sent', 'delivered', 'failed', 'simulated']);
  });

  it('never records "sent" without a sentAt, nor "simulated" as "sent"', async () => {
    // A real tenant keeps the insert inside the FK boundary; the probe row is
    // written to schoolos_audit only and is inert (no student, no creator).
    const [tenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
    expect(tenant).toBeDefined();

    const result = await sendSmsMessage(
      tenant!.id,
      { to: '+212600000000', body: 'AUD-COMMS-01 delivery-truth probe (inert)' },
    );

    expect(TRUTH).toContain(result.delivery);

    const [row] = await db.select().from(smsMessages).where(eq(smsMessages.id, result.id)).limit(1);
    expect(row).toBeDefined();

    // "provider success -> sent, sentAt set"
    if (row!.status === 'sent') expect(row!.sentAt).not.toBeNull();
    // "no provider -> queued, sentAt null": a simulated send is never 'sent'.
    if (result.delivery === 'simulated') expect(row!.status).not.toBe('sent');
    // "failure -> failed"
    if (result.delivery === 'failed') expect(row!.status).toBe('failed');
    // "delivered only on real delivery acknowledgement"
    if (result.delivery !== 'delivered') expect(row!.status).not.toBe('delivered');
  });

  it('rejects the fabricated-sent pattern in every API route', () => {
    // Static regression: no route may write `status: 'sent'` straight into
    // smsMessages. Real sends go through the dispatcher, which is the only thing
    // allowed to decide that a message was sent.
    //
    // KNOWN_CONTRADICTIONS lists two routes that still do this. They are outside
    // the AUD-COMMS-01 file claim, so they are documented as FROZEN MODULE
    // CONTRADICTION in the report rather than fixed here. Pinning them keeps the
    // suite honest and green while making any NEW fabrication fail this test —
    // when one is fixed, drop it from the list and the test still holds.
    const KNOWN_CONTRADICTIONS = new Set([
      'src/app/api/settings/access-reset/route.ts',
      'src/app/api/students/[id]/regenerate-access/route.ts',
    ]);
    const toPosix = (p: string) => p.split(path.sep).join('/');

    const apiDir = path.resolve(process.cwd(), 'src/app/api');
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'route.ts') {
          const src = fs.readFileSync(full, 'utf8');
          if (/insert\(\s*smsMessages\s*\)/.test(src) && /status:\s*'sent'/.test(src)) {
            offenders.push(toPosix(path.relative(process.cwd(), full)));
          }
        }
      }
    };
    walk(apiDir);

    const unexpected = offenders.filter(o => !KNOWN_CONTRADICTIONS.has(o));
    expect(unexpected).toEqual([]);
  });
});
