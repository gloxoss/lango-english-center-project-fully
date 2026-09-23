import { NextResponse } from 'next/server';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { getConnectionWithSecrets } from '@/features/broadcast/services/connections-service';

// WhatsApp pairing QR (security audit P0-A).
//
// The previous version read endpointUrl / apiKey / session from the QUERY
// STRING with only an authenticated session as guard: any parent or student
// could point the server at an arbitrary host (full-read SSRF, WAHA key
// exfiltration) or read another school's pairing QR by session name. Everything
// is now server-derived:
//   - guard: session -> tenant -> broadcast add-on -> broadcast.manage,
//   - session is ALWAYS `tenant_<tenantId>` — a school can never address
//     another school's WhatsApp session,
//   - endpoint + key come only from the tenant's stored connection
//     (tenant-scoped lookup) or server env — never from the request,
//   - a missing/unreachable WAHA is a clean 503, not an unhandled 500.

const WAHA_TIMEOUT_MS = 6000;

function tenantSessionName(tenantId: string): string {
  return `tenant_${tenantId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function isCleanAscii(str: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]+$/.test(str);
}

async function wahaFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(WAHA_TIMEOUT_MS) });
  } catch {
    throw new ApiError(503, 'WAHA_UNREACHABLE', 'Serveur WhatsApp (WAHA) injoignable. Vérifiez la configuration ou réessayez plus tard.');
  }
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    // Resolve endpoint + key from server-owned sources only.
    let baseUrl = (process.env.WAHA_ENDPOINT_URL || '').replace(/\/+$/, '');
    let apiKey = process.env.WAHA_API_KEY || '';

    if (connectionId) {
      // Tenant-scoped: a connection id from another tenant throws 404 here.
      const conn = await getConnectionWithSecrets(tenantId, connectionId);
      const config = (conn.configJson || {}) as Record<string, unknown>;
      if (typeof config.endpointUrl === 'string' && config.endpointUrl.trim()) {
        baseUrl = config.endpointUrl.replace(/\/+$/, '');
      }
      if (typeof config.apiKey === 'string' && isCleanAscii(config.apiKey)) {
        apiKey = config.apiKey;
      }
    }

    if (!baseUrl || !apiKey) {
      throw new ApiError(503, 'WAHA_NOT_CONFIGURED', 'Connexion WhatsApp non configurée : renseignez l\'URL et la clé API de la connexion WAHA de l\'établissement.');
    }

    // Tenant-Isolation Invariant: every school addresses ONLY its own session.
    const session = tenantSessionName(tenantId);
    const headers: Record<string, string> = { 'X-Api-Key': apiKey };

    // 1. Check current session status
    let sessionStatus = 'UNKNOWN';
    const statusRes = await wahaFetch(`${baseUrl}/api/sessions/${session}`, { headers });
    if (statusRes.ok) {
      const sessionData = await statusRes.json().catch(() => null);
      sessionStatus = sessionData?.status || 'STOPPED';
    } else if (statusRes.status === 404) {
      // Create the school's session if it doesn't exist yet
      await wahaFetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: session }),
      });
      sessionStatus = 'STOPPED';
    }

    // 2. If session is stopped or failed, trigger start or restart
    if (sessionStatus === 'STOPPED' || sessionStatus === 'FAILED') {
      const endpoint = sessionStatus === 'FAILED'
        ? `${baseUrl}/api/sessions/${session}/restart`
        : `${baseUrl}/api/sessions/${session}/start`;
      await wahaFetch(endpoint, { method: 'POST', headers });
      sessionStatus = 'STARTING';
    }

    // If session is already connected/working
    if (sessionStatus === 'WORKING' || sessionStatus === 'CONNECTED') {
      return NextResponse.json({
        ok: true,
        session,
        status: 'CONNECTED',
        message: 'WhatsApp est déjà connecté et opérationnel pour cet établissement.',
      });
    }

    // 3. Fetch live QR Code
    const qrRes = await wahaFetch(`${baseUrl}/api/${session}/auth/qr`, { headers });

    if (!qrRes.ok) {
      return NextResponse.json({
        ok: false,
        session,
        status: sessionStatus,
        message: `Attente du code QR (Statut actuel: ${sessionStatus}). Veuillez rafraîchir dans un instant.`,
      });
    }

    const contentType = qrRes.headers.get('content-type') || 'image/png';
    const arrayBuffer = await qrRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({
      ok: true,
      session,
      status: sessionStatus,
      qrDataUrl: dataUrl,
      message: 'Scannez ce code QR avec WhatsApp (Appareils connectés > Connecter un appareil).',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
