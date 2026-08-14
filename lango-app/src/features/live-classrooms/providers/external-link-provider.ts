// External-link connector (Google Meet / Zoom / Teams style, reduced capability).
//
// Lango can only store and gate the link — there is no room lifecycle, no
// attendance events, no recordings, no webhook. Capability flags are all false
// so the UI disables unsupported controls honestly.
//
// P1-8 hardening: the base URL is admin-supplied and handed straight to a
// browser (as a join destination) and, at profile-save time, validated
// server-side. It must be HTTPS-only (reject javascript:/data:/file:/http:)
// and must not resolve to an internal/private/link-local address (SSRF). The
// full SSRF check (DNS resolution) runs at profile save/create-room time —
// infrequent, admin-triggered — under a bounded timeout; the hot per-join path
// (createJoinToken) only re-checks the URL shape synchronously (no network).
import { ApiError } from '@/libs/api/errors';
import { validateOutboundUrl } from '@/libs/network/outbound-url';
import type {
  CancelRoomInput, CreateJoinTokenInput, CreateRoomInput, LiveClassProvider,
  NormalizedWebhookEvent, ProviderConfig, ProviderOperationResult, ProviderRawEvent,
  ProviderRecording, RoomState, UpdateRoomInput, WebhookVerification,
} from './types';

export const externalLinkCapabilities = {
  webhooks: false,
  attendanceEvents: false,
  recording: false,
  breakoutRooms: false,
  polls: false,
  whiteboard: false,
  embeddedUI: false,
} as const;

const SSRF_CHECK_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SSRF_CHECK_TIMEOUT')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Fast, synchronous shape/scheme check — safe to run on every join. */
export function assertHttpsUrlShape(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ApiError(422, 'INVALID_EXTERNAL_LINK', 'Le lien externe n\'est pas une URL valide.');
  }
  if (url.protocol !== 'https:') {
    throw new ApiError(422, 'HTTPS_REQUIRED', 'Seuls les liens externes en HTTPS sont autorisés.');
  }
  return url;
}

/**
 * Full validation: HTTPS-only shape + SSRF resolution (rejects loopback,
 * RFC1918, link-local, cloud-metadata and other internal ranges), bounded by
 * a timeout so a slow/unresponsive DNS resolver never hangs the caller.
 */
export async function validateExternalLinkUrl(rawUrl: string): Promise<void> {
  assertHttpsUrlShape(rawUrl);
  try {
    await withTimeout(validateOutboundUrl(rawUrl), SSRF_CHECK_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(422, 'EXTERNAL_LINK_UNVERIFIABLE', 'Impossible de vérifier la sécurité du lien externe (délai dépassé).');
  }
}

function requireBaseUrl(config: ProviderConfig): string {
  if (!config.baseUrl) {
    throw new ApiError(409, 'SESSION_NO_ROOM', 'Le lien externe de cette session n\'est pas configuré.');
  }
  return config.baseUrl;
}

const externalLinkProvider: LiveClassProvider = {
  id: 'external_link',
  label: 'Lien externe (Meet / Zoom / Teams)',
  capabilities: externalLinkCapabilities,

  async validateConfiguration(config): Promise<ProviderOperationResult> {
    if (!config.baseUrl) return { ok: false, code: 'NOT_CONFIGURED', error: 'URL du lien externe manquante.' };
    try {
      await validateExternalLinkUrl(config.baseUrl);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) return { ok: false, code: err.code, error: err.message };
      return { ok: false, code: 'INVALID_EXTERNAL_LINK', error: 'Lien externe invalide.' };
    }
  },

  async createRoom(input: CreateRoomInput) {
    // Room "creation" for this provider is just binding the session to the
    // configured link — validate it (HTTPS + SSRF) before ever attaching it.
    await validateExternalLinkUrl(requireBaseUrl(input.config));
    return { providerMeetingId: `ext-${input.sessionId}` };
  },

  async updateRoom(input: UpdateRoomInput): Promise<ProviderOperationResult> {
    try {
      await validateExternalLinkUrl(requireBaseUrl(input.config));
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) return { ok: false, code: err.code, error: err.message };
      throw err;
    }
  },

  async cancelRoom(): Promise<ProviderOperationResult> {
    return { ok: true };
  },

  async getRoom(): Promise<RoomState | null> {
    return null; // no room state for a static link
  },

  async createJoinToken(input: CreateJoinTokenInput) {
    // Hot path (once per join): shape/scheme only, no network. The full SSRF
    // (DNS) check already ran when the link was saved/bound (createRoom).
    const url = assertHttpsUrlShape(requireBaseUrl(input.config));
    return {
      token: '',
      url: url.toString(),
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
    };
  },

  async syncEvents(): Promise<ProviderRawEvent[]> {
    return [];
  },

  async listRecordings(): Promise<ProviderRecording[]> {
    return [];
  },

  async deleteRecording(): Promise<ProviderOperationResult> {
    return { ok: false, code: 'UNSUPPORTED', error: 'Lien externe : pas d\'enregistrement géré.' };
  },

  verifyWebhook(_headers: Record<string, string | undefined>, _body: unknown, _secret: string): WebhookVerification {
    return { valid: false, reason: 'unsupported' };
  },

  normalizeWebhook(): NormalizedWebhookEvent {
    throw new Error('External-link providers have no webhooks.');
  },
};

export default externalLinkProvider;
