import 'dotenv/config';
import { db } from '@/libs/DB';
import { issuedDocuments } from '@/features/cards/models/cards-schema';
import { issuedCertificates } from '@/features/certificates/models/certificates-schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';

async function main() {
  const cardHash = createHash('sha256').update('atlas-card-token-valid-2026').digest('hex');
  const certHash = createHash('sha256').update('atlas-cert-token-valid-2026').digest('hex');
  
  const [c] = await db.select().from(issuedDocuments).where(eq(issuedDocuments.status, 'active')).limit(1);
  if (c) {
    await db.update(issuedDocuments).set({ publicTokenHash: cardHash }).where(eq(issuedDocuments.id, c.id));
    console.log(`Updated issued card ${c.id} with valid test token`);
  }

  const [crt] = await db.select().from(issuedCertificates).where(eq(issuedCertificates.status, 'valid')).limit(1);
  if (crt) {
    await db.update(issuedCertificates).set({ verificationTokenHash: certHash }).where(eq(issuedCertificates.id, crt.id));
    console.log(`Updated issued certificate ${crt.id} with valid test token`);
  }

  console.log('Test verification tokens updated successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
