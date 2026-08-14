import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { namingSeries } from '@/models/Schema';

/**
 * Reserve the next sequential EMP-{year}-NNNN employee id.
 *
 * naming_series is keyed per (tenant_id, prefix) — a tenant-scoped counter, so
 * different schools never share or collide a sequence. Uniqueness of an
 * employee id is enforced tenant-scoped on employee_profiles.tenant_id +
 * employee_id; the counter may skip but never collides.
 */
export async function reserveEmployeeId(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EMP-${year}-`;

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
