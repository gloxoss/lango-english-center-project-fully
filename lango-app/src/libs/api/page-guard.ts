// page-guard.ts
// Server-component authorization guard for admin/leadership pages. The
// dashboard layout only checks authentication; this closes the gap so direct
// URL access by an authenticated but unauthorized role (teacher, student,
// parent, receptionist, accountant…) never renders an admin page.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AppRole } from '@/libs/api/context';
import { hasCapability, type PermissionKey } from '@/libs/api/permissions';
import { hasAddon } from '@/libs/api/entitlements';
import { resolveAddonForPath } from '@/libs/api/page-guard-path';
import { resolveLandingPath } from '@/libs/api/portal-manifest';
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
  /**
   * Optional explicit addon ID that must be active for this page.
   * If omitted, requireServerPage also automatically checks known addon route prefixes.
   */
  requiredAddon?: string;
};

export async function requireServerPage(
  locale: string,
  options: PageGuardOptions,
): Promise<ServerUserContext> {
  const ctx = await getServerUserContext();

  if (!ctx) {
    redirect(`/${locale}/login`);
  }
  if (!options.allowedRoles && !options.requiredCapability && !options.requiredAddon) {
    throw new Error('page-guard: specify allowedRoles, requiredCapability and/or requiredAddon');
  }

  // Super admin belongs strictly to the SaaS platform suite when no tenant is selected.
  // If this page does not explicitly allow super_admin and no tenant is selected, redirect to super-admin dashboard.
  if (ctx.role === 'super_admin' && (!options.allowedRoles || !options.allowedRoles.includes('super_admin'))) {
    if (!ctx.tenantId) {
      redirect(`/${locale}/dashboard/super-admin`);
    }
  }

  // Check addon activation for the school/tenant
  if (ctx.tenantId) {
    let addonToCheck = options.requiredAddon;
    if (!addonToCheck) {
      try {
        const reqHeaders = await headers();
        const currentPath = reqHeaders.get('x-pathname') || '';
        addonToCheck = resolveAddonForPath(currentPath) ?? undefined;
      } catch {
        // headers() might not be available in unit test contexts
      }
    }

    if (addonToCheck) {
      const active = await hasAddon(ctx.tenantId, addonToCheck);
      if (!active) {
        await redirectForMissingAddon(locale, ctx, addonToCheck);
      }
    }
  }

  // Single entitlement rule for super admins (parity with requireRequestContext):
  // a super admin acting inside a selected tenant is treated as school_admin for
  // school pages; the APIs already admit them on that exact condition, so the
  // page guard must not bounce them while the API would serve the data.
  const pageRole: AppRole = ctx.role === 'super_admin' && ctx.tenantId ? 'school_admin' : ctx.role;

  if (options.allowedRoles && !options.allowedRoles.includes(pageRole)) {
    redirect(`/${locale}/dashboard/access-denied`);
  }
  if (options.requiredCapability) {
    const allowed = await hasCapability(
      ctx.userId,
      ctx.tenantId ?? '',
      pageRole,
      options.requiredCapability,
    );
    if (!allowed) {
      redirect(`/${locale}/dashboard/access-denied`);
    }
  }
  return ctx;
}

/**
 * Landing path for a role that is not entitled to open the current page.
 * Admins are sent to the entitlements page (they can act on it); every other
 * role is sent to their own portal home — /settings/entitlements is an admin
 * page a teacher or parent cannot open (audit 2026-09-22, P1-1).
 */
export async function redirectForMissingAddon(
  locale: string,
  ctx: ServerUserContext,
  addonId: string,
): Promise<never> {
  if (ctx.role === 'school_admin' || (ctx.role === 'super_admin' && ctx.tenantId)) {
    redirect(`/${locale}/dashboard/settings/entitlements?addon=${encodeURIComponent(addonId)}`);
  }
  const landing = await resolveLandingPath(ctx);
  redirect(`/${locale}${landing ?? '/dashboard'}`);
}
