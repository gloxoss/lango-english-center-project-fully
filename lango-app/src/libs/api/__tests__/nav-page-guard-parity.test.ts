import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FULL_NAVIGATION, type NavItem } from '@/libs/api/portal-manifest';

const DASHBOARD_ROOT = path.resolve(__dirname, '../../../app/[locale]/(dashboard)/dashboard');

const ROLE_PORTAL_PREFIXES = [
  'teacher',
  'student',
  'parent',
  'super-admin',
  'transport/student',
  'transport/guardian',
  'hostel/me',
  'hostel/guardian',
];

function isRolePortal(route: string): boolean {
  return ROLE_PORTAL_PREFIXES.some(
    prefix => route === prefix || route.startsWith(`${prefix}/`),
  );
}

function walkDashboardPages(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDashboardPages(full));
    } else if (entry.name === 'page.tsx') {
      results.push(full);
    }
  }
  return results;
}

function flattenNavItems(items: NavItem[]): NavItem[] {
  const flat: NavItem[] = [];
  for (const item of items) {
    flat.push(item);
    if (item.children && item.children.length > 0) {
      flat.push(...flattenNavItems(item.children));
    }
  }
  return flat;
}

function hrefToPagePath(href: string): string {
  // Strip search params or hash if present
  const cleanHref = href.split('?')[0]!.split('#')[0]!;
  // Href is like '/dashboard' or '/dashboard/students/parents'
  const relative = cleanHref.replace(/^\/dashboard\/?/, '');
  if (!relative) {
    return path.join(DASHBOARD_ROOT, 'page.tsx');
  }
  return path.join(DASHBOARD_ROOT, relative, 'page.tsx');
}

function extractPageCapability(content: string): string | null {
  const match = content.match(/\b(?:requiredCapability|capability)\s*:\s*['"]([^'"]+)['"]/);
  if (match) return match[1]!;

  if (content.includes('requireLeadershipPage')) {
    if (content.includes('admin: true')) {
      return 'leadership.scope.manage';
    }
    return 'leadership.portal.use';
  }

  return null;
}

describe('D-1: Nav manifest ↔ Page guard parity test', () => {
  const allNavItems = flattenNavItems(FULL_NAVIGATION);
  const permissionGatedItems = allNavItems.filter(item => Boolean(item.permission));

  it('every nav item with a permission points to an existing page file (no dead nav links)', () => {
    const missingPages: string[] = [];

    for (const item of permissionGatedItems) {
      const pagePath = hrefToPagePath(item.href);
      if (!fs.existsSync(pagePath)) {
        missingPages.push(`Nav ID "${item.id}" (href: ${item.href}) -> missing ${pagePath}`);
      }
    }

    expect(
      missingPages,
      `Found dead nav links:\n${missingPages.join('\n')}`,
    ).toHaveLength(0);
  });

  it('every nav item permission matches the target page requiredCapability exactly', () => {
    const mismatches: {
      id: string;
      href: string;
      navPermission: string;
      pageCapability: string | null;
      pageFile: string;
    }[] = [];

    for (const item of permissionGatedItems) {
      const pagePath = hrefToPagePath(item.href);
      if (!fs.existsSync(pagePath)) continue;

      const content = fs.readFileSync(pagePath, 'utf8');
      const pageCap = extractPageCapability(content);

      if (pageCap !== item.permission) {
        mismatches.push({
          id: item.id,
          href: item.href,
          navPermission: item.permission!,
          pageCapability: pageCap,
          pageFile: path.relative(DASHBOARD_ROOT, pagePath).replace(/\\/g, '/'),
        });
      }
    }

    expect(
      mismatches,
      `Found ${mismatches.length} nav ↔ page guard mismatch(es):\n`
      + mismatches.map(m => `  Route: ${m.href} (${m.pageFile})\n    Nav declared permission:   "${m.navPermission}"\n    Page declared capability:   "${m.pageCapability ?? 'NONE'}"`).join('\n\n'),
    ).toHaveLength(0);
  });

  it('all dashboard pages outside role portals use capability-based guarding', () => {
    const allPages = walkDashboardPages(DASHBOARD_ROOT);
    let totalGuarded = 0;
    let capOnlyCount = 0;
    const bareRolePages: string[] = [];

    for (const pageFile of allPages) {
      const route = path.relative(DASHBOARD_ROOT, path.dirname(pageFile)).replace(/\\/g, '/');
      if (isRolePortal(route)) continue;

      const content = fs.readFileSync(pageFile, 'utf8');
      const hasCapability = content.includes('requiredCapability') || content.includes('capability:');
      const hasRoles = content.includes('allowedRoles');

      if (hasCapability || hasRoles) totalGuarded++;
      if (hasCapability && !hasRoles) capOnlyCount++;
      if (hasRoles && !hasCapability) {
        bareRolePages.push(route);
      }
    }

    expect(
      bareRolePages,
      `Found pages using hardcoded allowedRoles without capability:\n${bareRolePages.join('\n')}`,
    ).toHaveLength(0);

    const ratio = totalGuarded > 0 ? capOnlyCount / totalGuarded : 0;
    expect(ratio).toBeGreaterThan(0.95);
  });
});
