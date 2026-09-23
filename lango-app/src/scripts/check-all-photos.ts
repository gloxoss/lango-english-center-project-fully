import { db } from '../libs/DB';
import { user, studentPhotos, studentDocuments, applicantDocuments, tenants } from '../models/Schema';
import { eq, isNotNull } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const allTenants = await db.select().from(tenants);
  console.log(`Found ${allTenants.length} tenants:`);
  for (const t of allTenants) {
    console.log(`- Tenant: ${t.id} (${t.name}, slug=${t.slug})`);
  }

  const studentsWithPhoto = await db
    .select({
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      matricule: user.matricule,
      photoUrl: user.photoUrl,
      image: user.image,
    })
    .from(user)
    .where(isNotNull(user.photoUrl));

  console.log(`Total students with photoUrl across all tenants: ${studentsWithPhoto.length}`);
  for (const s of studentsWithPhoto) {
    console.log(JSON.stringify(s));
  }

  const allPhotos = await db.select().from(studentPhotos);
  console.log(`Total studentPhotos rows across all tenants: ${allPhotos.length}`);
  for (const p of allPhotos) {
    console.log(JSON.stringify(p));
  }

  // Check all directories in uploads
  const uploadsDir = process.env.UPLOADS_DIR || '/app/uploads';
  console.log('Uploads dir:', uploadsDir);
  if (fs.existsSync(uploadsDir)) {
    const listDir = (d: string): string[] => {
      let r: string[] = [];
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, f.name);
        if (f.isDirectory()) r = r.concat(listDir(fp));
        else r.push(fp);
      }
      return r;
    };
    console.log('All files on disk under UPLOADS_ROOT:', listDir(uploadsDir));
  }
}

main().catch(console.error);
