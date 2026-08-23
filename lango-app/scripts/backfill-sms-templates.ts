import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

// One-shot, idempotent backfill: migrates rows from the retired standalone
// `sms_templates` table into the shared Broadcast `communication_templates`
// system (channel='sms', one published version). Safe to re-run — rows already
// present (matched by tenant + channel + name) are skipped.
//
//   npx tsx scripts/backfill-sms-templates.ts

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim();
  }
}

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    const { rows } = await pool.query('SELECT id, tenant_id, name, body, created_at, updated_at FROM sms_templates');
    let created = 0;
    let skipped = 0;
    for (const r of rows) {
      const existing = await pool.query(
        "SELECT id FROM communication_templates WHERE tenant_id = $1 AND channel = 'sms' AND name = $2 LIMIT 1",
        [r.tenant_id, r.name],
      );
      if (existing.rows.length > 0) {
        skipped += 1;
        continue;
      }
      const tpl = await pool.query(
        `INSERT INTO communication_templates (tenant_id, name, channel, category, is_active, created_at, updated_at)
         VALUES ($1, $2, 'sms', 'sms', true, $3, $4) RETURNING id`,
        [r.tenant_id, r.name, r.created_at, r.updated_at],
      );
      await pool.query(
        `INSERT INTO communication_template_versions (tenant_id, template_id, version, body_text, variable_schema, locale, status, provider_approval_status, created_at)
         VALUES ($1, $2, 1, $3, '[]'::jsonb, 'fr', 'published', 'not_required', $4)`,
        [r.tenant_id, tpl.rows[0].id, r.body, r.created_at],
      );
      created += 1;
    }
    console.log(`Backfill complete: ${created} created, ${skipped} skipped (already present).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
