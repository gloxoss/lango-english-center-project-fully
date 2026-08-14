import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { probeTarget, validateOutboundUrl } from '@/libs/network/outbound-url';
import {
  loadProviders, loadLogs, saveProviders, saveLogs,
  ProviderRecord, ConnectionLog,
} from '../../_lib';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/settings/providers/[id]/test — real reachability check against the
// configured endpoint (3s timeout). The endpoint URL is admin-controlled, so it
// passes through an SSRF validator before any connection: HTTPS/HTTP only,
// restricted ports, no private/loopback/link-local addresses, no redirect
// following, DNS-rebinding-proof connect, and the response body is never read
// or returned. Latency, status and a connection-log entry are recorded; nothing
// is simulated.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.integrations.manage');

    const { id } = await params;
    const providers = await loadProviders(tenantId, context.branchId, context);
    const index = providers.findIndex(p => p.id === id);
    if (index === -1) {
      throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Connexion introuvable.');
    }
    const current = providers[index]!;

    const isHttp = /^https?:\/\//i.test(current.endpointUrl);
    const startedAt = new Date();
    let latencyMs = 0;
    let statusCode = 0;
    let ok = false;
    let message = '';

    if (isHttp) {
      // SSRF guard: throws 400 SSRF_BLOCKED for unsafe schemes/ports/hosts and
      // returns pre-validated addresses pinned for the connection.
      const target = await validateOutboundUrl(current.endpointUrl);
      const probe = await probeTarget(target);
      latencyMs = probe.latencyMs;
      statusCode = probe.statusCode;
      ok = probe.ok;
      message = probe.message;
    } else {
      // Non-HTTP endpoints (e.g. SMTP host:port) are never connected to — there
      // is no SSRF-safe reachability probe for them yet.
      message = 'Endpoint non-HTTP — test de connectivité non disponible';
    }

    const status: ProviderRecord['status'] = ok
      ? 'operational'
      : statusCode > 0 ? 'degraded' : 'disconnected';

    const updated: ProviderRecord = {
      ...current,
      status,
      latencyMs: ok || statusCode > 0 ? latencyMs : 0,
      lastPing: startedAt.toLocaleString('fr-FR'),
    };
    providers[index] = updated;

    const log: ConnectionLog = {
      id: `log-${Date.now()}`,
      timestamp: startedAt.toLocaleTimeString('fr-FR'),
      providerId: id,
      event: 'PING Health Check',
      status: ok ? 'success' : 'warning',
      code: statusCode,
      latencyMs: ok || statusCode > 0 ? latencyMs : 0,
    };
    const logs = await loadLogs(tenantId, context.branchId);
    logs.unshift(log);

    await Promise.all([
      saveProviders(tenantId, context.branchId, providers, context),
      saveLogs(tenantId, context.branchId, logs, context),
    ]);
    recordAudit(context, 'update', 'integration', id, {
      action: 'test',
      ok,
      statusCode,
      latencyMs,
      message,
    });

    return NextResponse.json({ success: true, provider: updated, logItem: log, message });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
