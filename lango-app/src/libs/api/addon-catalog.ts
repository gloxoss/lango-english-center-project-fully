import { asc, eq } from 'drizzle-orm';
import { ADDONS } from '@/addons/registry';
import { db } from '@/libs/DB';
import { addonDefinitions } from '@/models/Schema';

export type AddonDefinition = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  requires: string[];
};

function fromStatic(): AddonDefinition[] {
  return ADDONS.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    enabled: a.enabled,
    requires: a.requires ?? [],
  }));
}

// DB-driven addon catalog. The `addon_definitions` table is seeded from the
// registry on migration; if it's empty (e.g. a fresh DB that hasn't been
// migrated yet) we fall back to the static registry so the catalog is never
// rendered empty. Adding a module now needs a DB row, not a code change.
export async function listAddonDefinitions(): Promise<AddonDefinition[]> {
  const rows = await db.select().from(addonDefinitions).orderBy(asc(addonDefinitions.sortOrder));
  if (rows.length === 0) return fromStatic();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    enabled: r.enabled,
    requires: r.requires ?? [],
  }));
}

export async function getAddonDefinition(id: string): Promise<AddonDefinition | undefined> {
  const [row] = await db
    .select()
    .from(addonDefinitions)
    .where(eq(addonDefinitions.id, id))
    .limit(1);
  if (row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      requires: row.requires ?? [],
    };
  }
  return fromStatic().find((a) => a.id === id);
}
