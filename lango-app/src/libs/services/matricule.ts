import { and, eq } from 'drizzle-orm';
import type { db as dbClient } from '@/libs/DB';
import { namingSeries } from '@/models/Schema';

// Real, sequential STD-{year}-#### matricule via the naming_series table -
// shared by direct student creation, admission approval, and bulk import so
// there's exactly one real implementation, not three separately-drifting
// Math.random() fallbacks.
export async function reserveMatricule(db: Pick<typeof dbClient, 'select' | 'update' | 'insert'>, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STD-${year}-`;
  const [series] = await db
    .select()
    .from(namingSeries)
    .where(and(eq(namingSeries.prefix, prefix), eq(namingSeries.tenantId, tenantId)))
    .limit(1);

  let currentVal = 1;
  if (series) {
    currentVal = series.currentVal + 1;
    await db.update(namingSeries).set({ currentVal }).where(and(eq(namingSeries.prefix, prefix), eq(namingSeries.tenantId, tenantId)));
  } else {
    await db.insert(namingSeries).values({ prefix, tenantId, currentVal: 1 });
  }

  return `${prefix}${String(currentVal).padStart(4, '0')}`;
}
