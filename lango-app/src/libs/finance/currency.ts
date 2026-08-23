import { getEffectiveValue } from '@/libs/settings/registry';

const DEFAULT_CURRENCY = 'MAD';

/**
 * Resolve the tenant's base currency (ISO 4217 code). Single currency per
 * tenant — Moroccan clients default to MAD, others configure their own via
 * the `finance.currency` setting. Falls back to MAD if the value is unset.
 */
export async function getTenantCurrency(tenantId: string): Promise<string> {
  try {
    const eff = await getEffectiveValue(tenantId, null, 'finance.currency');
    return typeof eff.value === 'string' && eff.value.length === 3 ? eff.value : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}
