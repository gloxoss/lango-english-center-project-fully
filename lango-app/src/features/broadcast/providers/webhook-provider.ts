import { registerProvider, type BroadcastChannel, type BroadcastProvider, type DeliveryTarget, type ProviderSendResult } from './provider';

// Generic HTTP webhook adapter — a real outbound delivery path that needs no
// third-party credentials. A tenant configures their own endpoint (an SMS
// gateway's HTTP API, a Twilio/Vonage function, Slack, etc.) via the connection
// `configJson`:
//   { url: string, method?: 'POST'|'GET', headers?: Record<string,string>, timeoutMs?: number }
// The adapter POSTs the message as JSON and treats any 2xx as accepted. This is
// the app's honest route to real delivery without hardcoding a vendor.

type WebhookConfig = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8000;

export class WebhookProvider implements BroadcastProvider {
  readonly provider = 'webhook';
  readonly channels: BroadcastChannel[] = ['sms', 'email', 'whatsapp', 'telegram', 'messenger'];

  async send(target: DeliveryTarget): Promise<ProviderSendResult> {
    const cfg = (target.config ?? {}) as WebhookConfig;
    const url = typeof cfg.url === 'string' && cfg.url.trim() ? cfg.url.trim() : null;
    if (!url) {
      return { ok: false, status: 'failed', failureReason: 'no_webhook_url', retryable: false };
    }

    const method = (typeof cfg.method === 'string' && cfg.method.trim() ? cfg.method.trim().toUpperCase() : 'POST');
    const timeoutMs = typeof cfg.timeoutMs === 'number' && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.headers ?? {}),
        },
        body: JSON.stringify({
          channel: target.channel,
          to: target.to,
          subject: target.subject ?? null,
          bodyText: target.bodyText,
          bodyHtml: target.bodyHtml ?? null,
        }),
        signal: controller.signal,
      });
      const ref = `webhook:${res.status}`;
      if (res.ok) {
        return { ok: true, status: 'sent', providerRef: ref };
      }
      return { ok: false, status: 'failed', failureReason: `http_${res.status}`, retryable: res.status >= 500, providerRef: ref };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return { ok: false, status: 'failed', failureReason: aborted ? 'webhook_timeout' : 'webhook_error', retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(config: Record<string, unknown>) {
    const result = await this.send({
      channel: 'sms',
      to: 'test',
      bodyText: 'Test de connexion SchoolOS (webhook)',
      config,
    });
    return result.ok
      ? { ok: true, message: 'Webhook atteint avec succès.' }
      : { ok: false, message: `Échec du webhook : ${result.failureReason ?? 'erreur inconnue'}.` };
  }
}

registerProvider(new WebhookProvider());
