import { db } from '../libs/DB';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  
  // Check documents tables
  const tables = ['admission_documents', 'student_documents', 'documents', 'applicant_documents', 'student_admissions'];
  for (const t of tables) {
    try {
      const res = await db.execute(sql.raw(`SELECT * FROM ${t} WHERE tenant_id = '${tenantId}' LIMIT 10`));
      console.log(`Table ${t} rows:`, res.rows?.length ?? 0);
      if (res.rows && res.rows.length > 0) {
        console.log(`Sample row from ${t}:`, JSON.stringify(res.rows[0], null, 2));
      }
    } catch (e: any) {
      console.log(`Table ${t} query error: ${e.message}`);
    }
  }

  // Check all files in C:\app\uploads or process.env.UPLOADS_DIR
  const uploadsDir = process.env.UPLOADS_DIR || '/app/uploads';
  console.log('Uploads dir:', uploadsDir);
  if (fs.existsSync(uploadsDir)) {
    const listAll = (d: string): string[] => {
      let res: string[] = [];
      for (const item of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, item.name);
        if (item.isDirectory()) res = res.concat(listAll(full));
        else res.push(full);
      }
      return res;
    };
    console.log('All files under uploadsDir:\n' + listAll(uploadsDir).join('\n'));
  }

  // Check what logo.jpg is in the tenant directory
  const logoPath = path.resolve(uploadsDir, tenantId, 'logo.jpg');
  if (fs.existsSync(logoPath)) {
    const stats = fs.statSync(logoPath);
    console.log(`logo.jpg size: ${stats.size} bytes, created: ${stats.birthtime}, modified: ${stats.mtime}`);
  }
}

main().catch(console.error);
