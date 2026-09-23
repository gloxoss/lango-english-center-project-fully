import { db } from '@/libs/DB';
import { namingSeries, user, tenants } from '@/models/Schema';
import { numberingSeriesDefinitions } from '@/features/settings/models/settings-schema';
import { eq, ilike, sql } from 'drizzle-orm';

async function main() {
  const [atlas] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(ilike(tenants.name, '%Atlas%')).limit(1);
  console.log('Atlas tenant:', atlas);
  if (!atlas) return;

  const naming = await db.select().from(namingSeries).where(eq(namingSeries.tenantId, atlas.id));
  console.log('namingSeries rows:', naming);

  const numbering = await db.select().from(numberingSeriesDefinitions).where(eq(numberingSeriesDefinitions.tenantId, atlas.id));
  console.log('numberingSeriesDefinitions rows:', numbering);

  const patternQuery = await db.execute(sql`
    SELECT 
      CASE 
        WHEN matricule LIKE 'ATL-%' THEN 'ATL-prefix'
        WHEN matricule LIKE 'STD-%' THEN 'STD-prefix'
        WHEN matricule IS NULL OR matricule = '' THEN 'empty'
        ELSE 'other'
      END as pattern,
      count(*) as cnt
    FROM "user"
    WHERE tenant_id = ${atlas.id}::uuid AND role = 'student'
    GROUP BY 1
  `);
  console.log('matricule patterns in user:', patternQuery);

  const sampleStudents = await db.select({ id: user.id, name: user.name, matricule: user.matricule, nationalId: user.nationalId })
    .from(user)
    .where(eq(user.tenantId, atlas.id))
    .limit(10);
  console.log('sampleStudents:', sampleStudents);

  const massarStats = await db.execute(sql`
    SELECT 
      count(*) as total_students,
      count(CASE WHEN national_id IS NOT NULL AND national_id != '' THEN 1 END) as with_massar,
      count(CASE WHEN national_id IS NULL OR national_id = '' THEN 1 END) as without_massar,
      count(CASE WHEN matricule IS NOT NULL AND matricule != '' THEN 1 END) as with_matricule,
      count(CASE WHEN matricule IS NULL OR matricule = '' THEN 1 END) as without_matricule
    FROM "user"
    WHERE tenant_id = ${atlas.id}::uuid AND role = 'student'
  `);
  console.log('massarStats:', massarStats);

  // Check for duplicates
  const duplicateMassar = await db.execute(sql`
    SELECT national_id, count(*) as cnt
    FROM "user"
    WHERE tenant_id = ${atlas.id}::uuid AND role = 'student' AND national_id IS NOT NULL AND national_id != ''
    GROUP BY national_id
    HAVING count(*) > 1
  `);
  console.log('duplicateMassar in tenant:', duplicateMassar);

  const duplicateMatricule = await db.execute(sql`
    SELECT matricule, count(*) as cnt
    FROM "user"
    WHERE tenant_id = ${atlas.id}::uuid AND role = 'student' AND matricule IS NOT NULL AND matricule != ''
    GROUP BY matricule
    HAVING count(*) > 1
  `);
  console.log('duplicateMatricule in tenant:', duplicateMatricule);

  process.exit(0);
}

main().catch(console.error);
