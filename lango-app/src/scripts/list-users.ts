import { db } from '../libs/DB';
import { user } from '../models/Schema';
import { eq } from 'drizzle-orm';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  const rows = await db.select().from(user).where(eq(user.tenantId, tenantId));
  console.log(`Total users: ${rows.length}`);
  for (const r of rows) {
    console.log(`User: id=${r.id}, role=${r.role}, name=${r.name}, matricule=${r.matricule}, photoUrl=${r.photoUrl}, image=${r.image}`);
  }
}

main().catch(console.error);
