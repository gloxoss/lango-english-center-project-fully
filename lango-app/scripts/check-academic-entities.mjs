import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TENANT_ID = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
const SECTION_ID = '78f69ba3-4383-4a78-9382-fb626ce6fed4';

async function main() {
  const { rows: tRows } = await pool.query(`SELECT id, name FROM "user" WHERE tenant_id = $1 AND role = 'teacher' LIMIT 5;`, [TENANT_ID]);
  console.log('Teachers:', tRows);

  const { rows: sRows } = await pool.query(`SELECT id, name, code FROM subjects WHERE tenant_id = $1 LIMIT 5;`, [TENANT_ID]);
  console.log('Subjects:', sRows);

  const { rows: stRows } = await pool.query(`SELECT * FROM subject_teachers WHERE tenant_id = $1 AND class_section_id = $2;`, [TENANT_ID, SECTION_ID]);
  console.log('Existing subject_teachers for section:', stRows);

  const { rows: slotRows } = await pool.query(`SELECT * FROM class_schedule_slots WHERE tenant_id = $1 AND class_section_id = $2;`, [TENANT_ID, SECTION_ID]);
  console.log('Existing schedule slots for section:', slotRows.length);

  await pool.end();
}

main().catch(console.error);
