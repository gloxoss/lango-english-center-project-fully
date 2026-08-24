// Payment gateway registry entry point. Importing this module registers all
// providers; call sites import { getPaymentProvider } from '@/libs/payments'.
import './cmi-naps-provider';
import './stripe-provider';

export {
  getPaymentProvider,
  registerPaymentProvider,
  type CreateSessionInput,
  type CreateSessionResult,
  type GatewayCallbackStatus,
  type GatewayMode,
  type PaymentGatewayProvider,
  type VerifyCallbackInput,
  type VerifyCallbackResult,
} from './provider';
