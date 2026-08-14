import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import type { AppRole } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireServerPage } from '@/libs/api/page-guard';
import type { PermissionKey } from '@/libs/api/permissions';

export async function requireTransportPage(
  locale: string,
  options: { allowedRoles: readonly AppRole[]; requiredCapability?: PermissionKey },
) {
  const ctx = await requireServerPage(locale, options);
  if (ctx.tenantId) {
    try {
      await requireAddon(ctx.tenantId, 'transport');
    } catch {
      redirect(`/${locale}/dashboard/settings/entitlements?addon=transport`);
    }
  }
  return ctx;
}

export type TransportLayoutProps = { children: ReactNode; params: Promise<{ locale: string }> };

