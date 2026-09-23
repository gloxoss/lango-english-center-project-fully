// page-guard-path.ts
// Pure path helpers for the add-on page gate, extracted from page-guard.ts so
// they can be unit-tested without next/headers. The locale prefix MUST be
// stripped with an exact locale alternation: middleware always prefixes
// dashboard URLs with /fr, /ar or /en, so a lazy `/^\/[a-z]{2}(\/|$)/` strip
// produced '//dashboard/hostel', which matched no add-on prefix and silently
// disabled the whole gate (audit 2026-09-22, P1-1).

export type RouteAddonPrefix = { prefix: string; addonId: string };

export const ROUTE_ADDON_PREFIXES: RouteAddonPrefix[] = [
  { prefix: '/dashboard/transport', addonId: 'transport' },
  { prefix: '/dashboard/hostel', addonId: 'hostel' },
  { prefix: '/dashboard/library', addonId: 'library' },
  { prefix: '/dashboard/portals/librarian', addonId: 'library' },
  { prefix: '/dashboard/inventory', addonId: 'inventory' },
  { prefix: '/dashboard/events', addonId: 'event-management' },
  { prefix: '/dashboard/hr', addonId: 'human-resources' },
  { prefix: '/dashboard/workforce', addonId: 'payroll-workforce' },
  { prefix: '/dashboard/cards', addonId: 'card-management' },
  { prefix: '/dashboard/certificates', addonId: 'certificate-management' },
  { prefix: '/dashboard/academics/live-class', addonId: 'live-classrooms' },
  { prefix: '/dashboard/academics/assessment/online-exams', addonId: 'online-examinations' },
  { prefix: '/dashboard/content/library', addonId: 'attachments-book' },
  { prefix: '/dashboard/content/types', addonId: 'attachments-book' },
  { prefix: '/dashboard/communication/crm', addonId: 'lead-crm' },
  { prefix: '/dashboard/broadcast', addonId: 'broadcast-messaging' },
  { prefix: '/dashboard/reports', addonId: 'advanced-reporting' },
  { prefix: '/dashboard/settings/live-classrooms', addonId: 'live-classrooms' },
  { prefix: '/dashboard/settings/website', addonId: 'school-website-cms' },
  { prefix: '/dashboard/settings/branches', addonId: 'multi-branch' },
  { prefix: '/dashboard/student/live-classes', addonId: 'live-classrooms' },
  { prefix: '/dashboard/parent/live-classes', addonId: 'live-classrooms' },
];

/**
 * Remove the i18n locale prefix from a pathname. Only the locales the
 * middleware actually emits are stripped, and only on a segment boundary
 * (`/franken-dashboard` is left alone).
 */
export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, '');
}

/**
 * Resolve which add-on a dashboard pathname belongs to, or null when the path
 * is not add-on gated. Accepts both locale-prefixed and bare paths.
 */
export function resolveAddonForPath(pathname: string): string | null {
  const normalized = stripLocalePrefix(pathname);
  const match = ROUTE_ADDON_PREFIXES.find((p) => normalized === p.prefix || normalized.startsWith(`${p.prefix}/`));
  return match?.addonId ?? null;
}
