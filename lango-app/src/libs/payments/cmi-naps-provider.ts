import { ApiError } from '@/libs/api/errors';
import {
  registerPaymentProvider,
  type CreateSessionInput,
  type CreateSessionResult,
  type PaymentGatewayProvider,
  type VerifyCallbackInput,
  type VerifyCallbackResult,
} from './provider';

// CMI NAPS (Morocco) hosted-redirect provider. Sandbox mode is fully testable
// without real merchant credentials; live mode requires real merchant creds +
// CMI sandbox approval and is a documented follow-up (never faked).
export class CmiNapsProvider implements PaymentGatewayProvider {
  readonly id = 'cmi-naps';

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    if (input.mode === 'sandbox') {
      // No real redirect: the sandbox simulator drives the callback directly.
      return { redirectUrl: null, externalReference: input.externalReference, mode: 'sandbox' };
    }
    // TODO(K — CMI NAPS live): blocked on real merchant credentials + CMI sandbox
    // approval. Inputs required (never hardcode, resolve from tenant settings):
    //   - merchant `clientid` + `storekey` (CMI test/prod credentials)
    //   - endpoints: test https://testpayment.cmi.co.ma/fim/est3Dgate
    //                prod https://payment.cmi.co.ma/fim/est3Dgate
    // createSession must POST a signed checkout form (application/x-www-form-urlencoded):
    //   clientid, amount (decimal, e.g. "1500.00"), oid (externalReference),
    //   okUrl, failUrl, TranType (Auth/PreAuth), currency (504 = MAD), rnd (microtime),
    //   storetype, hashAlgorithm (ver1/ver2), lang (fr), encoding (UTF-8),
    //   hash = base64(HMAC-SHA512(concat(payload) + storekey)) — algorithm per CMI spec.
    // Return the gateway form URL as `redirectUrl` (hosted redirect).
    throw new ApiError(
      501,
      'GATEWAY_LIVE_PENDING',
      'CMI NAPS en production requiert des identifiants marchand et une certification (suivi planifié).',
    );
  }

  async verifyCallback(input: VerifyCallbackInput): Promise<VerifyCallbackResult> {
    if (input.mode === 'sandbox') {
      // The sandbox simulator is authoritative; signature verification is not a
      // real security boundary here.
      return {
        externalReference: String(input.rawBody.externalReference ?? input.rawBody.oid ?? ''),
        status: input.rawBody.status === 'failed' ? 'failed' : 'paid',
        amount: Number(input.rawBody.amount),
        currency: String(input.rawBody.currency ?? 'MAD'),
      };
    }
    // TODO(K — CMI NAPS live): CMI POSTs back to okUrl/failUrl with form fields
    // (clientid, oid, amount, Response, ProcReturnCode, ResponseCode, rnd, HASH).
    // verifyCallback must:
    //   1. recompute + compare HASH over the signed fields (HMAC-SHA512 + storekey)
    //      — reject on mismatch (forged callback), never trust the raw amount/status;
    //   2. map ResponseCode/ProcReturnCode === '00' → paid, else failed;
    //   3. return { externalReference: oid, status, amount: Number(amount), currency: 'MAD' }.
    throw new ApiError(
      501,
      'GATEWAY_LIVE_PENDING',
      'Vérification CMI NAPS en production en attente de certification.',
    );
  }
}

registerPaymentProvider(new CmiNapsProvider());
