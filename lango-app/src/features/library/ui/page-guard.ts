import { redirect } from 'next/navigation';
import { requireAddon } from '@/libs/api/entitlements';
import { requireServerPage } from '@/libs/api/page-guard';
import type { AppRole } from '@/libs/api/context';
import type { PermissionKey } from '@/libs/api/permissions';

export async function requireLibraryPage(locale: string, options: { allowedRoles?: readonly AppRole[]; capability?: PermissionKey }) {
  const context = await requireServerPage(locale, { allowedRoles: options.allowedRoles, requiredCapability: options.capability });
  if (context.tenantId) { try { await requireAddon(context.tenantId, 'library'); } catch { redirect(`/${locale}/dashboard/settings/entitlements?addon=library`); } }
  return context;
}

// Self-service pages (a member's own library data): member roles only, no
// staff capability required. Mirrors requireLibrarySelfContext.
export async function requireLibrarySelfPage(locale: string) {
  const context = await requireServerPage(locale, { allowedRoles: ['student', 'teacher', 'parent', 'alumni'] });
  if (context.tenantId) { try { await requireAddon(context.tenantId, 'library'); } catch { redirect(`/${locale}/dashboard/settings/entitlements?addon=library`); } }
  return context;
}
