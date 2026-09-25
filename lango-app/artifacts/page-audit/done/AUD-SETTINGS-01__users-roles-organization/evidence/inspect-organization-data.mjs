import pg from 'pg';

if (new URL(process.env.DATABASE_URL ?? '').pathname !== '/schoolos_audit') {
  throw new Error('Audit database required');
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(`
    SELECT s.presence_modes, s.document_header_style
    FROM school_settings s JOIN tenants t ON t.id = s.tenant_id
    WHERE t.slug = 'atlas'
  `);
  console.log(JSON.stringify(result.rows[0] ?? null));
} finally {
  await client.end();
}
