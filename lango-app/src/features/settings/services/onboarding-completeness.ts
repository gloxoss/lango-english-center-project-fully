import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { schoolSettings, tenants } from '@/models/Schema';

/** Core fields a newly provisioned school must supply before entering SchoolOS. */
export async function isSchoolOnboardingComplete(tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({
      logoUrl: tenants.logoUrl,
      address: schoolSettings.address,
      academicYear: schoolSettings.academicYear,
    })
    .from(tenants)
    .leftJoin(
      schoolSettings,
      and(eq(schoolSettings.tenantId, tenants.id), eq(schoolSettings.tenantId, tenantId)),
    )
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return Boolean(
    row?.logoUrl?.trim()
    && row.address?.trim()
    && row.academicYear?.trim(),
  );
}
