import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_PERMISSIONS } from '@/libs/api/permissions';
import { FULL_NAVIGATION, filterByPermission, type NavItem } from '@/libs/api/portal-manifest';
import type { AppRole } from '@/libs/api/context';

// Regression: the admin sidebar offered four guard duty-station pages that
// cannot work for an admin.
//
// A school_admin's DEFAULT_ROLE_PERMISSIONS is ALL_PERMISSIONS, so the
// capability gate that hides nav entries from every other role hides nothing
// from them. The guard kiosk home, scanner, visitors and pickups each read the
// viewer's OWN active shift/gate assignment and answer 403 NO_ACTIVE_SHIFT /
// NO_ACTIVE_GATE without one — which no admin ever has. The audit measured all
// four as failing requests (403 GET /api/guard/me/*) in a school_admin pass.
//
// The fix is a role gate on both nav definitions. This test drives the real
// filterByPermission rather than a copy of it, because a reimplementation would
// keep passing while the shipped filter regressed.
//
// DB-backed only because hasCapability reads permission overrides before
// falling back to DEFAULT_ROLE_PERMISSIONS. The ids are random, so no override
// rows exist and the role defaults are exactly what resolves.
const dbReachable = Boolean(process.env.DATABASE_URL);

// The four duty-station routes.
const DUTY_STATION_ROUTES = [
  '/dashboard/portals/guard',
  '/dashboard/portals/guard/scanner',
  '/dashboard/portals/guard/visitors',
  '/dashboard/portals/guard/pickups',
];

const DASHBOARD_ROOT = path.resolve(__dirname, '../../../app/[locale]/(dashboard)/dashboard');

const USER_ID = `USR-T-${crypto.randomUUID()}`;
const TENANT_ID = crypto.randomUUID();

function flattenNavItems(items: NavItem[]): NavItem[] {
  const flat: NavItem[] = [];
  for (const item of items) {
    flat.push(item);
    if (item.children?.length) flat.push(...flattenNavItems(item.children));
  }
  return flat;
}

async function visibleForRole(role: AppRole): Promise<NavItem[]> {
  return flattenNavItems(await filterByPermission(FULL_NAVIGATION, USER_ID, TENANT_ID, role));
}

describe.skipIf(!dbReachable)('guard duty-station nav visibility', () => {
  it('hides all four duty stations from school_admin, who holds every capability', async () => {
    // Precondition for the bug: the capability gate alone lets an admin through.
    for (const route of DUTY_STATION_ROUTES) {
      const item = flattenNavItems(FULL_NAVIGATION).find(i => i.href === route);
      expect(item, `${route} must exist in the nav`).toBeDefined();
      expect(DEFAULT_ROLE_PERMISSIONS.school_admin).toContain(item!.permission);
    }

    const adminHrefs = (await visibleForRole('school_admin')).map(i => i.href);
    for (const route of DUTY_STATION_ROUTES) {
      expect(adminHrefs, `school_admin must not be offered ${route}`).not.toContain(route);
    }
  });

  it('still shows the guard their own duty stations', async () => {
    const guardHrefs = (await visibleForRole('guard')).map(i => i.href);
    for (const route of DUTY_STATION_ROUTES) {
      expect(guardHrefs, `guard must be offered ${route}`).toContain(route);
    }
  });

  it('keeps the security pages an admin can actually use', async () => {
    const adminHrefs = (await visibleForRole('school_admin')).map(i => i.href);
    expect(adminHrefs).toContain('/dashboard/portals/guard/incidents');
    expect(adminHrefs).toContain('/dashboard/portals/guard/config');
  });

  it('points the admin group at a page it can open, not the hidden kiosk home', async () => {
    // The group label is a link. Leaving its href on the guard-only kiosk home
    // would hand the admin the same dead end the child entries were removed to
    // avoid, so the parent is retargeted to its first surviving child.
    const nav = await filterByPermission(FULL_NAVIGATION, USER_ID, TENANT_ID, 'school_admin');
    const group = nav.find(item => item.id === 'guard');
    expect(group).toBeDefined();
    expect(group!.href).not.toBe('/dashboard/portals/guard');
    expect(group!.children!.map(c => c.href)).not.toContain('/dashboard/portals/guard');

    // A guard still lands on the kiosk home, unchanged.
    const guardNav = await filterByPermission(FULL_NAVIGATION, USER_ID, TENANT_ID, 'guard');
    const guardGroup = guardNav.find(item => item.id === 'guard');
    expect(guardGroup!.href).toBe('/dashboard/portals/guard');
  });

  it('role-gates exactly the pages that need a shift, in the page guards too', async () => {
    for (const route of DUTY_STATION_ROUTES) {
      const pagePath = path.join(DASHBOARD_ROOT, route.replace(/^\/dashboard\/?/, ''), 'page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');
      expect(content, `${route} must pass allowedRoles`).toMatch(/allowedRoles:\s*\[\s*'guard'\s*\]/);
      // The capability must stay: dropping it would let a guard open the page
      // without the matching ability, and would break nav/guard parity.
      expect(content, `${route} must keep its capability`).toMatch(/requiredCapability:/);
    }
  });

  it('role-gates the same entries in the admin sidebar, which renders its own copy', async () => {
    // school_admin never reads FULL_NAVIGATION - the sidebar renders
    // schoolNavItems from sidebar.tsx - so fixing the manifest alone would
    // leave the admin's actual sidebar untouched. The sidebar copy is a client
    // component's module-scope array, so this asserts the source shape rather
    // than executing it, the same way nav-page-guard-parity reads page files.
    const sidebar = fs.readFileSync(
      path.resolve(__dirname, '../../../components/shared/sidebar.tsx'),
      'utf8',
    );
    const lines = sidebar.split('\n');

    for (const route of DUTY_STATION_ROUTES) {
      const entryLines = lines.filter(line => line.includes(`href: \`/\${locale}${route}\``));
      expect(entryLines.length, `sidebar must have an entry for ${route}`).toBeGreaterThan(0);
      expect(
        entryLines.some(line => line.includes("roles: ['guard']")),
        `sidebar entry for ${route} must carry roles: ['guard']`,
      ).toBe(true);
    }

    // Incidents and Configuration must stay reachable for an admin.
    for (const route of ['/dashboard/portals/guard/incidents', '/dashboard/portals/guard/config']) {
      const entryLines = lines.filter(line => line.includes(`href: \`/\${locale}${route}\``));
      expect(entryLines.length, `sidebar must have an entry for ${route}`).toBeGreaterThan(0);
      expect(
        entryLines.every(line => !line.includes('roles:')),
        `${route} must stay open to every role holding its capability`,
      ).toBe(true);
    }
  });
});
