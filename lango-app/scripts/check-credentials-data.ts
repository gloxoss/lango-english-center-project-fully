import 'dotenv/config';
import { db } from '@/libs/DB';
import { documentTemplates, issuedDocuments, documentGenerationJobs } from '@/features/cards/models/cards-schema';
import { certificateDefinitions, issuedCertificates, certificateRequests, certificateSignatories, certificateJobs } from '@/features/certificates/models/certificates-schema';
import { tenants, user } from '@/models/Schema';
import { examSeats } from '@/features/assessment/models/assessment-schema';
import { eq } from 'drizzle-orm';

async function main() {
  const [t] = await db.select().from(tenants).where(eq(tenants.slug, 'atlas')).limit(1);
  if (!t) {
    console.log('Atlas tenant not found, checking all tenants...');
    const all = await db.select().from(tenants).limit(5);
    console.log('Tenants:', all);
    process.exit(0);
  }

  const tenantId = t.id;
  const [
    cards,
    issuedCards,
    cardJobs,
    defs,
    issuedCerts,
    requests,
    signatories,
    certJobs,
    students,
    seats,
  ] = await Promise.all([
    db.select().from(documentTemplates).where(eq(documentTemplates.tenantId, tenantId)),
    db.select().from(issuedDocuments).where(eq(issuedDocuments.tenantId, tenantId)),
    db.select().from(documentGenerationJobs).where(eq(documentGenerationJobs.tenantId, tenantId)),
    db.select().from(certificateDefinitions).where(eq(certificateDefinitions.tenantId, tenantId)),
    db.select().from(issuedCertificates).where(eq(issuedCertificates.tenantId, tenantId)),
    db.select().from(certificateRequests).where(eq(certificateRequests.tenantId, tenantId)),
    db.select().from(certificateSignatories).where(eq(certificateSignatories.tenantId, tenantId)),
    db.select().from(certificateJobs).where(eq(certificateJobs.tenantId, tenantId)),
    db.select().from(user).where(eq(user.tenantId, tenantId)).limit(10),
    db.select().from(examSeats).where(eq(examSeats.tenantId, tenantId)),
  ]);

  console.log({
    tenant: { id: t.id, name: t.name, slug: t.slug },
    cardTemplates: cards.length,
    issuedCards: issuedCards.length,
    cardJobs: cardJobs.length,
    certificateDefinitions: defs.length,
    issuedCertificates: issuedCerts.length,
    certificateRequests: requests.length,
    signatories: signatories.length,
    certificateJobs: certJobs.length,
    studentsFound: students.length,
    examSeatsFound: seats.length,
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
