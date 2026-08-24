// Provider-neutral online payment gateway contract. Mirrors the Broadcast
// provider registry: an adapter implements PaymentGatewayProvider and registers
// itself; call sites resolve by id. Secrets are resolved by the caller (via
// secrets-service) and passed in decrypted — providers do no I/O for credentials.

export type GatewayMode = 'sandbox' | 'live';
export type GatewayCallbackStatus = 'paid' | 'failed';

export interface CreateSessionInput {
  tenantId: string;
  invoiceId: string;
  amount: number; // decimal units, e.g. 1250.00
  currency: string; // ISO-4217 code
  mode: GatewayMode;
  externalReference: string;
  returnUrl: string;
  cancelUrl: string;
  /** Decrypted merchant store key (live only). */
  storeKey?: string;
}

export interface CreateSessionResult {
  /** null in sandbox mode — the simulator completes the flow without a redirect. */
  redirectUrl: string | null;
  externalReference: string;
  mode: GatewayMode;
  /** Signed checkout POST fields (live hosted-redirect providers). */
  checkoutFields?: Record<string, string>;
}

export interface VerifyCallbackInput {
  rawBody: Record<string, unknown>;
  /** HMAC/signature header or field from the gateway. */
  signature: string | null;
  mode: GatewayMode;
  /** Decrypted webhook/store secret for signature verification (live only). */
  webhookSecret?: string;
  /** Raw request body string, required by verifiers that sign the exact payload (Stripe). */
  rawPayload?: string;
}

export interface VerifyCallbackResult {
  externalReference: string;
  status: GatewayCallbackStatus;
  amount: number;
  currency: string;
}

export interface PaymentGatewayProvider {
  readonly id: string;
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  verifyCallback(input: VerifyCallbackInput): Promise<VerifyCallbackResult>;
}

const providers = new Map<string, PaymentGatewayProvider>();

export function registerPaymentProvider(p: PaymentGatewayProvider): void {
  providers.set(p.id, p);
}

export function getPaymentProvider(id: string): PaymentGatewayProvider | null {
  return providers.get(id) ?? null;
}
