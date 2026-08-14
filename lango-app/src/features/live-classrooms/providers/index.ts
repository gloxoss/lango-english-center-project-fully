import bigbluebuttonProvider from './bigbluebutton-provider';
import devProvider from './dev-provider';
import externalLinkProvider from './external-link-provider';
import type { LiveClassProvider, ProviderType } from './types';

const PROVIDERS: Record<ProviderType, LiveClassProvider> = {
  dev: devProvider,
  bigbluebutton: bigbluebuttonProvider,
  external_link: externalLinkProvider,
};

// Test seam: swap a provider implementation for adversarial DB tests (P1-1).
// Production code paths never touch this — it is set/unset only inside the
// deterministic provider-saga test suite.
const providerOverrides = new Map<string, LiveClassProvider>();

export function setProviderOverrideForTest(type: string, provider: LiveClassProvider | null): void {
  if (provider) providerOverrides.set(type, provider);
  else providerOverrides.delete(type);
}

export const PROVIDER_TYPES: ProviderType[] = ['dev', 'bigbluebutton', 'external_link'];

export function getProvider(type: string): LiveClassProvider | null {
  return providerOverrides.get(type) ?? PROVIDERS[type as ProviderType] ?? null;
}

export function getProviderOrThrow(type: string): LiveClassProvider {
  const provider = getProvider(type);
  if (!provider) throw new Error(`UNKNOWN_PROVIDER:${type}`);
  return provider;
}

export function isKnownProviderType(type: string): type is ProviderType {
  return type in PROVIDERS || providerOverrides.has(type);
}

export { devProviderCapabilities } from './dev-provider';
export { bbbCapabilities } from './bigbluebutton-provider';
export { externalLinkCapabilities } from './external-link-provider';
export {
  createJoinGrant, hashJoinNonce, signJoinToken, verifyJoinToken, type JoinGrantPayload,
} from './tokens';
export {
  getJoinSecretConfig, getJoinSigningMode, isJoinSigningConfigured, resetJoinSecretCache,
  resolveJoinSecretConfig, type JoinSecretConfig, type JoinSecretMode,
} from './signing-key';
export {
  DEV_WEBHOOK_SECRET, resolveWebhookSecretConfig, resolveWebhookSecretForProfile,
  type WebhookSecretResult,
} from './webhook-secret';
export { isProviderFailure } from './types';
export { markDevRoomLive, resetDevRoomsForTest } from './dev-provider';
export type {
  CreateJoinTokenInput, CreateRoomInput, JoinTokenResult, LiveClassProvider,
  NormalizedWebhookEvent, ProviderCapabilities, ProviderConfig, ProviderEventType,
  ProviderOperationResult, ProviderParticipantRole, ProviderRawEvent, ProviderRecording,
  ProviderType, RoomState, WebhookVerification,
} from './types';
