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
    FROM class_sections sec
    INNER JOIN academic_class_offerings aco ON aco.class_id = sec.class_id AND aco.section_id = sec.section_id AND aco.tenant_id = sec.tenant_id
    WHERE cs.class_id = sec.class_id AND cs.tenant_id = sec.tenant_id AND cs.offering_id IS NULL;
  `);
  console.log('✔ offering_id linked on class_subjects.');

  // 2b. Deduplicate active primary class teachers before backfill/indexing
  await db.execute(sql`
    WITH ranked_primary AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY tenant_id, class_section_id, role 
               ORDER BY created_at DESC, id DESC
             ) as rn
      FROM class_teachers
      WHERE role = 'primary' AND ends_on IS NULL
    )
    UPDATE class_teachers
    SET ends_on = CURRENT_DATE, status = 'inactive'::status
    WHERE id IN (SELECT id FROM ranked_primary WHERE rn > 1);
  `);
  console.log('✔ Duplicate active primary class_teachers resolved.');

  // 3. Link offering_id on class_teachers
  await db.execute(sql`
    UPDATE class_teachers ct
    SET offering_id = aco.id
    FROM class_sections sec
    INNER JOIN academic_class_offerings aco ON aco.class_id = sec.class_id AND aco.section_id = sec.section_id AND aco.tenant_id = sec.tenant_id
    WHERE sec.id = ct.class_section_id AND ct.offering_id IS NULL;
  `);
  console.log('✔ offering_id linked on class_teachers.');

  // 4. Link offering_id on subject_teachers
  await db.execute(sql`
    UPDATE subject_teachers st
    SET offering_id = aco.id
    FROM class_sections sec
    INNER JOIN academic_class_offerings aco ON aco.class_id = sec.class_id AND aco.section_id = sec.section_id AND aco.tenant_id = sec.tenant_id
    WHERE sec.id = st.class_section_id AND st.offering_id IS NULL;
  `);
  console.log('✔ offering_id linked on subject_teachers.');

  // 5. Link offering_id on class_schedule_slots
  await db.execute(sql`
    UPDATE class_schedule_slots css
    SET offering_id = aco.id
    FROM class_sections sec
    INNER JOIN academic_class_offerings aco ON aco.class_id = sec.class_id AND aco.section_id = sec.section_id AND aco.tenant_id = sec.tenant_id
    WHERE sec.id = css.class_section_id AND css.offering_id IS NULL;
  `);
  console.log('✔ offering_id linked on class_schedule_slots.');

  console.log('Backfill completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
