import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { branches } from '@/models/Schema';

export async function ensureDefaultBranch(tenantId: string): Promise<string> {
  const existing = await db
    .select()
    .from(branches)
    .where(eq(branches.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0 && existing[0]?.id) {
    return existing[0].id;
  }

  const [created] = await db
    .insert(branches)
    .values({
      tenantId,
      name: 'Campus Principal',
      code: 'MAIN',
      isDefault: true,
      isActive: true,
    })
    .returning();

  if (!created?.id) {
    throw new Error('Erreur lors de la création de la succursale par défaut.');
  }

  return created.id;
}
