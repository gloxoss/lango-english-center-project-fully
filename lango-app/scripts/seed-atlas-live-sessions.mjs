import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  console.log(`Checking live sessions for Atlas tenant: ${tenantId}...`);

  const prov = await pool.query('SELECT id FROM live_class_provider_profiles WHERE tenant_id = $1 AND enabled = true LIMIT 1', [tenantId]);
  if (prov.rows.length === 0) {
    console.error('No provider profile for Atlas');
    return;
  }
  const profileId = prov.rows[0].id;

  const tRes = await pool.query('SELECT id, name FROM "user" WHERE tenant_id = $1 AND role = $2 LIMIT 1', [tenantId, 'teacher']);
  const sRes = await pool.query('SELECT id, name, class_section_id FROM "user" WHERE tenant_id = $1 AND role = $2 LIMIT 1', [tenantId, 'student']);
  const teacher = tRes.rows[0];
  const student = sRes.rows[0];

  console.log('Teacher:', teacher?.name, 'Student:', student?.name);

  const csRes = await pool.query('SELECT cs.id, cs.class_id, cs.subject_id FROM class_subjects cs WHERE cs.tenant_id = $1 LIMIT 1', [tenantId]);
  const classSubject = csRes.rows[0];
  if (!classSubject) {
    console.error('No class subject found for Atlas');
    return;
  }

  const secRes = await pool.query('SELECT cs.id, cs.class_id FROM class_sections cs WHERE cs.tenant_id = $1 AND cs.class_id = $2 LIMIT 1', [tenantId, classSubject.class_id]);
  const section = secRes.rows[0];
  if (!section) {
    console.error('No class section matching class subject for Atlas');
    return;
  }

  // Update student class section if missing
  if (student && (!student.class_section_id || student.class_section_id !== section.id)) {
    await pool.query('UPDATE "user" SET class_section_id = $1 WHERE id = $2', [section.id, student.id]);
    console.log(`Linked student ${student.id} to section ${section.id}`);
  }

  // Check if live session already exists
  const existing = await pool.query('SELECT id, title, status FROM live_class_sessions WHERE tenant_id = $1', [tenantId]);
  console.log(`Found ${existing.rows.length} existing sessions in Atlas.`);

  if (existing.rows.length === 0) {
    const s1Id = crypto.randomUUID();
    const now = new Date();
    const start1 = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
    const end1 = new Date(now.getTime() + 40 * 60 * 1000).toISOString();

    await pool.query(`
      INSERT INTO live_class_sessions (
        id, tenant_id, provider_profile_id, class_section_id, class_subject_id, teacher_user_id, creator_user_id,
        title, description, objectives, scheduled_start, scheduled_end, timezone, status,
        provider_meeting_id, policy, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'Cours Virtuel - Mathématiques Avancées (Algèbre)',
        'Session interactive de révision sur les matrices et les espaces vectoriels',
        'Maîtriser le calcul matriciel et la résolution de systèmes linéaires',
        $8, $9, 'Africa/Casablanca', 'live',
        'bbb-room-atlas-001',
        '{"recordingEnabled": true, "allowChat": true, "muteOnEntry": true, "guestAccess": false, "maxParticipants": 40}',
        NOW(), NOW()
      )
    `, [s1Id, tenantId, profileId, section.id, classSubject.id, teacher.id, teacher.id, start1, end1]);

    // Student invitation
    await pool.query(`
      INSERT INTO live_class_invitations (
        id, tenant_id, session_id, user_id, participant_role, join_eligible, delivery_state, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'viewer', true, 'delivered', NOW(), NOW())
    `, [crypto.randomUUID(), tenantId, s1Id, student.id]);

    // Second session: Scheduled tomorrow
    const s2Id = crypto.randomUUID();
    const start2 = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const end2 = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    await pool.query(`
      INSERT INTO live_class_sessions (
        id, tenant_id, provider_profile_id, class_section_id, class_subject_id, teacher_user_id, creator_user_id,
        title, description, objectives, scheduled_start, scheduled_end, timezone, status,
        provider_meeting_id, policy, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'Atelier Virtuel - Préparation aux Examens Nationaux',
        'Résolution guidée des annales du Baccalauréat marocain',
        'Comprendre la structure des énoncés et les barèmes de notation',
        $8, $9, 'Africa/Casablanca', 'scheduled',
        'bbb-room-atlas-002',
        '{"recordingEnabled": true, "allowChat": true, "muteOnEntry": false, "guestAccess": false, "maxParticipants": 50}',
        NOW(), NOW()
      )
    `, [s2Id, tenantId, profileId, section.id, classSubject.id, teacher.id, teacher.id, start2, end2]);

    await pool.query(`
      INSERT INTO live_class_invitations (
        id, tenant_id, session_id, user_id, participant_role, join_eligible, delivery_state, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'viewer', true, 'delivered', NOW(), NOW())
    `, [crypto.randomUUID(), tenantId, s2Id, student.id]);

    console.log(`Seeded 2 live sessions for Atlas: live=${s1Id}, scheduled=${s2Id}`);
  }

  const allSessions = await pool.query('SELECT id FROM live_class_sessions WHERE tenant_id = $1', [tenantId]);
  for (const row of allSessions.rows) {
    await pool.query(`
      INSERT INTO live_class_invitations (
        id, tenant_id, session_id, user_id, participant_role, join_eligible, delivery_state, created_at, updated_at
      ) VALUES ($1, $2, $3, 'STU-003', 'viewer', true, 'delivered', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, [crypto.randomUUID(), tenantId, row.id]);
  }
  console.log(`Ensured invitations for STU-003 across ${allSessions.rows.length} sessions.`);

  const finalSessions = await pool.query('SELECT id, title, status FROM live_class_sessions WHERE tenant_id = $1', [tenantId]);
  console.log('Atlas live sessions now:', finalSessions.rows);

  await pool.end();
}

main().catch(console.error);
