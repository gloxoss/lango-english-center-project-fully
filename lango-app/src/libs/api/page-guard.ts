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
  allowedRoles: readonly AppRole[];
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
  if (!options.allowedRoles.includes(ctx.role)) {
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
