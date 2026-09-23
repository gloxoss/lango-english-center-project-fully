import { db } from '../libs/DB';
import { user, studentPhotos } from '../models/Schema';
import { eq, and } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      matricule: user.matricule,
      photoUrl: user.photoUrl,
      image: user.image,
    })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

  console.log(`Total students for tenant: ${students.length}`);
  const withPhoto = students.filter(s => s.photoUrl != null);
  console.log(`Students with photoUrl: ${withPhoto.length}`);
  for (const s of withPhoto) {
    console.log(`Student ID: ${s.id}, Name: ${s.name}, Matricule: ${s.matricule}, photoUrl: ${s.photoUrl}, image: ${s.image}`);
  }

  const photos = await db.select().from(studentPhotos).where(eq(studentPhotos.tenantId, tenantId));
  console.log(`Total studentPhotos rows: ${photos.length}`);
  for (const p of photos) {
    console.log(`Photo row: id=${p.id}, studentId=${p.studentId}, url=${p.url}, uploadedBy=${p.uploadedBy}, uploadedAt=${p.uploadedAt}`);
  }

  const uploadsDir = process.env.UPLOADS_DIR || '/app/uploads';
  console.log('UPLOADS_ROOT:', uploadsDir);
  const tenantDir = path.resolve(uploadsDir, tenantId);
  console.log('TenantDir:', tenantDir, 'exists?', fs.existsSync(tenantDir));
  if (fs.existsSync(tenantDir)) {
    const listDir = (dir: string, base = ''): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let files: string[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.join(base, e.name);
        if (e.isDirectory()) {
          files = files.concat(listDir(full, rel));
        } else {
          const stats = fs.statSync(full);
          files.push(`${rel} (${stats.size} bytes)`);
        }
      }
      return files;
    };
    console.log('TenantDir contents:\n' + listDir(tenantDir).join('\n'));
  }
}

main().catch(console.error);
