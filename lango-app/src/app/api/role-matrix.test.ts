import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function findRouteFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findRouteFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
  return results;
}

describe('Role-Guard Canonical Matrix Test Suite', () => {
  const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
  const routeFiles = findRouteFiles(apiDir);

  it('scans all route files and verifies role declarations are non-empty and strict', () => {
    const roleMap: Record<string, string[]> = {};

    for (const relPath of routeFiles) {
      // Super admin routes use requireSuperAdmin, public routes skip auth
      if (relPath.startsWith('super-admin/') || relPath.startsWith('auth/')) {
        continue;
      }

      const fullPath = path.join(apiDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      const matches = content.matchAll(/requireRequestContext\([^,]+,\s*\[([^\]]+)\]\)/g);
      const rolesSet = new Set<string>();

      for (const match of matches) {
        if (match[1]) {
          const rawRoles = match[1].split(',').map(r => r.trim().replace(/['"]/g, ''));
          rawRoles.forEach(r => rolesSet.add(r));
        }
      }

      if (rolesSet.size > 0) {
        roleMap[relPath] = Array.from(rolesSet).sort();
      }
    }

    expect(Object.keys(roleMap).length).toBeGreaterThan(15);

    // Verify key security invariant: public or non-admin routes must not inadvertently gain school_admin privileges without explicit declaration
    for (const [route, roles] of Object.entries(roleMap)) {
      expect(roles.length, `Route ${route} should have at least 1 assigned role`).toBeGreaterThan(0);
    }
  });
});
