import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TENANT_ID = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
const SECTION_ID = '78f69ba3-4383-4a78-9382-fb626ce6fed4';
const TEACHER_ID = 'USR-002';
const STUDENT_ID = 'STU-003';

async function main() {
  console.log('Seeding rich student data for STU-003...');

  // 1. Assign subjects to class section
  const subjects = [
    { id: '4aa6381f-092d-4e0a-8a65-ad39ea4ee4e6', csId: '674664e1-82bb-4243-9198-cd30f7cd277f', name: 'Mathématiques' },
    { id: 'a97e10e3-54da-41b8-83d1-2982b6cfbe34', csId: '8dcd2e5d-d45f-47bd-bd1c-45381a7518a5', name: 'Français' },
    { id: 'ddd45f3e-aac7-40e7-95ad-6f9ad975c13b', csId: '8547a7be-3b13-48ff-820b-738e48934283', name: 'Arabe' },
  ];

  await pool.query(`DELETE FROM subject_teachers WHERE tenant_id = $1 AND class_section_id = $2;`, [TENANT_ID, SECTION_ID]);

  for (const s of subjects) {
    await pool.query(`
      INSERT INTO subject_teachers (id, tenant_id, class_section_id, subject_id, class_subject_id, teacher_id, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW());
    `, [TENANT_ID, SECTION_ID, s.id, s.csId, TEACHER_ID]);
  }
  console.log('Assigned 3 subjects to section.');

  // 2. Schedule slots
  await pool.query(`DELETE FROM class_schedule_slots WHERE tenant_id = $1 AND class_section_id = $2;`, [TENANT_ID, SECTION_ID]);

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  for (const day of days) {
    await pool.query(`
      INSERT INTO class_schedule_slots (id, tenant_id, class_section_id, class_subject_id, teacher_id, day_of_week, start_time, end_time, room_label, created_at, updated_at)
      VALUES 
        (gen_random_uuid(), $1, $2, $3, $4, $5, '08:30', '10:00', 'Salle 102', NOW(), NOW()),
        (gen_random_uuid(), $1, $2, $6, $4, $5, '10:15', '11:45', 'Salle 102', NOW(), NOW()),
        (gen_random_uuid(), $1, $2, $7, $4, $5, '14:00', '15:30', 'Laboratoire 1', NOW(), NOW());
    `, [
      TENANT_ID,
      SECTION_ID,
      subjects[0].csId,
      TEACHER_ID,
      day,
      subjects[1].csId,
      subjects[2].csId,
    ]);
  }
  console.log('Created schedule slots for all 5 weekdays.');

  // 3. Announcements
  await pool.query(`
    INSERT INTO announcements (id, tenant_id, title, body, target_role, created_by_id, published_at, created_at)
    VALUES 
      (gen_random_uuid(), $1, 'Bienvenue à l''année scolaire 2026-2027', 'Nous souhaitons la bienvenue à tous nos élèves pour cette nouvelle rentrée académique.', 'student', 'USR-001', NOW(), NOW()),
      (gen_random_uuid(), $1, 'Calendrier des devoirs surveillés', 'Le calendrier détaillé des devoirs surveillés du premier semestre est disponible.', 'student', 'USR-001', NOW(), NOW())
    ON CONFLICT DO NOTHING;
  `, [TENANT_ID]);
  console.log('Seeded announcements.');

  // 4. Attendance records
  await pool.query(`DELETE FROM attendance WHERE tenant_id = $1 AND student_id = $2;`, [TENANT_ID, STUDENT_ID]);

  const datesAndStatuses = [
    { date: '2026-09-24', status: 'present', period: 1, note: null },
    { date: '2026-09-23', status: 'present', period: 1, note: null },
    { date: '2026-09-22', status: 'late', period: 1, note: 'Retard de 10 min - transport' },
    { date: '2026-09-19', status: 'excused', period: 1, note: 'Certificat médical' },
    { date: '2026-09-18', status: 'present', period: 1, note: null },
    { date: '2026-09-17', status: 'absent', period: 1, note: 'Absence non justifiée' },
    { date: '2026-09-16', status: 'present', period: 1, note: null },
  ];

  const ACADEMIC_YEAR_ID = 'a932d29a-b18e-4bdf-8a97-dce2d3f8f144';
  for (const r of datesAndStatuses) {
    await pool.query(`
      INSERT INTO attendance (id, tenant_id, student_id, class_section_id, academic_year_id, date, status, period, note, is_voided, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW());
    `, [TENANT_ID, STUDENT_ID, SECTION_ID, ACADEMIC_YEAR_ID, r.date, r.status, r.period, r.note]);
  }
  console.log('Seeded 7 attendance records.');

  await pool.end();
}

main().catch(console.error);
