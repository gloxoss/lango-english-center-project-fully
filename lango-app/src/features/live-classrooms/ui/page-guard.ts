// Server-page guard for Live Classrooms pages: auth + role + addon + capability.
// Redirects to login on anonymous, home on unauthorized, and a not-activated
// screen when the addon entitlement is off (mirrors requireAddon's 403 code).
import { redirect } from 'next/navigation';
import { requireAddon } from '@/libs/api/entitlements';
import { requireServerPage } from '@/libs/api/page-guard';
import type { PermissionKey } from '@/libs/api/permissions';
import type { AppRole } from '@/libs/api/context';
import type { ServerUserContext } from '@/libs/auth/server-context';

export async function requireLivePage(
  locale: string,
  opts: { allowedRoles?: readonly AppRole[]; requiredCapability: PermissionKey },
): Promise<ServerUserContext> {
  const ctx = await requireServerPage(locale, {
    allowedRoles: opts.allowedRoles,
    requiredCapability: opts.requiredCapability,
  });
  if (ctx.tenantId) {
    try {
      await requireAddon(ctx.tenantId, 'live-classrooms');
    } catch {
      redirect(`/${locale}/dashboard/settings/entitlements?addon=live-classrooms`);
    }
  }
  return ctx;
}
