// providers-page.tsx
// SERVER COMPONENT — pre-fetches real provider integrations (tenant-scoped,
// seeded from the catalog on first load) and real connection-log entries.
import { getServerUserContext } from '@/libs/auth/server-context';
import { getEffectiveValue } from '@/libs/settings/registry';
import { PROVIDER_LIST } from '@/features/settings/data/providers-config';
import { ProvidersClient, ProviderItem, LogItem } from './providers-client';

export async function ProvidersPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  let initialProviders = Array.from(PROVIDER_LIST) as unknown as ProviderItem[];
  let initialLogs: LogItem[] = [];

  try {
    if (tenantId && ctx) {
      const [provEff, logsEff] = await Promise.all([
        getEffectiveValue(tenantId, ctx.branchId, 'integrations.providers'),
        getEffectiveValue(tenantId, ctx.branchId, 'integrations.connectionLogs'),
      ]);

      // Read-only: when the tenant has never customized the catalog, render the
      // provider-config seed. Persistence happens on add/edit/test, never here.
      const list = provEff.source === 'default' ? [] : (Array.isArray(provEff.value) ? provEff.value : []);
      initialProviders = list.length > 0
        ? (list as ProviderItem[])
        : Array.from(PROVIDER_LIST) as unknown as ProviderItem[];

      const logs = Array.isArray(logsEff.value) ? logsEff.value : [];
      initialLogs = logs as LogItem[];
    }
  } catch (err) {
    console.error('Failed to pre-fetch provider settings server-side:', err);
  }

  return (
    <ProvidersClient
      initialProviders={initialProviders}
      initialLogs={initialLogs}
    />
  );
}
