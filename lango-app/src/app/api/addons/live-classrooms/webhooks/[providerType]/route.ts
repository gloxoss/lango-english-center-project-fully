// Signed provider callback receiver.
//
// No app auth (the provider signs the request); verification happens against the
// configured provider secret. Every delivery is stored as a receipt - forged or
// unsigned bodies are recorded with signatureResult=failed/unsigned and never
// become participant events. Verified bodies are normalized and ingested
// idempotently (unique tenantId+providerEventId). Always answers 2xx so the
// provider stops retrying; the outcome is in the response body.
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { ingestWebhook } from '@/features/live-classrooms/services/event-service';
import { isWebhookRateLimited, recordFailedWebhookAttempt } from '@/features/live-classrooms/services/webhook-rate-limit';
import { getProvider } from '@/features/live-classrooms/providers';

type RouteContext = { params: Promise<{ providerType: string }> };
const MAX_WEBHOOK_BYTES = 256 * 1024;

function clientKey(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0]?.trim()) || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { providerType } = await params;
    if (!getProvider(providerType)) {
      return NextResponse.json({ success: false, error: 'UNKNOWN_PROVIDER' }, { status: 422 });
    }

    // P1-4: repeated unknown-session / invalid-signature deliveries from the
    // same client are throttled — a scanning/probing client gets a cheap 429
    // once it exhausts its failure budget. A legitimate, correctly-signed
    // high-volume delivery stream is never throttled (only failed outcomes
    // consume budget, recorded after the outcome is known, below).
    const key = clientKey(request);
    if (isWebhookRateLimited(key)) {
      return NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });
    }

    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ success: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ success: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      recordFailedWebhookAttempt(key);
      return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 });
    }

    const headers: Record<string, string | undefined> = {
      'x-dev-signature': request.headers.get('x-dev-signature') ?? undefined,
      'x-bbb-signature': request.headers.get('x-bbb-signature') ?? undefined,
    };

    const result = await ingestWebhook(providerType, headers, body);
    const isFailureSignal = !result.sessionFound
      || result.signatureResult === 'failed'
      || result.signatureResult === 'unsigned';
    if (isFailureSignal) {
      recordFailedWebhookAttempt(key);
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
