const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
  });
  await client.connect();

  const tenants = await client.query("select id, name, slug from tenants order by created_at limit 10");
  console.log('TENANTS:');
  for (const t of tenants.rows) console.log(' ', t.id, '|', t.name, '|', t.slug);

  for (const t of tenants.rows) {
    const counts = await client.query(
      `select
        (select count(*) from classes where tenant_id = $1) as classes,
        (select count(*) from class_sections where tenant_id = $1) as sections,
        (select count(*) from subjects where tenant_id = $1) as subjects,
        (select count(*) from mediums where tenant_id = $1) as mediums,
        (select count(*) from streams where tenant_id = $1) as streams,
        (select count(*) from semesters where tenant_id = $1) as semesters,
        (select count(*) from shifts where tenant_id = $1) as shifts,
        (select count(*) from "user" where tenant_id = $1 and role = 'school_admin') as admins,
        (select count(*) from "user" where tenant_id = $1 and role = 'student') as students,
        (select count(*) from student_placements where tenant_id = $1 and is_current = true) as placements,
        (select count(*) from subject_teachers where tenant_id = $1) as subject_teachers,
        (select count(*) from attendance where tenant_id = $1) as attendance`,
      [t.id],
    );
    console.log('COUNTS', t.slug, JSON.stringify(counts.rows[0]));
  }

  const admins = await client.query(
    "select id, tenant_id, name, email, role, branch_id from \"user\" where role in ('school_admin','super_admin') order by created_at limit 15",
  );
  console.log('ADMINS:');
  for (const a of admins.rows) console.log(' ', a.id, '|', a.email, '|', a.role, '|', a.tenant_id);

  await client.end();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
