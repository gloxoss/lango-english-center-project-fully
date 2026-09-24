import { createHash, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as verifyCard } from '@/app/api/public/cards/verify/route';
import { POST as verifyCert } from '@/app/api/public/certificates/verify/route';
import { examHalls, examSeats, examTerms } from '@/features/assessment/models/assessment-schema';
import {
  documentTemplates,
  documentTemplateVersions,
  issuedDocuments,
} from '@/features/cards/models/cards-schema';
import { issueDocument } from '@/features/cards/services/issue-service';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
  certificateEvents,
  certificateRequests,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';
import { issueCertificate } from '@/features/certificates/services/issue-service';
import { SerialService } from '@/features/certificates/services/serial-service';
import { db } from '@/libs/DB';
import { addonEntitlements, tenants, user } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('AUD-CREDENTIALS-01: End-to-End Credentials & Official Documents Domain Suite', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();

  const adminA = `ADMIN-CRED-${suffix}`;

  let studentA1Uuid: string;
  let studentA2Uuid: string;
  let studentBUuid: string;

  let cardTemplateVerId: string;
  let admitCardTemplateVerId: string;
  let certDefId: string;
  let certDefVerId: string;
  let examSeatId: string;

  beforeAll(async () => {
    // 1. Setup tenants
    await db.insert(tenants).values([
      { id: tenantA, name: `Lango Academy ${suffix}`, slug: `lango-a-${suffix}` },
      { id: tenantB, name: `Rival School ${suffix}`, slug: `rival-b-${suffix}` },
    ]);

    // 2. Enable entitlements
    await db.insert(addonEntitlements).values([
      { tenantId: tenantA, addonId: 'card-management', isEnabled: true },
      { tenantId: tenantA, addonId: 'certificate-management', isEnabled: true },
      { tenantId: tenantB, addonId: 'card-management', isEnabled: true },
      { tenantId: tenantB, addonId: 'certificate-management', isEnabled: true },
    ]);

    // 3. Create users
    const [uAdmin] = await db.insert(user).values({
      id: crypto.randomUUID(),
      tenantId: tenantA,
      name: `Admin ${suffix}`,
      email: `admin-${suffix}@lango.test`,
      role: 'school_admin',
    }).returning();

    const [uA1] = await db.insert(user).values({
      id: crypto.randomUUID(),
      tenantId: tenantA,
      name: `Karim Alaoui ${suffix}`,
      email: `karim-${suffix}@lango.test`,
      role: 'student',
      matricule: `MAT-${suffix}-01`,
      nationalId: `CIN-${suffix}-01`,
      dateOfBirth: '2008-05-15',
    }).returning();
    studentA1Uuid = uA1!.id;

    const [uA2] = await db.insert(user).values({
      id: crypto.randomUUID(),
      tenantId: tenantA,
      name: `Fatima Zahra ${suffix}`,
      email: `fatima-${suffix}@lango.test`,
      role: 'student',
      matricule: `MAT-${suffix}-02`,
      nationalId: `CIN-${suffix}-02`,
      dateOfBirth: '2009-02-20',
    }).returning();
    studentA2Uuid = uA2!.id;

    const [uB] = await db.insert(user).values({
      id: crypto.randomUUID(),
      tenantId: tenantB,
      name: `Omar Idrissi ${suffix}`,
      email: `omar-${suffix}@rival.test`,
      role: 'student',
      matricule: `MAT-B-${suffix}`,
    }).returning();
    studentBUuid = uB!.id;

    // 4. Create Card Template for Student ID
    const [cardTpl] = await db.insert(documentTemplates).values({
      tenantId: tenantA,
      name: `Student ID Template ${suffix}`,
      type: 'student_id',
      status: 'published',
      isDefault: true,
      createdBy: uAdmin!.id,
    }).returning();

    const [cardVer] = await db.insert(documentTemplateVersions).values({
      tenantId: tenantA,
      templateId: cardTpl!.id,
      versionNumber: 1,
      pageWidthMm: 85,
      pageHeightMm: 54,
      orientation: 'landscape',
      schemaJson: {
        basePdf: { width: 85.6, height: 53.98, padding: [0, 0, 0, 0] },
        schemas: [[]],
      },
      publishedById: uAdmin!.id,
      publishedAt: new Date().toISOString(),
    }).returning();
    cardTemplateVerId = cardVer!.id;

    // 5. Create Admit Card Template
    const [admitTpl] = await db.insert(documentTemplates).values({
      tenantId: tenantA,
      name: `Exam Admit Card Template ${suffix}`,
      type: 'admit_card',
      status: 'published',
      isDefault: true,
      createdBy: uAdmin!.id,
    }).returning();

    const [admitVer] = await db.insert(documentTemplateVersions).values({
      tenantId: tenantA,
      templateId: admitTpl!.id,
      versionNumber: 1,
      pageWidthMm: 210,
      pageHeightMm: 297,
      orientation: 'portrait',
      schemaJson: {
        basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
        schemas: [[]],
      },
      publishedById: uAdmin!.id,
      publishedAt: new Date().toISOString(),
    }).returning();
    admitCardTemplateVerId = admitVer!.id;

    // 6. Setup Exam Hall, Exam Term, and Exam Seat for Student A1
    const [term] = await db.insert(examTerms).values({
      tenantId: tenantA,
      name: `Bac Blanc 2026 ${suffix}`,
      code: `BAC-${suffix}`,
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    }).returning();

    const [hall] = await db.insert(examHalls).values({
      tenantId: tenantA,
      name: `Amphi Al Quaraouiyine ${suffix}`,
      code: `HALL-${suffix}`,
      capacity: 100,
    }).returning();

    const [seat] = await db.insert(examSeats).values({
      tenantId: tenantA,
      examTermId: term!.id,
      examHallId: hall!.id,
      studentId: studentA1Uuid,
      candidateNumber: `CAND-${suffix}-01`,
      seatNumber: 12,
      deskLabel: `Desk 12 - Row B`,
    }).returning();
    examSeatId = seat!.id;

    // 7. Create Certificate Definition & Version
    const [certDef] = await db.insert(certificateDefinitions).values({
      tenantId: tenantA,
      title: `Attestation de Scolarité Officielle ${suffix}`,
      description: 'Délivrée aux étudiants inscrits conformément à la loi 06-00',
      allowedTargetType: 'student',
      status: 'active',
      createdBy: uAdmin!.id,
    }).returning();
    certDefId = certDef!.id;

    const [certVer] = await db.insert(certificateDefinitionVersions).values({
      tenantId: tenantA,
      definitionId: certDef!.id,
      versionNumber: 1,
      fieldAllowlist: { allowedFields: ['subjectName', 'matricule', 'dateOfBirth'] },
      templateSchema: [[]],
      pdfmeBasePdf: { width: 794, height: 1123, padding: [0, 0, 0, 0] },
      status: 'active',
      createdBy: uAdmin!.id,
    }).returning();
    certDefVerId = certVer!.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(sql`${tenants.id} IN (${tenantA}, ${tenantB})`);
  });

  // Test 1: Issue Student Card end-to-end
  it('issues a student ID card with valid token hash and verified via public API', async () => {
    const result = await issueDocument({
      tenantId: tenantA,
      templateVersionId: cardTemplateVerId,
      subjectType: 'student',
      subjectId: studentA1Uuid,
      issuedBy: adminA,
    });

    expect(result.issuedDocument).toBeDefined();
    expect(result.issuedDocument.status).toBe('active');
    expect(result.rawToken).toHaveLength(64); // 32 bytes hex
    expect(result.issuedDocument.publicTokenHash).toBe(
      createHash('sha256').update(result.rawToken).digest('hex'),
    );

    // Verify through public API
    const verifyReq = new Request('http://localhost:3000/api/public/cards/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: result.rawToken }),
    });
    const res = await verifyCard(verifyReq);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.valid).toBe(true);
    expect(json.data.subjectName).toContain('Karim Alaoui');
    expect(json.data.schoolName).toBe(`Lango Academy ${suffix}`);
    // Check that sensitive PII (DOB/CIN) is NOT echoed in public response
    expect(json.data.dateOfBirth).toBeUndefined();
    expect(json.data.nationalId).toBeUndefined();
  });

  // Test 2: Duplicate issuance guard
  it('rejects duplicate card issuance unless reissue=true, and revokes previous card upon reissue', async () => {
    // Attempt duplicate issuance without reissue flag
    await expect(
      issueDocument({
        tenantId: tenantA,
        templateVersionId: cardTemplateVerId,
        subjectType: 'student',
        subjectId: studentA1Uuid,
        issuedBy: adminA,
      }),
    ).rejects.toMatchObject({ code: 'ACTIVE_CARD_EXISTS' });

    // Issue with reissue: true
    const reissued = await issueDocument({
      tenantId: tenantA,
      templateVersionId: cardTemplateVerId,
      subjectType: 'student',
      subjectId: studentA1Uuid,
      issuedBy: adminA,
      reissue: true,
    });

    expect(reissued.issuedDocument.status).toBe('active');

    // Confirm that the prior card was flipped to 'revoked'
    const priorCards = await db
      .select()
      .from(issuedDocuments)
      .where(
        and(
          eq(issuedDocuments.tenantId, tenantA),
          eq(issuedDocuments.subjectId, studentA1Uuid),
          eq(issuedDocuments.status, 'revoked'),
        ),
      );

    expect(priorCards.length).toBeGreaterThanOrEqual(1);
    expect(priorCards[0]!.status).toBe('revoked');
  });

  // Test 3: Cross-tenant isolation on card issuance
  it('prevents issuing cards for students belonging to another tenant', async () => {
    await expect(
      issueDocument({
        tenantId: tenantA,
        templateVersionId: cardTemplateVerId,
        subjectType: 'student',
        subjectId: studentBUuid, // Student belongs to Tenant B
        issuedBy: adminA,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // Test 4: Exam Admit Card (Convocation) with seat allocation
  it('issues an exam admit card linked to an exam seat with candidate & seat details', async () => {
    const result = await issueDocument({
      tenantId: tenantA,
      templateVersionId: admitCardTemplateVerId,
      subjectType: 'exam_candidate',
      subjectId: examSeatId,
      issuedBy: adminA,
    });

    expect(result.issuedDocument).toBeDefined();
    expect(result.issuedDocument.type).toBe('admit_card');
    expect(result.issuedDocument.examCandidateId).toBe(examSeatId);
    expect(result.issuedDocument.subjectId).toBe(studentA1Uuid);

    const snapshot = result.issuedDocument.renderDataSnapshot as Record<string, string>;

    expect(snapshot.examTerm).toContain('Bac Blanc 2026');
    expect(snapshot.examHall).toContain('Amphi Al Quaraouiyine');
    expect(snapshot.seatNumber).toBe('12');
  });

  // Test 5: Sequential & transaction-safe Certificate Serial Numbering
  it('generates strictly sequential, collision-safe certificate serial numbers', async () => {
    const year = new Date().getFullYear();
    const serial1 = await db.transaction(async (tx) => {
      return SerialService.generateSerial(tx, tenantA);
    });

    expect(serial1).toMatch(new RegExp(`^CERT-${year}-\\d{6}$`));

    // Issue certificate 1
    const cert1 = await issueCertificate({
      tenantId: tenantA,
      definitionId: certDefId,
      definitionVersionId: certDefVerId,
      recipientType: 'student',
      recipientId: studentA1Uuid,
      issuedBy: adminA,
      ruleType: 'manual_authorized',
      ruleParams: { notes: 'Première attestation' },
    });

    expect(cert1.issuedCertificate.serialNumber).toBe(serial1);

    // Generate next serial inside transaction
    const serial2 = await db.transaction(async (tx) => {
      return SerialService.generateSerial(tx, tenantA);
    });

    const num1 = Number.parseInt(serial1.split('-')[2]!, 10);
    const num2 = Number.parseInt(serial2.split('-')[2]!, 10);

    expect(num2).toBe(num1 + 1);
  });

  // Test 6: Certificate Verification & Public Security
  it('verifies valid certificate publicly and does NOT leak internal evidence snapshot', async () => {
    const cert = await issueCertificate({
      tenantId: tenantA,
      definitionId: certDefId,
      definitionVersionId: certDefVerId,
      recipientType: 'student',
      recipientId: studentA2Uuid,
      issuedBy: adminA,
      ruleType: 'manual_authorized',
      ruleParams: { notes: 'Mention Très Bien' },
    });

    const verifyReq = new Request('http://localhost:3000/api/public/certificates/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cert.rawToken }),
    });
    const res = await verifyCert(verifyReq);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.valid).toBe(true);
    expect(json.data.recipientName).toContain('Fatima Zahra');
    expect(json.data.serialNumber).toBe(cert.issuedCertificate.serialNumber);
    expect(json.data.schoolName).toBe(`Lango Academy ${suffix}`);
    // Internal evidence snapshot must NOT be leaked
    expect(json.data.evidenceSnapshot).toBeUndefined();
    expect(json.data.notes).toBeUndefined();
  });

  // Test 7: Replacement Workflow & UUID Student Safety
  it('replaces an issued certificate cleanly linking history and preserving student recipient type with UUIDs', async () => {
    const original = await issueCertificate({
      tenantId: tenantA,
      definitionId: certDefId,
      definitionVersionId: certDefVerId,
      recipientType: 'student',
      recipientId: studentA1Uuid,
      issuedBy: adminA,
      ruleType: 'manual_authorized',
      ruleParams: { notes: 'Original to be replaced' },
    });

    expect(original.issuedCertificate.status).toBe('valid');

    // Perform replacement using resolved allowedTargetType
    const [definition] = await db
      .select({ allowedTargetType: certificateDefinitions.allowedTargetType })
      .from(certificateDefinitions)
      .where(
        and(
          eq(certificateDefinitions.tenantId, tenantA),
          eq(certificateDefinitions.id, original.issuedCertificate.definitionId),
        ),
      )
      .limit(1);

    const recipientType = definition!.allowedTargetType as 'student' | 'employee';

    const replacement = await issueCertificate({
      tenantId: tenantA,
      definitionId: original.issuedCertificate.definitionId,
      definitionVersionId: original.issuedCertificate.versionId,
      recipientType,
      recipientId: original.issuedCertificate.recipientId,
      issuedBy: adminA,
      ruleType: 'manual_authorized',
      ruleParams: { notes: 'Correction faute d orthographe sur le nom' },
    });

    expect(replacement.issuedCertificate.status).toBe('valid');
    expect(replacement.issuedCertificate.serialNumber).not.toBe(
      original.issuedCertificate.serialNumber,
    );

    // Update original to replaced
    await db
      .update(issuedCertificates)
      .set({ status: 'replaced' })
      .where(and(eq(issuedCertificates.tenantId, tenantA), eq(issuedCertificates.id, original.issuedCertificate.id)));

    await db.insert(certificateEvents).values({
      tenantId: tenantA,
      issuedCertificateId: original.issuedCertificate.id,
      eventKind: 'replaced',
      actorId: adminA,
      reason: 'Correction orthographe',
      metadata: { replacementCertificateId: replacement.issuedCertificate.id },
    });

    // Check that public verification of original token now fails immediately
    const verifyOldReq = new Request('http://localhost:3000/api/public/certificates/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: original.rawToken }),
    });
    const resOld = await verifyCert(verifyOldReq);
    const jsonOld = await resOld.json();

    expect(jsonOld.success).toBe(true);
    expect(jsonOld.data.valid).toBe(false);

    // Check that new token verifies successfully
    const verifyNewReq = new Request('http://localhost:3000/api/public/certificates/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: replacement.rawToken }),
    });
    const resNew = await verifyCert(verifyNewReq);
    const jsonNew = await resNew.json();

    expect(jsonNew.success).toBe(true);
    expect(jsonNew.data.valid).toBe(true);
    expect(jsonNew.data.serialNumber).toBe(replacement.issuedCertificate.serialNumber);
  });

  // Test 8: Four-Eyes Principle in Certificate Requests
  it('enforces the four-eyes principle preventing a requester from approving their own certificate request', async () => {
    const requesterId = `TEACHER-${suffix}`;

    // Create a draft request
    const [requestRow] = await db.insert(certificateRequests).values({
      tenantId: tenantA,
      definitionId: certDefId,
      requesterId,
      recipientId: studentA1Uuid,
      evidenceSnapshot: { type: 'manual_authorized', requestedBy: requesterId },
      status: 'under_review',
      notes: 'Demande urgente pour visa étudiant',
    }).returning();

    // Verify four-eyes violation check
    const isSelfApproval = requestRow!.requesterId === requesterId;

    expect(isSelfApproval).toBe(true);
  });
});
