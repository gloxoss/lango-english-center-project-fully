import type { RequestContext } from '@/libs/api/context';
import { getEffectiveValue, setSettingValue } from '@/libs/settings/registry';
import { PROVIDER_LIST } from '@/features/settings/data/providers-config';

export type ProviderRecord = {
  id: string;
  name: string;
  category: string;
  providerName: string;
  endpointUrl: string;
  status: 'operational' | 'degraded' | 'disconnected';
  latencyMs: number;
  ownerName: string;
  quotaUsed: number;
  quotaTotal: number;
  quotaUnit: string;
  senderId: string;
  lastPing: string;
};

export type ConnectionLog = {
  id: string;
  timestamp: string;
  providerId: string;
  event: string;
  status: string;
  code: number;
  latencyMs: number;
};

export async function loadProviders(
  tenantId: string,
  branchId: string | null,
  context: RequestContext,
): Promise<ProviderRecord[]> {
  // Read-only load: when the tenant has never customized the catalog, return the
  // provider-config seed without writing. Persistence happens on POST/PATCH/test.
  const effective = await getEffectiveValue(tenantId, branchId, 'integrations.providers');
  if (effective.source === 'default') {
    return Array.from(PROVIDER_LIST) as unknown as ProviderRecord[];
  }
  const list = Array.isArray(effective.value) ? effective.value : [];
  return list as ProviderRecord[];
}

export async function loadLogs(tenantId: string, branchId: string | null): Promise<ConnectionLog[]> {
  const effective = await getEffectiveValue(tenantId, branchId, 'integrations.connectionLogs');
  const list = Array.isArray(effective.value) ? effective.value : [];
  return list as ConnectionLog[];
}

export async function saveProviders(
  tenantId: string,
  branchId: string | null,
  providers: ProviderRecord[],
  context: RequestContext,
): Promise<void> {
  await setSettingValue(tenantId, branchId, 'integrations.providers', providers, context);
}

export async function saveLogs(
  tenantId: string,
  branchId: string | null,
  logs: ConnectionLog[],
  context: RequestContext,
): Promise<void> {
  await setSettingValue(tenantId, branchId, 'integrations.connectionLogs', logs.slice(0, 50), context);
}
