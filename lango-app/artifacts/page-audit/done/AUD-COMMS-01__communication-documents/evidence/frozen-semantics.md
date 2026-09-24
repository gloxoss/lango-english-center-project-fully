# FROZEN SEMANTICS — delivery truth audit (AUD-COMMS-01)

## The frozen rule

    no provider        -> queued, sentAt null
    provider success   -> sent, sentAt set
    delivered          -> only on real delivery acknowledgement
    failure            -> failed

These semantics were **not changed** by this campaign. The campaign measured the
codebase against them and repaired one violation.

## Where the rule already lives (both correct — untouched)

**1. `src/features/broadcast/services/sms-delivery.ts`** — the authoritative
dispatcher. Header comment (lines 13-18):

> Always records the message row; additionally attempts a real outbound delivery
> when the tenant has an SMS connection with a real provider … Without one, it
> checks for a platform-level fallback provider before degrading to the app's
> honest log-only simulation. **`delivered` only ever reflects provider evidence,
> never a fabricated status.**

Its `dispatch()` encodes the rule exactly (lines 167-198):

```ts
let status: 'queued' | 'sent' | 'failed' = 'queued';   // default = no provider
let delivery: SendSmsResult['delivery'] = 'simulated'; // default = log-only
let sentAt: string | null = null;                      // default = never sent

// resolved?.isReal && result.ok  -> status 'sent',  sentAt = now
// resolved?.isReal && !result.ok -> 'failed',        sentAt = null
// not isReal                     -> stays 'queued',  sentAt = null  (simulated)
```

**2. `src/app/api/attendance/route.ts:373-377`** — NOTIFICATION TRUTH (Phase 6):

> intents are requested AFTER the attendance transaction commits, through the
> authoritative SMS dispatch service — **never as a raw `'sent'` row inside the
> transaction. No provider success means no `'sent'`.**

**3. `src/features/broadcast/services/outbox-worker.ts`** (campaign outbox) is also
correct: `result.ok` sets `status: result.status` with `sentAt`, and sets
`deliveredAt` **only** when `result.status === 'delivered'`; `!result.ok` goes to
`failed` or an exponential-backoff retry. No provider resolved -> `failed`
(`unknown_provider`), never a fabricated `sent`.

**4. `src/app/api/communication/messages/route.ts`** POST is the correct in-scope
counter-example to F-01: it calls `sendSmsMessage` (the dispatcher) and its header
says "Without one it stays in honest log-only simulation — the UI banner reflects
that state."

**5. `src/app/api/users/route.ts:132-138`** writes `status: 'queued'` with **no**
`sentAt` — exactly right for an un-sent activation SMS.

**6. `src/features/broadcast/services/connections-service.ts:184`** writes
`status: result.ok ? 'sent' : 'failed'` from a **real** provider test send — right.

## FROZEN MODULE CONTRADICTION — the violations

All three write a raw `smsMessages` row with `status: 'sent'` **and** a fabricated
`sentAt: new Date().toISOString()` while **never invoking a provider**. This is
precisely the "raw 'sent' row" pattern Phase 6 forbids: it reports a message as
sent when nothing was sent, so the delivery history lies.

| ID | File | In AUD-COMMS-01 claim? | Disposition |
|---|---|---|---|
| **F-01** | `src/app/api/communication/announcements/route.ts:83-85` | **YES** | **FIXED** |
| **F-02** | `src/app/api/settings/access-reset/route.ts:85-91` | NO (`api/settings`, held by codex-3 / AUD-SETTINGS-01) | **DOCUMENTED** |
| **F-03** | `src/app/api/students/[id]/regenerate-access/route.ts:71-78` | NO (`api/students`) | **DOCUMENTED** |

Per the campaign brief: *"If you find a contradiction, document it as:
FROZEN MODULE CONTRADICTION and continue the rest of the campaign."* F-02 and F-03
are therefore logged, not fixed — they are outside the assigned file claim and
another agent holds those paths.

### F-01 (fixed) — /api/communication/announcements

Before:

```ts
await db.insert(smsMessages).values({
  tenantId, recipientPhone: recipient.phone, studentId: recipient.id,
  body: `${body.title} : ${body.body}`.slice(0, 300),
  status: 'sent',                     // <- fabricated: no provider was called
  sentAt: new Date().toISOString(),   // <- fabricated send timestamp
  createdById: context.userId,
});
```

Compounding defects in the same block: it **bypassed consent and suppression
checks** (`checkConsent` / `communication_suppressions`) and **Moroccan phone
normalization** (`normalizeMoroccanPhone`), both of which the dispatcher does.

After: the alumni fan-out calls `sendSmsMessages(tenantId, inputs)`, so
un-configured tenants get `queued` + `sentAt: null`, real providers get `sent` +
`sentAt`, provider acknowledgements get `delivered`, and failures get `failed` —
and consent/suppression/normalization now apply.

### F-02 (documented) — /api/settings/access-reset

```ts
status: 'sent',
sentAt: new Date().toISOString(),
```
Same fabrication on the temporary-access-code SMS. Note `recipientPhone:
guardian?.phone ?? '—'` also stores a placeholder phone rather than failing
honestly.

### F-03 (documented) — /api/students/[id]/regenerate-access

```ts
status: 'sent',
sentAt: new Date().toISOString(),
```
Same fabrication on the account-activation link SMS.

## Regression coverage

`src/features/broadcast/__tests__/delivery-truth.test.ts` (3 tests, 3/3 pass):

1. `sendSmsMessage` returns only the four truth values, and the persisted row
   obeys: `sent` implies `sentAt` set; `simulated` is never `sent`; `failed` is
   `failed`; `delivered` only with provider evidence.
2. Static scan of **every** `src/app/api/**/route.ts` for the
   `insert(smsMessages)` + `status: 'sent'` combination. F-02 and F-03 are pinned
   as a `KNOWN_CONTRADICTIONS` set so the suite is green and honest, while **any
   new** fabrication fails the test.

Bite proof — with the pre-fix `announcements` code restored:

```
× rejects the fabricated-sent pattern in every API route
AssertionError: expected [ Array(1) ] to deeply equal []
+ [ "src/app/api/communication/announcements/route.ts" ]
Tests  1 failed | 2 skipped
```

With the fix: 3/3 pass.
