import { eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { paymentMethodConfigurations } from '@/models/Schema';

// Built-in codes used before any per-tenant configuration exists (legacy
// enum values). Once a tenant has at least one configured method, the config
// becomes authoritative and these fall back to the same validation path.
const LEGACY_METHODS = ['cash', 'card', 'transfer', 'check'];

export type PaymentMethodConfig = typeof paymentMethodConfigurations.$inferSelect;

/**
 * Validate a submitted payment method against the tenant's configuration.
 * Returns the matching config row, or null when the tenant has no
 * configuration yet and the code is a legacy built-in (back-compat).
 * Throws 422 otherwise.
 */
export async function validatePaymentMethod(
  tenantId: string,
  methodCode: string,
  branchId: string | null = null,
): Promise<PaymentMethodConfig | null> {
  const configs = await db
    .select()
    .from(paymentMethodConfigurations)
    .where(eq(paymentMethodConfigurations.tenantId, tenantId));

  if (configs.length === 0) {
    if (LEGACY_METHODS.includes(methodCode)) return null;
    throw new ApiError(422, 'PAYMENT_METHOD_UNKNOWN', `Moyen de paiement « ${methodCode} » inconnu.`);
  }

  const match = configs.find((c) => c.methodCode === methodCode);
  if (!match) {
    throw new ApiError(422, 'PAYMENT_METHOD_UNKNOWN', `Moyen de paiement « ${methodCode} » inconnu.`);
  }
  if (!match.isActive) {
    throw new ApiError(422, 'PAYMENT_METHOD_INACTIVE', `Le moyen de paiement « ${methodCode} » est désactivé.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (match.effectiveFrom && match.effectiveFrom > today) {
    throw new ApiError(422, 'PAYMENT_METHOD_INACTIVE', `Le moyen de paiement « ${methodCode} » n'est pas encore actif.`);
  }
  if (match.effectiveTo && match.effectiveTo < today) {
    throw new ApiError(422, 'PAYMENT_METHOD_INACTIVE', `Le moyen de paiement « ${methodCode} » a expiré.`);
  }
  if (match.branchScopeId && branchId && match.branchScopeId !== branchId) {
    throw new ApiError(422, 'PAYMENT_METHOD_INACTIVE', `Le moyen de paiement « ${methodCode} » n'est pas disponible pour cette filiale.`);
  }
  return match;
}
