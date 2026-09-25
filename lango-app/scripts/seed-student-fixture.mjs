import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Seeding student credential fixture...');

  // Update STU-003 email to student.001@atlas.ma
  await pool.query(`
    UPDATE "user"
    SET email = 'student.001@atlas.ma', email_verified = true
    WHERE id = 'STU-003';
  `);

  // Ensure account entry exists with password Admin123!
  const passwordHash = 'f76e43584f75b9a8b79744674b49ca10:d7395ff76ded86c76032bc4b79d96855f2172a08b139a50093b29bee5d7275bde19a6815ad457abf2f971ba2a3820d4d85fd04b2f99cacbc5c68e776ca243e9b';
  
  await pool.query(`
    DELETE FROM account WHERE user_id = 'STU-003';
  `);

  await pool.query(`
    INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
    VALUES ('cred-stu-003', 'STU-003', 'credential', 'STU-003', $1, NOW(), NOW());
  `, [passwordHash]);

  console.log('STU-003 credential seeded. Email: student.001@atlas.ma / Password: Admin123!');

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
