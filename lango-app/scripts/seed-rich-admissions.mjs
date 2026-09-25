import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve('.env') });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  const tenantRes = await client.query("SELECT id, name FROM tenants WHERE name ILIKE '%Atlas%' LIMIT 1");
  const tenant = tenantRes.rows[0];
  const tenantId = tenant.id;

  const branchRes = await client.query('SELECT id FROM branches WHERE tenant_id = $1 LIMIT 1', [tenantId]);
  const branchId = branchRes.rows[0]?.id;

  const sessionRes = await client.query(
    'SELECT id FROM session_years WHERE tenant_id = $1 AND is_default = true LIMIT 1',
    [tenantId]
  );
  const sessionId = sessionRes.rows[0]?.id;

  console.log(`Target: tenant=${tenantId}, branch=${branchId}, session=${sessionId}`);

  // 1. Seed Inquiries if none exist
  const inqCount = await client.query('SELECT count(*) FROM inquiries WHERE tenant_id = $1', [tenantId]);
  if (parseInt(inqCount.rows[0].count, 10) === 0) {
    console.log('Seeding prospective inquiries...');
    await client.query(`
      INSERT INTO inquiries (id, tenant_id, contact_name, phone, email, source, interest_level, status, notes)
      VALUES 
        (gen_random_uuid(), $1, 'Driss Benali', '+212661234567', 'driss.benali@gmail.com', 'walk_in', 'high', 'new', 'Intéressé par inscription en 2nde Sciences pour son fils.'),
        (gen_random_uuid(), $1, 'Nadia Tazi', '+212662987654', 'nadia.tazi@hotmail.com', 'web', 'medium', 'contacted', 'Demande d''information sur les frais et le transport.')
    `, [tenantId]);
    console.log('Inquiries seeded.');
  }

  // 2. Ensure rejected applicant exists for full lifecycle coverage
  const rejCheck = await client.query("SELECT id FROM applicants WHERE tenant_id = $1 AND status = 'rejected' LIMIT 1", [tenantId]);
  if (rejCheck.rows.length === 0) {
    console.log('Seeding rejected candidate for lifecycle audit...');
    await client.query(`
      INSERT INTO applicants (
        id, tenant_id, branch_id, session_year_id, first_name, last_name, email, phone,
        gender, date_of_birth, city, national_id, status, rejection_reason, rejected_at,
        guardian_name, guardian_phone, guardian_email, application_date
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'Tariq', 'Mansour', 'tariq.mansour@gmail.com', '+212665544332',
        'male', '2010-04-12', 'Casablanca', 'R889900112', 'rejected', 'Capacité de la filière atteinte pour cette session.', NOW(),
        'Hassan Mansour', '+212665544330', 'hassan.mansour@gmail.com', NOW() - INTERVAL '5 days'
      )
    `, [tenantId, branchId, sessionId]);
    console.log('Rejected candidate seeded.');
  }

  // 3. Ensure candidate with scheduled interview exists
  const intCheck = await client.query("SELECT id FROM applicants WHERE tenant_id = $1 AND status = 'interview_scheduled' LIMIT 1", [tenantId]);
  if (intCheck.rows.length === 0) {
    console.log('Seeding interview-scheduled candidate...');
    const newCand = await client.query(`
      INSERT INTO applicants (
        id, tenant_id, branch_id, session_year_id, first_name, last_name, email, phone,
        gender, date_of_birth, city, national_id, status, checklist_documents_received, checklist_file_complete,
        guardian_name, guardian_phone, guardian_email, application_date
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'Younes', 'Chaoui', 'younes.chaoui@gmail.com', '+212677889900',
        'male', '2010-08-20', 'Casablanca', 'R123498765', 'interview_scheduled', true, true,
        'Rachid Chaoui', '+212677889901', 'rachid.chaoui@gmail.com', NOW() - INTERVAL '3 days'
      ) RETURNING id
    `, [tenantId, branchId, sessionId]);
    const candId = newCand.rows[0].id;

    await client.query(`
      INSERT INTO admission_interviews (
        id, tenant_id, applicant_id, scheduled_at, interviewer_id, location, status, notes
      ) VALUES (
        gen_random_uuid(), $1, $2, NOW() + INTERVAL '2 days', 'USR-001', 'Bureau Direction - Salle 101', 'scheduled', 'Entretien oral d''admission et test linguistique.'
      )
    `, [tenantId, candId]);
    console.log('Interview-scheduled candidate seeded.');
  }

  // 4. Print current distribution
  const dist = await client.query(`
    SELECT status, count(*) FROM applicants WHERE tenant_id = $1 GROUP BY status ORDER BY count(*) DESC
  `, [tenantId]);
  console.log('\nApplicants Distribution:');
  for (const d of dist.rows) {
    console.log(`- ${d.status}: ${d.count}`);
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
