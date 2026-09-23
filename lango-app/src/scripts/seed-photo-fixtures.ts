import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { studentPhotos, user } from '@/models/Schema';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  const uploadsBase = process.env.UPLOADS_DIR || 'C:\\app\\uploads';
  const tenantUploadDir = path.resolve(uploadsBase, tenantId);

  console.log('Seeding photo fixtures for tenant:', tenantId);
  console.log('Uploads root:', tenantUploadDir);

  const boyImagePath = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7\\student_portrait_boy_1790166755975.jpg';
  const girlImagePath = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7\\student_portrait_girl_1790166775429.jpg';

  // 1. Reset orphaned photo URLs from old admissions bug
  await db
    .update(user)
    .set({ photoUrl: null })
    .where(and(eq(user.tenantId, tenantId), eq(user.id, 'STD-14745779')));
  await db
    .update(user)
    .set({ photoUrl: null })
    .where(and(eq(user.tenantId, tenantId), eq(user.id, 'STD-13749349')));

  console.log('Reset orphaned photo URLs.');

  // 2. Add real photo for STU-001 (Yassine El Amrani)
  if (fs.existsSync(boyImagePath)) {
    const studentId = 'STU-001';
    const photoId = randomUUID();
    const subpath = `students/${studentId}/${photoId}.jpg`;
    const destPath = path.resolve(tenantUploadDir, subpath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(boyImagePath, destPath);

    await db.insert(studentPhotos).values({
      tenantId,
      studentId,
      url: subpath,
      uploadedBy: null,
    });
    await db
      .update(user)
      .set({ photoUrl: subpath })
      .where(and(eq(user.tenantId, tenantId), eq(user.id, studentId)));

    console.log('Assigned boy portrait to STU-001:', subpath);
  }

  // 3. Add real photo for STU-002 (Salma Bennani)
  if (fs.existsSync(girlImagePath)) {
    const studentId = 'STU-002';
    const photoId = randomUUID();
    const subpath = `students/${studentId}/${photoId}.jpg`;
    const destPath = path.resolve(tenantUploadDir, subpath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(girlImagePath, destPath);

    await db.insert(studentPhotos).values({
      tenantId,
      studentId,
      url: subpath,
      uploadedBy: null,
    });
    await db
      .update(user)
      .set({ photoUrl: subpath })
      .where(and(eq(user.tenantId, tenantId), eq(user.id, studentId)));

    console.log('Assigned girl portrait to STU-002:', subpath);
  }

  console.log('Seeding completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed seeding photo fixtures:', err);
  process.exit(1);
});
