import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  account,
  attendance,
  classes,
  classSections,
  classSubjects,
  classTeachers,
  invoices,
  mediums,
  payments,
  sections,
  subjects,
  subjectTeachers,
  tenants,
  user,
} from '@/models/Schema';

const TENANT_SLUG = 'atlas';
const LANGO_SLUG = 'lango';

async function upsertByName(
  table: any,
  nameColumn: any,
  tenantIdColumn: any,
  tenantId: string,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const [existing] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(tenantIdColumn, tenantId), eq(nameColumn, name)))
    .limit(1);
  if (existing) {
    return existing.id;
  }
  const [inserted] = await db.insert(table).values({ tenantId, name, ...extra }).returning({ id: table.id });
  return inserted!.id;
}

async function seed() {
  // Tenant 1: Groupe Scolaire Atlas
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1);

  const tenantId
    = existing?.id
      ?? (
        await db
          .insert(tenants)
          .values({ name: 'Groupe Scolaire Atlas', slug: TENANT_SLUG })
          .returning()
      )[0]!.id;

  // Tenant 2: Lango Center
  const [existingLango] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, LANGO_SLUG))
    .limit(1);

  const langoTenantId
    = existingLango?.id
      ?? (
        await db
          .insert(tenants)
          .values({ name: 'Lango Center', slug: LANGO_SLUG })
          .returning()
      )[0]!.id;

  const francaisMediumId = await upsertByName(mediums, mediums.name, mediums.tenantId, tenantId, 'Français');
  const sectionAId = await upsertByName(sections, sections.name, sections.tenantId, tenantId, 'A');
  const sectionBId = await upsertByName(sections, sections.name, sections.tenantId, tenantId, 'B');
  const sectionCId = await upsertByName(sections, sections.name, sections.tenantId, tenantId, 'C');

  const [existing2nde] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.tenantId, tenantId), eq(classes.name, '2nde'), eq(classes.mediumId, francaisMediumId)))
    .limit(1);
  const class2ndeId
    = existing2nde?.id
      ?? (await db.insert(classes).values({ tenantId, name: '2nde', mediumId: francaisMediumId }).returning({ id: classes.id }))[0]!.id;

  const [existing1ere] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.tenantId, tenantId), eq(classes.name, '1ère'), eq(classes.mediumId, francaisMediumId)))
    .limit(1);
  const class1ereId
    = existing1ere?.id
      ?? (await db.insert(classes).values({ tenantId, name: '1ère', mediumId: francaisMediumId }).returning({ id: classes.id }))[0]!.id;

  async function upsertClassSection(classId: string, sectionId: string): Promise<string> {
    const [row] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.classId, classId), eq(classSections.sectionId, sectionId)))
      .limit(1);
    if (row) {
      return row.id;
    }
    const [inserted] = await db
      .insert(classSections)
      .values({ tenantId, classId, sectionId, mediumId: francaisMediumId })
      .returning({ id: classSections.id });
    return inserted!.id;
  }

  const class2ndeAId = await upsertClassSection(class2ndeId, sectionAId);
  const class2ndeCId = await upsertClassSection(class2ndeId, sectionCId);
  const class1ereBId = await upsertClassSection(class1ereId, sectionBId);

  // Users for Atlas & Lango
  await db
    .insert(user)
    .values([
      {
        id: 'USR-001',
        tenantId,
        name: 'Yassine El Amrani',
        email: 'y.elamrani@atlas.ma',
        phone: '+212 6 12-345678',
        role: 'school_admin',
        userStatus: 'active',
      },
      {
        id: 'USR-LANGO-001',
        tenantId: langoTenantId,
        name: 'Admin Lango Center',
        email: 'admin@lango.ma',
        phone: '+212 6 00-000000',
        role: 'school_admin',
        userStatus: 'active',
      },
      {
        id: 'USR-002',
        tenantId,
        name: 'Fatima Zahra Idrissi',
        email: 'fz.idrissi@atlas.ma',
        phone: '+212 6 61-234567',
        role: 'teacher',
        userStatus: 'active',
        qualification: 'Master Mathématiques',
        salary: '8500.00',
      },
      {
        id: 'USR-003',
        tenantId,
        name: 'Karim El Amrani',
        email: 'karim.amrani@email.com',
        phone: '+212 6 12-345678',
        role: 'parent',
        userStatus: 'active',
      },
      {
        // Platform-level role, no tenant - matches requireRequestContext's rule
        // that only super_admin may have a null tenantId.
        id: 'USR-SUPER-001',
        tenantId: null,
        name: 'Super Admin Plateforme',
        email: 'superadmin@schoolos.ma',
        phone: '+212 6 00-000001',
        role: 'super_admin',
        userStatus: 'active',
      },
      {
        id: 'STU-001',
        tenantId,
        name: 'Yassine El Amrani',
        email: 'stu-001@placeholder.local',
        role: 'student',
        matricule: 'AAM-2425-0001',
        classSectionId: class2ndeAId,
        guardianName: 'M. Karim El Amrani',
        phone: '+212 6 12-345678',
        userStatus: 'active',
        paymentStatus: 'À jour',
      },
      {
        id: 'STU-002',
        tenantId,
        name: 'Salma Bennani',
        email: 'stu-002@placeholder.local',
        role: 'student',
        matricule: 'AAM-2425-0002',
        classSectionId: class1ereBId,
        guardianName: 'Mme Salma Bennani',
        phone: '+212 6 54-987654',
        userStatus: 'active',
        paymentStatus: 'En retard',
      },
      {
        id: 'STU-003',
        tenantId,
        name: 'Omar Tazi',
        email: 'stu-003@placeholder.local',
        role: 'student',
        matricule: 'AAM-2425-0003',
        classSectionId: class2ndeCId,
        guardianName: 'M. Ahmed Tazi',
        phone: '+212 6 61-112233',
        userStatus: 'active',
        paymentStatus: 'À jour',
      },
    ])
    .onConflictDoNothing();

  const mathsSubjectId = await upsertByName(subjects, subjects.name, subjects.tenantId, tenantId, 'Mathématiques', {
    mediumId: francaisMediumId,
    type: 'theory',
  });

  const [existingClassSubject] = await db
    .select({ id: classSubjects.id })
    .from(classSubjects)
    .where(and(eq(classSubjects.classId, class2ndeId), eq(classSubjects.subjectId, mathsSubjectId)))
    .limit(1);
  const mathsClassSubjectId
    = existingClassSubject?.id
      ?? (
        await db
          .insert(classSubjects)
          .values({ tenantId, classId: class2ndeId, subjectId: mathsSubjectId, type: 'compulsory' })
          .returning({ id: classSubjects.id })
      )[0]!.id;

  await db.insert(classTeachers).values({ tenantId, classSectionId: class2ndeAId, teacherId: 'USR-002' }).onConflictDoNothing();
  await db
    .insert(subjectTeachers)
    .values({
      tenantId,
      classSectionId: class2ndeAId,
      subjectId: mathsSubjectId,
      classSubjectId: mathsClassSubjectId,
      teacherId: 'USR-002',
    })
    .onConflictDoNothing();

  // Real attendance/invoice/payment demo data - no unique constraint exists on
  // any of these tables to key an upsert off, so guard idempotency with an
  // explicit existence check instead (skip entirely once seeded once).
  const [existingInvoice] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.tenantId, tenantId)).limit(1);
  if (!existingInvoice) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await db.insert(attendance).values([
      { tenantId, studentId: 'STU-001', date: todayIso, status: 'present', markedById: 'USR-002' },
      { tenantId, studentId: 'STU-002', date: todayIso, status: 'absent', markedById: 'USR-002' },
      { tenantId, studentId: 'STU-003', date: todayIso, status: 'present', markedById: 'USR-002' },
    ]);

    const [invoicePaid] = await db.insert(invoices).values({
      tenantId,
      studentId: 'STU-001',
      invoiceNumber: 'INV-2026-0001',
      amount: 3000,
      netAmount: 3000,
      paidAmount: 3000,
      status: 'paid',
      dueDate: twoWeeksAgo,
      issueDate: twoWeeksAgo,
    }).returning({ id: invoices.id });

    await db.insert(payments).values({
      tenantId,
      invoiceId: invoicePaid!.id,
      studentId: 'STU-001',
      amount: 3000,
      paymentMethod: 'transfer',
      receivedById: 'USR-001',
    });

    await db.insert(invoices).values([
      {
        tenantId,
        studentId: 'STU-002',
        invoiceNumber: 'INV-2026-0002',
        amount: 3000,
        netAmount: 3000,
        paidAmount: 0,
        status: 'overdue',
        dueDate: twoWeeksAgo,
        issueDate: twoWeeksAgo,
      },
      {
        tenantId,
        studentId: 'STU-003',
        invoiceNumber: 'INV-2026-0003',
        amount: 3000,
        netAmount: 3000,
        paidAmount: 0,
        status: 'pending',
        dueDate: inTwoWeeks,
        issueDate: todayIso,
      },
    ]);
  }

  // Small real dataset for the Lango tenant too - it otherwise has only the
  // admin user, which would make its dashboard read as all-zero even after the
  // dashboard is wired to real data. A genuinely empty tenant is not a bug, but
  // there is no reason the demo Lango account has to be that tenant.
  const anglaisMediumId = await upsertByName(mediums, mediums.name, mediums.tenantId, langoTenantId, 'Anglais');
  const langoSectionAId = await upsertByName(sections, sections.name, sections.tenantId, langoTenantId, 'A');

  const [existingLangoClass] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, langoTenantId), eq(classes.name, 'Intermediate'), eq(classes.mediumId, anglaisMediumId))).limit(1);
  const langoClassId = existingLangoClass?.id
    ?? (await db.insert(classes).values({ tenantId: langoTenantId, name: 'Intermediate', mediumId: anglaisMediumId }).returning({ id: classes.id }))[0]!.id;

  const [existingLangoClassSection] = await db.select({ id: classSections.id }).from(classSections).where(and(eq(classSections.classId, langoClassId), eq(classSections.sectionId, langoSectionAId))).limit(1);
  const langoClassSectionId = existingLangoClassSection?.id
    ?? (await db.insert(classSections).values({ tenantId: langoTenantId, classId: langoClassId, sectionId: langoSectionAId, mediumId: anglaisMediumId }).returning({ id: classSections.id }))[0]!.id;

  await db.insert(user).values([
    {
      id: 'USR-LANGO-TCH-001',
      tenantId: langoTenantId,
      name: 'Sara Bennis',
      email: 'sara.bennis@lango.ma',
      phone: '+212 6 22-334455',
      role: 'teacher',
      userStatus: 'active',
    },
    {
      id: 'LANGO-STU-001',
      tenantId: langoTenantId,
      name: 'Adam Chraibi',
      email: 'lango-stu-001@placeholder.local',
      role: 'student',
      matricule: 'LNG-2425-0001',
      classSectionId: langoClassSectionId,
      userStatus: 'active',
      paymentStatus: 'À jour',
    },
    {
      id: 'LANGO-STU-002',
      tenantId: langoTenantId,
      name: 'Yasmine Fassi',
      email: 'lango-stu-002@placeholder.local',
      role: 'student',
      matricule: 'LNG-2425-0002',
      classSectionId: langoClassSectionId,
      userStatus: 'active',
      paymentStatus: 'À jour',
    },
  ]).onConflictDoNothing();

  const [existingLangoInvoice] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.tenantId, langoTenantId)).limit(1);
  if (!existingLangoInvoice) {
    const todayIso = new Date().toISOString().slice(0, 10);
    await db.insert(attendance).values([
      { tenantId: langoTenantId, studentId: 'LANGO-STU-001', date: todayIso, status: 'present', markedById: 'USR-LANGO-TCH-001' },
      { tenantId: langoTenantId, studentId: 'LANGO-STU-002', date: todayIso, status: 'present', markedById: 'USR-LANGO-TCH-001' },
    ]);

    const [langoInvoice] = await db.insert(invoices).values({
      tenantId: langoTenantId,
      studentId: 'LANGO-STU-001',
      invoiceNumber: 'LNG-INV-2026-0001',
      amount: 1500,
      netAmount: 1500,
      paidAmount: 1500,
      status: 'paid',
      dueDate: todayIso,
      issueDate: todayIso,
    }).returning({ id: invoices.id });

    await db.insert(payments).values({
      tenantId: langoTenantId,
      invoiceId: langoInvoice!.id,
      studentId: 'LANGO-STU-001',
      amount: 1500,
      paymentMethod: 'card',
      receivedById: 'USR-LANGO-001',
    });
  }

  const seedPassword = process.env.SCHOOL_ADMIN_SEED_PASSWORD || 'Admin123!';
  const now = new Date();
  const hashedPassword = await hashPassword(seedPassword);

  // One login credential per role, so RBAC (sidebar/layout guards) can actually
  // be tested against every role, not just school_admin.
  const credentialUserIds = ['USR-001', 'USR-LANGO-001', 'USR-002', 'USR-SUPER-001'];
  for (const userId of credentialUserIds) {
    await db
      .insert(account)
      .values({
        id: `seed-credential-${userId.toLowerCase()}`,
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: account.id,
        set: { password: hashedPassword, updatedAt: now },
      });
  }

  console.warn(`Seeded tenants Atlas and Lango; ${credentialUserIds.length} accounts have login credentials (password: ${seedPassword}).`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
