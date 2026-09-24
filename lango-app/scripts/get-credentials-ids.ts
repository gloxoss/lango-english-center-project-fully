import 'dotenv/config';
import { db } from '@/libs/DB';
import { documentTemplates, issuedDocuments } from '@/features/cards/models/cards-schema';
import { certificateDefinitions, certificateTemplates, issuedCertificates } from '@/features/certificates/models/certificates-schema';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  const cards = await db.select().from(documentTemplates).where(eq(documentTemplates.tenantId, tenantId)).limit(2);
  const issuedCards = await db.select().from(issuedDocuments).where(eq(issuedDocuments.tenantId, tenantId)).limit(2);
  const defs = await db.select().from(certificateDefinitions).where(eq(certificateDefinitions.tenantId, tenantId)).limit(2);
  const certTpls = await db.select().from(certificateTemplates).where(eq(certificateTemplates.tenantId, tenantId)).limit(2);
  const issuedCerts = await db.select().from(issuedCertificates).where(eq(issuedCertificates.tenantId, tenantId)).limit(2);
  
  const result = {
    cardTemplateId: cards[0]?.id,
    issuedCardId: issuedCards[0]?.id,
    issuedCardToken: issuedCards[0]?.publicTokenHash,
    certDefId: defs[0]?.id,
    certTemplateId: certTpls[0]?.id,
    issuedCertId: issuedCerts[0]?.id,
    issuedCertToken: issuedCerts[0]?.verificationTokenHash,
  };

  fs.writeFileSync('scripts/credentials-ids.json', JSON.stringify(result, null, 2));
  console.log('Result written to scripts/credentials-ids.json:', result);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
