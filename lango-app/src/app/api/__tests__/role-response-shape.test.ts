// Role response-shape guards (D-5 / P1 field-leak sweep).
//
// Shared endpoints were built around school_admin's response shape, then opened
// to narrower roles (teacher/receptionist) without trimming privileged fields.
// This test locks two fixes:
//   * `GET /api/cards/issued` — teacher/receptionist must NOT receive
//     `renderDataSnapshot` (DOB/NID/blood group/guardian) or `publicTokenHash`.
//   * `GET /api/certificates/issued/[id]` — teacher/receptionist must NOT
//     receive `evidenceSnapshot` or `verificationTokenHash`.
// school_admin still receives the full shape (no regression for the admin UI).
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { addonEntitlements, tenants, user } from '@/models/Schema';
import {
  documentTemplates,
  documentTemplateVersions,
  issuedDocuments,
} from '@/features/cards/models/cards-schema';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const sessionUserId = { value: null as string | null };

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () =>
        sessionUserId.value
          ? { user: { id: sessionUserId.value }, session: { id: 'sess-shape' } }
          : null,
    },
  },
}));

vi.mock('@/features/portal/services/active-context', () => ({
  resolveActiveContext: async () => null,
}));

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('role response shape (field-leak sweep)', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const adminA = `SHAPE-ADMIN-${suffix}`;
  const teacherA = `SHAPE-TEACHER-${suffix}`;
  const receptionA = `SHAPE-RECEPT-${suffix}`;
  const studentA = `SHAPE-STU-${suffix}`;

  let cardId = '';
  let certId = '';

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Shape School ${suffix}`, slug: `shape-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminA, tenantId: tenantA, name: 'Shape Admin', email: `shape-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: teacherA, tenantId: tenantA, name: 'Shape Teacher', email: `shape-teacher-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
      { id: receptionA, tenantId: tenantA, name: 'Shape Reception', email: `shape-recept-${suffix}@test.local`, role: 'receptionist', userStatus: 'active' },
      { id: studentA, tenantId: tenantA, name: 'Alice Shape', email: `shape-stu-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);

    // Card fixtures — renderDataSnapshot carries the PII the list must not leak.
    const template = (await db.insert(documentTemplates).values({
      tenantId: tenantA, name: 'Student Card', type: 'student_id', status: 'published', isDefault: true, createdBy: adminA,
    }).returning({ id: documentTemplates.id }))[0]!;
    const version = (await db.insert(documentTemplateVersions).values({
      tenantId: tenantA, templateId: template.id, versionNumber: 1, pageWidthMm: 85, pageHeightMm: 55, orientation: 'landscape',
      schemaJson: {}, publishedById: adminA,
    }).returning({ id: documentTemplateVersions.id }))[0]!;
    const card = (await db.insert(issuedDocuments).values({
      tenantId: tenantA, type: 'student_id', templateVersionId: version.id, subjectType: 'student', subjectId: studentA,
      publicTokenHash: sha256(`SHAPE-CARD-TOKEN-${suffix}`), status: 'active',
      renderDataSnapshot: { subjectName: 'Alice Shape', nationalId: 'NID-12345', bloodGroup: 'A+', dateOfBirth: '2010-01-01', guardianName: 'Parent Shape' },
      issuedById: adminA,
    }).returning({ id: issuedDocuments.id }))[0]!;
    cardId = card.id;

    // Certificate fixtures — evidenceSnapshot carries internal evidence.
    const def = (await db.insert(certificateDefinitions).values({
      tenantId: tenantA, title: 'Certificat', allowedTargetType: 'student', createdBy: adminA,
    }).returning({ id: certificateDefinitions.id }))[0]!;
    const ver = (await db.insert(certificateDefinitionVersions).values({
      tenantId: tenantA, definitionId: def.id, versionNumber: 1, fieldAllowlist: {}, templateSchema: {}, pdfmeBasePdf: {}, createdBy: adminA,
    }).returning({ id: certificateDefinitionVersions.id }))[0]!;
    const cert = (await db.insert(issuedCertificates).values({
      tenantId: tenantA, definitionId: def.id, versionId: ver.id, recipientId: studentA,
      serialNumber: `SHAPE-CERT-1-${suffix}`, verificationTokenHash: sha256(`SHAPE-CERT-TOKEN-${suffix}`),
      fileExt: 'pdf', status: 'valid', evidenceSnapshot: { type: 'manual_authorized', authorizedBy: adminA, notes: 'internal note' }, issuedBy: adminA,
    }).returning({ id: issuedCertificates.id }))[0]!;
    certId = cert.id;

    await db.insert(addonEntitlements).values([
      { tenantId: tenantA, addonId: 'card-management', isEnabled: true },
      { tenantId: tenantA, addonId: 'certificate-management', isEnabled: true },
    ]);
  }, 30_000);

  afterAll(async () => {
    await db.delete(issuedCertificates).where(eq(issuedCertificates.tenantId, tenantA));
    await db.delete(certificateDefinitionVersions).where(eq(certificateDefinitionVersions.tenantId, tenantA));
    await db.delete(certificateDefinitions).where(eq(certificateDefinitions.tenantId, tenantA));
    await db.delete(issuedDocuments).where(eq(issuedDocuments.tenantId, tenantA));
    await db.delete(documentTemplateVersions).where(eq(documentTemplateVersions.tenantId, tenantA));
    await db.delete(documentTemplates).where(eq(documentTemplates.tenantId, tenantA));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
  }, 30_000);

  async function cardsIssuedFor(role: string) {
    sessionUserId.value = role === 'school_admin' ? adminA : role === 'teacher' ? teacherA : receptionA;
    const { GET } = await import('@/app/api/cards/issued/route');
    const res = await GET(new Request('http://localhost/api/cards/issued'));
    const body = await res.json() as { success: boolean; data: any[] };
    return body.data.find((d) => d.id === cardId);
  }

  async function certificateDetailFor(role: string) {
    sessionUserId.value = role === 'school_admin' ? adminA : role === 'teacher' ? teacherA : receptionA;
    const { GET } = await import('@/app/api/certificates/issued/[id]/route');
    const res = await GET(new Request(`http://localhost/api/certificates/issued/${certId}`), { params: Promise.resolve({ id: certId }) });
    const body = await res.json() as { success: boolean; data: any };
    return body.data;
  }

  describe('GET /api/cards/issued', () => {
    it('strips renderDataSnapshot + publicTokenHash for teacher', async () => {
      const item = await cardsIssuedFor('teacher');
      expect(item.subjectName).toBe('Alice Shape');
      expect(item.renderDataSnapshot).toBeUndefined();
      expect(item.publicTokenHash).toBeUndefined();
    });

    it('strips renderDataSnapshot + publicTokenHash for receptionist', async () => {
      const item = await cardsIssuedFor('receptionist');
      expect(item.subjectName).toBe('Alice Shape');
      expect(item.renderDataSnapshot).toBeUndefined();
      expect(item.publicTokenHash).toBeUndefined();
    });

    it('keeps the full shape for school_admin', async () => {
      const item = await cardsIssuedFor('school_admin');
      expect(item.renderDataSnapshot).toBeDefined();
      expect(item.renderDataSnapshot.nationalId).toBe('NID-12345');
      expect(item.publicTokenHash).toBeDefined();
    });
  });

  describe('GET /api/certificates/issued/[id]', () => {
    it('strips evidenceSnapshot + verificationTokenHash for teacher', async () => {
      const data = await certificateDetailFor('teacher');
      expect(data.serialNumber).toBe(`SHAPE-CERT-1-${suffix}`);
      expect(data.evidenceSnapshot).toBeUndefined();
      expect(data.verificationTokenHash).toBeUndefined();
    });

    it('strips evidenceSnapshot + verificationTokenHash for receptionist', async () => {
      const data = await certificateDetailFor('receptionist');
      expect(data.serialNumber).toBe(`SHAPE-CERT-1-${suffix}`);
      expect(data.evidenceSnapshot).toBeUndefined();
      expect(data.verificationTokenHash).toBeUndefined();
    });

    it('keeps the full shape for school_admin', async () => {
      const data = await certificateDetailFor('school_admin');
      expect(data.evidenceSnapshot).toBeDefined();
      expect(data.evidenceSnapshot.notes).toBe('internal note');
      expect(data.verificationTokenHash).toBeDefined();
    });
  });
});

// Static analysis: student detail route must strip admin-only PII from
// non-admin roles. This catches regressions without needing a live DB.
import fs from 'fs';
import path from 'path';

describe('D-5 static: student detail per-role PII redaction', () => {
  const routePath = path.resolve(__dirname, '../../api/students/route.ts');
  const src = fs.readFileSync(routePath, 'utf8');

  const ADMIN_ONLY_PII = ['nationalId', 'bloodGroup', 'address'];
  const FINANCE_FIELDS = ['payments', 'balanceDue'];
  const ACADEMIC_FIELDS = ['attendance'];

  it('strips admin-only PII from accountant response', () => {
    const accountantBlock = src.match(
      /context\.role\s*===?\s*'accountant'\)\s*\{[^}]+\}/s,
    );
    expect(accountantBlock, 'accountant role branch not found').toBeTruthy();
    for (const field of ADMIN_ONLY_PII) {
      expect(
        accountantBlock![0],
        `accountant block must destructure-strip ${field}`,
      ).toContain(field);
    }
    for (const field of ACADEMIC_FIELDS) {
      expect(
        accountantBlock![0],
        `accountant block must destructure-strip ${field}`,
      ).toContain(field);
    }
  });

  it('strips admin-only PII and finance fields from teacher response', () => {
    const teacherBlock = src.match(
      /context\.role\s*===?\s*'teacher'\)\s*\{[^}]+\}/s,
    );
    expect(teacherBlock, 'teacher role branch not found').toBeTruthy();
    for (const field of ADMIN_ONLY_PII) {
      expect(
        teacherBlock![0],
        `teacher block must destructure-strip ${field}`,
      ).toContain(field);
    }
    for (const field of FINANCE_FIELDS) {
      expect(
        teacherBlock![0],
        `teacher block must destructure-strip ${field}`,
      ).toContain(field);
    }
  });

  it('guardian detail projects columns explicitly (no bare select())', () => {
    const guardianDetailPath = path.resolve(
      __dirname,
      '../../api/students/parents/[id]/route.ts',
    );
    const guardianSrc = fs.readFileSync(guardianDetailPath, 'utf8');
    const bareSelectPattern = /\.select\(\)\s*\.\s*from\(\s*guardians\s*\)/;
    expect(
      bareSelectPattern.test(guardianSrc),
      'guardian detail must not use bare select() from guardians',
    ).toBe(false);
  });
});
