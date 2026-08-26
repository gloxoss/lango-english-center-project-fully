// page-guard.ts
// Server-component authorization guard for admin/leadership pages. The
// dashboard layout only checks authentication; this closes the gap so direct
// URL access by an authenticated but unauthorized role (teacher, student,
// parent, receptionist, accountant…) never renders an admin page.
import { redirect } from 'next/navigation';
import type { AppRole } from '@/libs/api/context';
import { hasCapability, type PermissionKey } from '@/libs/api/permissions';
import { getServerUserContext, type ServerUserContext } from '@/libs/auth/server-context';

export type PageGuardOptions = {
  /**
   * Restrict to specific roles regardless of capability (e.g. a self-service
   * portal home like /dashboard/teacher that isn't gated by a PermissionKey
   * at all). Omit this when the page's access should instead track the
   * capability system (the common case) - see `requiredCapability`.
   */
  allowedRoles?: readonly AppRole[];
  /**
   * Gate by the same PermissionKey the sidebar/portal-manifest uses to decide
   * whether to show this page's nav item. This is the preferred option: it
   * keeps "can I see the link" and "can I open the page" using one source of
   * truth (role defaults + tenant/user overrides via hasCapability), so a
   * page can never end up hardcoded stricter than what the nav promises.
   */
  requiredCapability?: PermissionKey;
};

export async function requireServerPage(
  locale: string,
  options: PageGuardOptions,
): Promise<ServerUserContext> {
  const ctx = await getServerUserContext();

  if (!ctx) {
    redirect(`/${locale}/login`);
  }
  if (!options.allowedRoles && !options.requiredCapability) {
    throw new Error('page-guard: specify allowedRoles and/or requiredCapability');
  }
  if (options.allowedRoles && !options.allowedRoles.includes(ctx.role)) {
    redirect(`/${locale}`);
  }
  if (options.requiredCapability) {
    const allowed = await hasCapability(
      ctx.userId,
      ctx.tenantId ?? '',
      ctx.role,
      options.requiredCapability,
    );
    if (!allowed) {
      redirect(`/${locale}`);
    }
  }
  return ctx;
}
