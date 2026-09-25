import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  
  const entRes = await pool.query(
    'SELECT * FROM addon_entitlements WHERE addon_id = $1',
    ['attachments-book']
  );
  console.log('All tenants with attachments-book:', entRes.rows);

  const typesRows = await pool.query('SELECT * FROM attachment_types');
  console.log('Attachment types rows:', typesRows.rows);

  const assetsRows = await pool.query('SELECT * FROM digital_assets');
  console.log('Digital assets rows:', assetsRows.rows);

  const atlas = await pool.query("SELECT id, name, slug FROM tenants WHERE slug = 'atlas'");
  console.log('Atlas tenant:', atlas.rows[0]);

  const u = await pool.query('SELECT id, email, role, two_factor_enabled FROM "user" WHERE email = $1', ['y.elamrani@atlas.ma']);
  console.log('User y.elamrani:', u.rows[0]);

  const allAdmins = await pool.query('SELECT id, email, role, two_factor_enabled FROM "user" WHERE role = $1 AND tenant_id = $2', ['school_admin', atlas.rows[0].id]);
  console.log('All admins in Atlas:', allAdmins.rows);

  await pool.end();
}

main().catch(console.error);
