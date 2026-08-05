import { sql } from 'drizzle-orm';
import { db } from '@/libs/DB';

async function main() {
  console.log('Running Academic Management Enhancement SQL backfill...');

  // 1. Backfill academic_class_offerings
  await db.execute(sql`
    INSERT INTO academic_class_offerings (id, tenant_id, session_year_id, class_id, section_id, capacity, status, display_order)
    SELECT 
      gen_random_uuid(),
      cs.tenant_id,
      sy.id,
      cs.class_id,
      cs.section_id,
      30,
      'active'::status,
      0
    FROM class_sections cs
    INNER JOIN session_years sy ON sy.tenant_id = cs.tenant_id AND sy.is_default = true
    ON CONFLICT (tenant_id, session_year_id, class_id, section_id) DO NOTHING;
  `);
  console.log('✔ academic_class_offerings backfilled.');

  // 2. Link offering_id on class_subjects
  await db.execute(sql`
    UPDATE class_subjects cs
    SET offering_id = aco.id
    FROM academic_class_offerings aco
    INNER JOIN class_sections sec ON sec.class_id = aco.class_id AND sec.section_id = aco.section_id
    WHERE cs.class_id = aco.class_id AND cs.tenant_id = aco.tenant_id AND cs.offering_id IS NULL;
  `);
  console.log('✔ offering_id linked on class_subjects.');

  // 3. Link offering_id on class_teachers
  await db.execute(sql`
    UPDATE class_teachers ct
    SET offering_id = aco.id
    FROM academic_class_offerings aco
    WHERE ct.class_section_id = aco.section_id AND ct.tenant_id = aco.tenant_id AND ct.offering_id IS NULL;
  `);
  console.log('✔ offering_id linked on class_teachers.');

  // 4. Link offering_id on subject_teachers
  await db.execute(sql`
    UPDATE subject_teachers st
    SET offering_id = aco.id
    FROM academic_class_offerings aco
    WHERE st.class_section_id = aco.section_id AND st.tenant_id = aco.tenant_id AND st.offering_id IS NULL;
  `);
  console.log('✔ offering_id linked on subject_teachers.');

  // 5. Link offering_id on class_schedule_slots
  await db.execute(sql`
    UPDATE class_schedule_slots css
    SET offering_id = aco.id
    FROM academic_class_offerings aco
    WHERE css.class_section_id = aco.section_id AND css.tenant_id = aco.tenant_id AND css.offering_id IS NULL;
  `);
  console.log('✔ offering_id linked on class_schedule_slots.');

  console.log('Backfill completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
