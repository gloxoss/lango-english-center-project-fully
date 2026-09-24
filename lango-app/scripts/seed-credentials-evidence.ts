import 'dotenv/config';
import { db } from '@/libs/DB';
import {
  documentTemplates,
  documentTemplateVersions,
  issuedDocuments,
  documentGenerationJobs,
  documentGenerationItems,
  documentEvents,
} from '@/features/cards/models/cards-schema';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
  certificateTemplates,
  certificateTemplateVersions,
  certificateSignatories,
  certificateRequests,
  issuedCertificates,
  certificateEvents,
  certificateJobs,
} from '@/features/certificates/models/certificates-schema';
import { examHalls, examSeats, examTerms } from '@/features/assessment/models/assessment-schema';
import { addonEntitlements, tenants, user } from '@/models/Schema';
import { eq, and } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';

async function seed() {
  console.log('Seeding Credentials and Official Documents data for Groupe Scolaire Atlas...');

  const [atlas] = await db.select().from(tenants).where(eq(tenants.slug, 'atlas')).limit(1);
  if (!atlas) {
    throw new Error('Tenant atlas not found');
  }
  const tenantId = atlas.id;

  // 1. Enable Addons
  await db
    .insert(addonEntitlements)
    .values([
      { tenantId, addonId: 'card-management', isEnabled: true },
      { tenantId, addonId: 'certificate-management', isEnabled: true },
    ])
    .onConflictDoNothing();

  // Find admin, teachers, students
  const users = await db.select().from(user).where(eq(user.tenantId, tenantId));
  const admin = users.find(u => u.role === 'school_admin') || users[0]!;
  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');

  console.log(`Found ${users.length} total users: ${teachers.length} teachers, ${students.length} students.`);

  // 2. Card Templates
  const [studentCardTpl] = await db
    .insert(documentTemplates)
    .values({
      tenantId,
      name: "Carte d'Élève Officielle (Format Badge CR80)",
      type: 'student_id',
      status: 'published',
      isDefault: true,
      createdBy: admin.id,
    })
    .returning();

  const [studentCardVer] = await db
    .insert(documentTemplateVersions)
    .values({
      tenantId,
      templateId: studentCardTpl!.id,
      versionNumber: 1,
      pageWidthMm: 85,
      pageHeightMm: 54,
      orientation: 'landscape',
      schemaJson: {
        basePdf: { width: 85.6, height: 53.98, padding: [0, 0, 0, 0] },
        schemas: [[]],
      },
      publishedById: admin.id,
      publishedAt: new Date().toISOString(),
    })
    .returning();

  const [staffCardTpl] = await db
    .insert(documentTemplates)
    .values({
      tenantId,
      name: "Badge Professionnel Corps Enseignant & Personnel",
      type: 'employee_id',
      status: 'published',
      isDefault: true,
      createdBy: admin.id,
    })
    .returning();

  const [staffCardVer] = await db
    .insert(documentTemplateVersions)
    .values({
      tenantId,
      templateId: staffCardTpl!.id,
      versionNumber: 1,
      pageWidthMm: 85,
      pageHeightMm: 54,
      orientation: 'landscape',
      schemaJson: {
        basePdf: { width: 85.6, height: 53.98, padding: [0, 0, 0, 0] },
        schemas: [[]],
      },
      publishedById: admin.id,
      publishedAt: new Date().toISOString(),
    })
    .returning();

  const [admitCardTpl] = await db
    .insert(documentTemplates)
    .values({
      tenantId,
      name: "Convocation Officielle aux Épreuves du Baccalauréat",
      type: 'admit_card',
      status: 'published',
      isDefault: true,
      createdBy: admin.id,
    })
    .returning();

  const [admitCardVer] = await db
    .insert(documentTemplateVersions)
    .values({
      tenantId,
      templateId: admitCardTpl!.id,
      versionNumber: 1,
      pageWidthMm: 210,
      pageHeightMm: 297,
      orientation: 'portrait',
      schemaJson: {
        basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
        schemas: [[]],
      },
      publishedById: admin.id,
      publishedAt: new Date().toISOString(),
    })
    .returning();

  // 3. Exam Term, Hall & Seats for Convocations
  const [examTerm] = await db
    .insert(examTerms)
    .values({
      tenantId,
      name: "Session Normale - Baccalauréat 2026",
      code: "BAC-NORM-2026",
      startDate: "2026-06-08",
      endDate: "2026-06-12",
      status: "active",
      isPublished: true,
    })
    .returning();

  const [examHall] = await db
    .insert(examHalls)
    .values({
      tenantId,
      name: "Salle Polyvalente Ibn Battouta (Bloc C)",
      code: "HALL-IBN-BATTOUTA",
      capacity: 60,
      isAccessible: true,
      isActive: true,
    })
    .returning();

  const seatRecords = [];
  for (let i = 0; i < Math.min(students.length, 6); i++) {
    const s = students[i]!;
    const [seat] = await db
      .insert(examSeats)
      .values({
        tenantId,
        examTermId: examTerm!.id,
        examHallId: examHall!.id,
        studentId: s.id,
        seatNumber: i + 1,
        deskLabel: `Pupitre ${i + 1} - Rangée ${String.fromCharCode(65 + Math.floor(i / 3))}`,
        candidateNumber: `BAC26-${(1000 + i).toString()}`,
      })
      .returning();
    seatRecords.push(seat!);
  }

  // 4. Issue Sample Cards
  for (let i = 0; i < Math.min(students.length, 5); i++) {
    const s = students[i]!;
    const rawToken = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawToken).digest('hex');

    const [doc] = await db
      .insert(issuedDocuments)
      .values({
        tenantId,
        type: 'student_id',
        templateVersionId: studentCardVer!.id,
        subjectType: 'student',
        subjectId: s.id,
        publicTokenHash: hash,
        status: i === 4 ? 'revoked' : 'active',
        validFrom: new Date('2025-09-01').toISOString(),
        validUntil: new Date('2026-06-30').toISOString(),
        renderDataSnapshot: {
          subjectName: s.name,
          matricule: s.matricule || `STU-${1000 + i}`,
          nationalId: s.nationalId || `CIN-${2000 + i}`,
          dateOfBirth: s.dateOfBirth || '2008-04-12',
          program: s.className || '1ère Année Baccalauréat Sciences Math',
          city: 'Casablanca',
        },
        issuedById: admin.id,
        revokedAt: i === 4 ? new Date().toISOString() : null,
        revokedById: i === 4 ? admin.id : null,
        revokeReason: i === 4 ? "Perte de la carte signalée par le tuteur" : null,
      })
      .returning();

    await db.insert(documentEvents).values({
      tenantId,
      issuedDocumentId: doc!.id,
      eventKind: i === 4 ? 'revoked' : 'issued',
      actorId: admin.id,
      metadata: { source: 'seed_init' },
    });
  }

  // Issue Staff Cards
  for (let i = 0; i < Math.min(teachers.length, 3); i++) {
    const t = teachers[i]!;
    const rawToken = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawToken).digest('hex');

    const [doc] = await db
      .insert(issuedDocuments)
      .values({
        tenantId,
        type: 'employee_id',
        templateVersionId: staffCardVer!.id,
        subjectType: 'employee',
        subjectId: t.id,
        publicTokenHash: hash,
        status: 'active',
        validFrom: new Date('2025-09-01').toISOString(),
        validUntil: new Date('2027-08-31').toISOString(),
        renderDataSnapshot: {
          subjectName: t.name,
          employeeId: t.employeeId || `ENS-${500 + i}`,
          department: t.specialization || 'Département de Mathématiques',
          role: 'Professeur',
        },
        issuedById: admin.id,
      })
      .returning();

    await db.insert(documentEvents).values({
      tenantId,
      issuedDocumentId: doc!.id,
      eventKind: 'issued',
      actorId: admin.id,
      metadata: { source: 'seed_init' },
    });
  }

  // Issue Admit Cards (Convocations)
  for (let i = 0; i < Math.min(seatRecords.length, 3); i++) {
    const seat = seatRecords[i]!;
    const stu = students.find(s => s.id === seat.studentId)!;
    const rawToken = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawToken).digest('hex');

    const [doc] = await db
      .insert(issuedDocuments)
      .values({
        tenantId,
        type: 'admit_card',
        templateVersionId: admitCardVer!.id,
        subjectType: 'exam_candidate',
        subjectId: stu.id,
        examCandidateId: seat.id,
        publicTokenHash: hash,
        status: 'active',
        validFrom: new Date('2026-06-01').toISOString(),
        validUntil: new Date('2026-06-15').toISOString(),
        renderDataSnapshot: {
          subjectName: stu.name,
          matricule: stu.matricule || `STU-${1000 + i}`,
          examTerm: "Session Normale - Baccalauréat 2026",
          examHall: "Salle Polyvalente Ibn Battouta (Bloc C)",
          seatNumber: String(seat.seatNumber),
          candidateNumber: seat.candidateNumber,
        },
        issuedById: admin.id,
      })
      .returning();

    await db.insert(documentEvents).values({
      tenantId,
      issuedDocumentId: doc!.id,
      eventKind: 'issued',
      actorId: admin.id,
      metadata: { source: 'seed_init' },
    });
  }

  // 5. Card Batch Generation Job
  const [cardJob] = await db
    .insert(documentGenerationJobs)
    .values({
      tenantId,
      type: 'student_id',
      templateVersionId: studentCardVer!.id,
      filtersSnapshot: { class: 'Tronc Commun Scientifique' },
      status: 'completed',
      totalCount: 28,
      successCount: 28,
      errorCount: 0,
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date().toISOString(),
      createdBy: admin.id,
    })
    .returning();

  // 6. Certificate Signatories
  const [sig1] = await db
    .insert(certificateSignatories)
    .values({
      tenantId,
      name: "Mme. Amina Benjelloun",
      title: "Directrice Pédagogique",
      signatureImageId: "sig_directrice_amina",
      isActive: true,
    })
    .returning();

  const [sig2] = await db
    .insert(certificateSignatories)
    .values({
      tenantId,
      name: "M. Yassine El Amrani",
      title: "Directeur Général de l'Établissement",
      signatureImageId: "sig_directeur_yassine",
      isActive: true,
    })
    .returning();

  // 7. Certificate Definitions
  const [certDef1] = await db
    .insert(certificateDefinitions)
    .values({
      tenantId,
      title: "Attestation de Scolarité Officielle (Loi 06-00)",
      description: "Délivrée pour servir et valoir ce que de droit, conforme aux normes du Ministère de l'Éducation Nationale",
      allowedTargetType: 'student',
      status: 'active',
      createdBy: admin.id,
    })
    .returning();

  const [certDefVer1] = await db
    .insert(certificateDefinitionVersions)
    .values({
      tenantId,
      definitionId: certDef1!.id,
      versionNumber: 1,
      fieldAllowlist: { allowedFields: ['subjectName', 'matricule', 'dateOfBirth', 'program'] },
      templateSchema: [[]],
      pdfmeBasePdf: { width: 794, height: 1123, padding: [0, 0, 0, 0] },
      status: 'active',
      createdBy: admin.id,
    })
    .returning();

  const [certDef2] = await db
    .insert(certificateDefinitions)
    .values({
      tenantId,
      title: "Certificat de Réussite et d'Excellence Académique",
      description: "Reconnaissance d'excellence pour mention Très Bien aux examens de fin de cycle",
      allowedTargetType: 'student',
      status: 'active',
      createdBy: admin.id,
    })
    .returning();

  const [certDefVer2] = await db
    .insert(certificateDefinitionVersions)
    .values({
      tenantId,
      definitionId: certDef2!.id,
      versionNumber: 1,
      fieldAllowlist: { allowedFields: ['subjectName', 'matricule', 'dateOfBirth', 'gradeAverage'] },
      templateSchema: [[]],
      pdfmeBasePdf: { width: 794, height: 1123, padding: [0, 0, 0, 0] },
      status: 'active',
      createdBy: admin.id,
    })
    .returning();

  const [certDef3] = await db
    .insert(certificateDefinitions)
    .values({
      tenantId,
      title: "Attestation de Travail et de Fonctions",
      description: "Certificat administratif pour les membres du corps enseignant et personnel",
      allowedTargetType: 'employee',
      status: 'active',
      createdBy: admin.id,
    })
    .returning();

  const [certDefVer3] = await db
    .insert(certificateDefinitionVersions)
    .values({
      tenantId,
      definitionId: certDef3!.id,
      versionNumber: 1,
      fieldAllowlist: { allowedFields: ['subjectName', 'employeeId', 'department', 'hireDate'] },
      templateSchema: [[]],
      pdfmeBasePdf: { width: 794, height: 1123, padding: [0, 0, 0, 0] },
      status: 'active',
      createdBy: admin.id,
    })
    .returning();

  // Certificate Templates
  const [certTpl1] = await db
    .insert(certificateTemplates)
    .values({
      tenantId,
      name: "Modèle Attestation Nationale Standard A4",
      description: "En-tête officiel bilingue arabe-français avec sceau MEN",
      status: 'active',
      createdBy: admin.id,
    })
    .returning();

  await db.insert(certificateTemplateVersions).values({
    tenantId,
    templateId: certTpl1!.id,
    versionNumber: 1,
    templateSchema: [[]],
    pdfmeBasePdf: { width: 794, height: 1123, padding: [0, 0, 0, 0] },
    status: 'active',
    createdBy: admin.id,
  });

  // 8. Issue Real Certificates
  const year = new Date().getFullYear();
  for (let i = 0; i < Math.min(students.length, 4); i++) {
    const s = students[i]!;
    const rawToken = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const serial = `CERT-${year}-${(i + 1).toString().padStart(6, '0')}`;

    const [cert] = await db
      .insert(issuedCertificates)
      .values({
        tenantId,
        definitionId: certDef1!.id,
        versionId: certDefVer1!.id,
        recipientId: s.id,
        serialNumber: serial,
        verificationTokenHash: hash,
        fileExt: 'pdf',
        status: i === 3 ? 'replaced' : 'valid',
        evidenceSnapshot: {
          type: 'enrollment_active',
          studentName: s.name,
          matricule: s.matricule,
          academicYear: '2025/2026',
        },
        issuedBy: admin.id,
      })
      .returning();

    await db.insert(certificateEvents).values({
      tenantId,
      issuedCertificateId: cert!.id,
      eventKind: i === 3 ? 'replaced' : 'issued',
      actorId: admin.id,
      reason: i === 3 ? 'Remplacement suite à mise à jour de l état civil' : null,
      metadata: {
        render: {
          subjectName: s.name,
          matricule: s.matricule || `STU-${1000 + i}`,
          serial,
          issueDate: new Date().toISOString(),
          directorName: "M. Yassine El Amrani",
          establishmentName: "Groupe Scolaire Atlas",
        },
      },
    });
  }

  // 9. Certificate Requests
  for (let i = 0; i < Math.min(students.length, 3); i++) {
    const s = students[i]!;
    const statuses: Array<'under_review' | 'submitted' | 'approved'> = ['under_review', 'submitted', 'approved'];
    await db.insert(certificateRequests).values({
      tenantId,
      definitionId: i === 1 ? certDef2!.id : certDef1!.id,
      requesterId: admin.id,
      recipientId: s.id,
      evidenceSnapshot: {
        type: 'manual_authorized',
        requestedBy: admin.id,
        recipientType: 'student',
        notes: `Demande officielle formulée par la famille de l'élève ${s.name}`,
      },
      status: statuses[i] || 'under_review',
      notes: `Dossier de candidature ${s.name} - Année universitaire 2026/2027`,
    });
  }

  // 10. Certificate Jobs
  await db.insert(certificateJobs).values({
    tenantId,
    definitionId: certDef1!.id,
    status: 'completed',
    totalCount: 35,
    successCount: 35,
    errorCount: 0,
    createdBy: admin.id,
  });

  console.log('✅ Credentials & Certificates successfully seeded for Groupe Scolaire Atlas!');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
