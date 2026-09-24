import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 1. Load environment variables before DB initialization
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]!]) {
      process.env[match[1]!] = match[2]!;
    }
  }
}

async function runAttachmentsLifecycleE2E() {
  console.log('================================================================');
  console.log('   ATTACHMENTS BOOK & ACADEMIC RESOURCES RUNTIME E2E LIFECYCLE  ');
  console.log('================================================================\n');

  // Dynamic imports
  const { db } = await import('../src/libs/DB');
  const { user, tenants, addonEntitlements, classSections, classes, sections, liveClassSessions } = await import('../src/models/Schema');
  const {
    attachmentTypes,
    digitalAssets,
    digitalAssetVersions,
    digitalAssetTargets,
    digitalAssetTags,
    digitalAssetTagLinks,
    digitalAssetUsageLinks,
    digitalAssetAccessEvents,
  } = await import('../src/features/attachments/models/attachments-schema');
  const { auth } = await import('../src/libs/auth');
  const { eq, and } = await import('drizzle-orm');

  // Route Handlers
  const { GET: GET_attachment_types, POST: POST_attachment_types } = await import('../src/app/api/content/attachment-types/route');
  const { PUT: PUT_attachment_type, DELETE: DELETE_attachment_type } = await import('../src/app/api/content/attachment-types/[id]/route');
  const { GET: GET_assets, POST: POST_assets } = await import('../src/app/api/content/assets/route');
  const { GET: GET_asset_by_id, PATCH: PATCH_asset_by_id } = await import('../src/app/api/content/assets/[id]/route');
  const { POST: POST_publish_asset } = await import('../src/app/api/content/assets/[id]/publish/route');
  const { POST: POST_archive_asset } = await import('../src/app/api/content/assets/[id]/archive/route');
  const { GET: GET_download_asset } = await import('../src/app/api/content/assets/[id]/download/route');
  const { PUT: PUT_asset_targets } = await import('../src/app/api/content/assets/[id]/targets/route');
  const { POST: POST_asset_versions } = await import('../src/app/api/content/assets/[id]/versions/route');
  const { GET: GET_usage_links, POST: POST_usage_links, DELETE: DELETE_usage_links } = await import('../src/app/api/content/assets/[id]/usage-links/route');

  // Mock Session for test requests
  (auth.api as any).getSession = async ({ headers }: { headers: Headers }) => {
    const testUserId = headers.get('x-test-user-id');
    if (!testUserId) return null;
    return {
      user: { id: testUserId },
      session: { id: `session-${testUserId}` },
    };
  };

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Step ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Step ${totalTests}: ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  const suffix = Date.now().toString().slice(-6);
  const TENANT_A = crypto.randomUUID();
  const TENANT_B = crypto.randomUUID();
  const TENANT_DISABLED = crypto.randomUUID();

  const ADMIN_A = `usr_admin_a_${suffix}`;
  const TEACHER_A = `usr_teacher_a_${suffix}`;
  const STUDENT_A1 = `usr_student_a1_${suffix}`;
  const STUDENT_A2 = `usr_student_a2_${suffix}`;

  const ADMIN_B = `usr_admin_b_${suffix}`;
  const ADMIN_DISABLED = `usr_admin_dis_${suffix}`;

  const HOMEWORK_ID = crypto.randomUUID();

  const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (E2E Test Document) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  const VALID_PDF_V2 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (E2E Test Document Version 2) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  const VALID_PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const EICAR_BUFFER = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

  let normalTypeId = '';
  let staffTypeId = '';
  let systemTypeId = '';
  let asset1Id = '';
  let staffAssetId = '';

  try {
    console.log('--- Phase 0: Provisioning Test Fixtures ---');
    try {
      await db.insert(tenants).values([
        { id: TENANT_A, name: `Content Tenant A ${suffix}`, slug: `tenant-a-cnt-${suffix}` },
        { id: TENANT_B, name: `Content Tenant B ${suffix}`, slug: `tenant-b-cnt-${suffix}` },
        { id: TENANT_DISABLED, name: `Content Disabled ${suffix}`, slug: `tenant-dis-cnt-${suffix}` },
      ]);

      await db.insert(addonEntitlements).values([
        { tenantId: TENANT_A, addonId: 'attachments-book', isEnabled: true },
        { tenantId: TENANT_B, addonId: 'attachments-book', isEnabled: true },
        { tenantId: TENANT_DISABLED, addonId: 'attachments-book', isEnabled: false },
      ]);

      await db.insert(user).values([
        { id: ADMIN_A, tenantId: TENANT_A, name: 'Admin A', email: `admin_a_${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
        { id: TEACHER_A, tenantId: TENANT_A, name: 'Teacher A', email: `teacher_a_${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
        { id: STUDENT_A1, tenantId: TENANT_A, name: 'Student A1', email: `student_a1_${suffix}@test.local`, role: 'student', userStatus: 'active' },
        { id: STUDENT_A2, tenantId: TENANT_A, name: 'Student A2', email: `student_a2_${suffix}@test.local`, role: 'student', userStatus: 'active' },
        { id: ADMIN_B, tenantId: TENANT_B, name: 'Admin B', email: `admin_b_${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
        { id: ADMIN_DISABLED, tenantId: TENANT_DISABLED, name: 'Admin Dis', email: `admin_dis_${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      ]);

      // Create assessment definition (homework) for usage link tests
      const { assessmentDefinitions } = await import('../src/features/assessment/models/assessment-schema');
      await db.insert(assessmentDefinitions).values({
        id: HOMEWORK_ID,
        tenantId: TENANT_A,
        title: `Devoir Surveillé ${suffix}`,
        type: 'homework',
        status: 'published',
        maximumScore: '20.00',
        coefficient: '1.00',
      });

      console.log('Fixtures initialized.\n');
    } catch (setupErr) {
      console.error('Fixture setup failed:', setupErr);
      throw setupErr;
    }

    // Helper to build request
    const createReq = (url: string, method: string, userId: string, body?: any, isForm = false) => {
      const headers = new Headers();
      headers.set('x-test-user-id', userId);
      let reqBody: any = undefined;
      if (body) {
        if (isForm) {
          reqBody = body;
        } else {
          headers.set('Content-Type', 'application/json');
          reqBody = JSON.stringify(body);
        }
      }
      return new Request(url, { method, headers, body: reqBody });
    };

    // =========================================================================
    // PHASE 1: Entitlement Gate Enforcement
    // =========================================================================
    console.log('--- Phase 1: Entitlement Gate Enforcement ---');
    {
      const req = createReq('http://localhost:3111/api/content/attachment-types', 'GET', ADMIN_DISABLED);
      const res = await GET_attachment_types(req);
      const json = await res.json();
      assert(res.status === 403 && json.error?.code === 'ADDON_NOT_ACTIVATED', 'Disabled tenant blocked from attachment-types API with 403 ADDON_NOT_ACTIVATED');
    }
    {
      const req = createReq('http://localhost:3111/api/content/assets', 'GET', ADMIN_DISABLED);
      const res = await GET_assets(req);
      const json = await res.json();
      assert(res.status === 403 && json.error?.code === 'ADDON_NOT_ACTIVATED', 'Disabled tenant blocked from assets API with 403 ADDON_NOT_ACTIVATED');
    }

    // =========================================================================
    // PHASE 2: Attachment Types CRUD & System Type Protection
    // =========================================================================
    console.log('\n--- Phase 2: Attachment Types CRUD & Protection ---');
    let normalTypeId = '';
    let staffTypeId = '';
    let systemTypeId = '';

    // Create normal type
    {
      const req = createReq('http://localhost:3111/api/content/attachment-types', 'POST', ADMIN_A, {
        name: 'Cours & Devoirs',
        code: `COURS_${suffix}`,
        allowedMimeFamilies: ['document', 'pdf'],
        maxSizeBytes: 10485760, // 10MB
        studentVisible: true,
        downloadable: true,
        displayOrder: 1,
      });
      const res = await POST_attachment_types(req);
      const json = await res.json();
      assert(res.status === 201 && json.success, 'Admin created standard attachment type', JSON.stringify(json));
      normalTypeId = json.data.id;
    }

    // Create staff-only type
    {
      const req = createReq('http://localhost:3111/api/content/attachment-types', 'POST', ADMIN_A, {
        name: 'Corrigés Enseignants',
        code: `CORRIGES_${suffix}`,
        allowedMimeFamilies: ['document', 'pdf'],
        maxSizeBytes: 5242880,
        studentVisible: false,
        downloadable: true,
        displayOrder: 2,
      });
      const res = await POST_attachment_types(req);
      const json = await res.json();
      assert(res.status === 201 && json.data.studentVisible === false, 'Admin created staff-only attachment type (studentVisible=false)');
      staffTypeId = json.data.id;
    }

    // Create system type manually in DB
    {
      const [sysType] = await db.insert(attachmentTypes).values({
        tenantId: TENANT_A,
        name: 'Type Système Verrouillé',
        code: `SYS_${suffix}`,
        allowedMimeFamilies: ['pdf'],
        maxSizeBytes: 20971520,
        studentVisible: true,
        downloadable: true,
        isSystem: true,
        isActive: true,
      }).returning();
      systemTypeId = sysType!.id;
    }

    // List attachment types
    {
      const req = createReq('http://localhost:3111/api/content/attachment-types', 'GET', ADMIN_A);
      const res = await GET_attachment_types(req);
      const json = await res.json();
      assert(res.status === 200 && json.data.length >= 3, 'GET /api/content/attachment-types returns created types');
    }

    // Update normal type
    {
      const req = createReq(`http://localhost:3111/api/content/attachment-types/${normalTypeId}`, 'PUT', ADMIN_A, {
        name: 'Cours & Devoirs Révisé',
      });
      const res = await PUT_attachment_type(req, { params: Promise.resolve({ id: normalTypeId }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.name === 'Cours & Devoirs Révisé', 'Successfully updated mutable attachment type');
    }

    // Attempt to update system type -> 403 SYSTEM_TYPE_LOCKED
    {
      const req = createReq(`http://localhost:3111/api/content/attachment-types/${systemTypeId}`, 'PUT', ADMIN_A, {
        name: 'Piratage Système',
      });
      const res = await PUT_attachment_type(req, { params: Promise.resolve({ id: systemTypeId }) });
      const json = await res.json();
      assert(res.status === 403 && json.error?.code === 'SYSTEM_TYPE_LOCKED', 'System attachment type modification rejected with 403 SYSTEM_TYPE_LOCKED');
    }

    // Archive normal type
    {
      const req = createReq(`http://localhost:3111/api/content/attachment-types/${normalTypeId}`, 'DELETE', ADMIN_A);
      const res = await DELETE_attachment_type(req, { params: Promise.resolve({ id: normalTypeId }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.isActive === false, 'Attachment type soft-archived via DELETE (isActive=false)');
    }

    // Restore archived type
    {
      const req = createReq(`http://localhost:3111/api/content/attachment-types/${normalTypeId}`, 'PUT', ADMIN_A, {
        isActive: true,
      });
      const res = await PUT_attachment_type(req, { params: Promise.resolve({ id: normalTypeId }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.isActive === true, 'Archived attachment type restored via PUT (isActive=true)');
    }

    // =========================================================================
    // PHASE 3: Asset Upload Validation, ClamAV Malware Defense & Safe Filenames
    // =========================================================================
    console.log('\n--- Phase 3: Asset Upload Validation & ClamAV Defense ---');
    let asset1Id = '';
    let staffAssetId = '';

    // Disallowed MIME family
    {
      const form = new FormData();
      form.append('title', 'Audio in Document Type');
      form.append('attachmentTypeId', normalTypeId);
      const audioBlob = new Blob(['invalid-audio-bytes'], { type: 'audio/mpeg' });
      form.append('file', audioBlob, 'audio.mp3');
      const req = createReq('http://localhost:3111/api/content/assets', 'POST', ADMIN_A, form, true);
      const res = await POST_assets(req);
      const json = await res.json();
      assert(res.status === 422 && json.error?.code === 'INGEST_REJECTED', 'MIME family mismatch rejected with 422 INGEST_REJECTED');
    }

    // Spoofed magic bytes
    {
      const form = new FormData();
      form.append('title', 'Spoofed PDF');
      form.append('attachmentTypeId', normalTypeId);
      const spoofedBlob = new Blob(['Plain text not a real PDF at all'], { type: 'application/pdf' });
      form.append('file', spoofedBlob, 'fake.pdf');
      const req = createReq('http://localhost:3111/api/content/assets', 'POST', ADMIN_A, form, true);
      const res = await POST_assets(req);
      const json = await res.json();
      assert(res.status === 422 && json.error?.code === 'INGEST_REJECTED', 'Spoofed magic header mismatch rejected with 422 INGEST_REJECTED');
    }

    // Malware infected file detection (EICAR signature)
    {
      const form = new FormData();
      form.append('title', 'Malicious Submission');
      form.append('attachmentTypeId', normalTypeId);
      // EICAR payload with doc extension
      const infectedBlob = new Blob([EICAR_BUFFER], { type: 'application/msword' });
      form.append('file', infectedBlob, 'trojan.doc');
      const req = createReq('http://localhost:3111/api/content/assets', 'POST', ADMIN_A, form, true);
      const res = await POST_assets(req);
      const json = await res.json();
      assert(res.status === 422 && json.error?.message?.includes('infecté'), 'Malware (EICAR) detected and rejected with antivirus alert');
    }

    // Valid upload with unsafe filename
    {
      const form = new FormData();
      form.append('title', 'Document Officiel Mathématiques');
      form.append('description', 'Cours complet de trigonométrie et géométrie.');
      form.append('attachmentTypeId', normalTypeId);
      form.append('tags', JSON.stringify(['maths', 'trigonometrie']));
      form.append('targets', JSON.stringify([{ targetKind: 'school' }]));
      const pdfBlob = new Blob([VALID_PDF], { type: 'application/pdf' });
      form.append('file', pdfBlob, 'cours de maths ../../unsafe $#@!.pdf');

      const req = createReq('http://localhost:3111/api/content/assets', 'POST', ADMIN_A, form, true);
      const res = await POST_assets(req);
      const json = await res.json();
      assert(res.status === 201 && json.success, 'Valid PDF asset ingested successfully', JSON.stringify(json));
      asset1Id = json.data.id;

      // Verify safe filename in version
      const [ver] = await db.select().from(digitalAssetVersions).where(eq(digitalAssetVersions.assetId, asset1Id));
      assert(ver?.versionNumber === 1 && !ver.safeFilename.includes('..') && !ver.safeFilename.includes('$'), `Filename sanitized safely to: ${ver?.safeFilename}`);
    }

    // Upload staff-only asset
    {
      const form = new FormData();
      form.append('title', 'Corrigé Confidentiel Devoir 1');
      form.append('attachmentTypeId', staffTypeId);
      form.append('targets', JSON.stringify([{ targetKind: 'role', targetRoleValue: 'teacher' }]));
      const pdfBlob = new Blob([VALID_PDF], { type: 'application/pdf' });
      form.append('file', pdfBlob, 'corrige-confidentiel.pdf');

      const req = createReq('http://localhost:3111/api/content/assets', 'POST', ADMIN_A, form, true);
      const res = await POST_assets(req);
      const json = await res.json();
      assert(res.status === 201 && json.success, 'Admin uploaded staff-only asset');
      staffAssetId = json.data.id;
    }

    // =========================================================================
    // PHASE 4: Versioning Lifecycle (v1 -> v2)
    // =========================================================================
    console.log('\n--- Phase 4: Versioning Lifecycle ---');
    {
      const form = new FormData();
      const pdfV2Blob = new Blob([VALID_PDF_V2], { type: 'application/pdf' });
      form.append('file', pdfV2Blob, 'cours-maths-v2.pdf');

      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/versions`, 'POST', ADMIN_A, form, true);
      const res = await POST_asset_versions(req, { params: Promise.resolve({ id: asset1Id }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.versionNumber === 2, 'New version uploaded and incremented to versionNumber=2');

      const allVers = await db.select().from(digitalAssetVersions).where(eq(digitalAssetVersions.assetId, asset1Id));
      assert(allVers.length === 2, 'digital_asset_versions contains both v1 and v2 records');

      const [assetRow] = await db.select().from(digitalAssets).where(eq(digitalAssets.id, asset1Id));
      assert(assetRow?.currentVersionId === json.data.versionId, 'Asset currentVersionId successfully updated to v2');
    }

    // =========================================================================
    // PHASE 5: Audience Targeting & Teacher Guard
    // =========================================================================
    console.log('\n--- Phase 5: Audience Targeting & Teacher Guard ---');
    {
      // Teacher cannot set school-wide target
      const form = new FormData();
      form.append('title', 'Teacher Broadcast Attempt');
      form.append('attachmentTypeId', normalTypeId);
      form.append('targets', JSON.stringify([{ targetKind: 'school' }]));
      const pdfBlob = new Blob([VALID_PDF], { type: 'application/pdf' });
      form.append('file', pdfBlob, 'doc.pdf');

      const req = createReq('http://localhost:3111/api/content/assets', 'POST', TEACHER_A, form, true);
      const res = await POST_assets(req);
      const json = await res.json();
      assert(res.status === 403 && json.error?.code === 'FORBIDDEN', 'Teacher prevented from targeting whole school with 403 FORBIDDEN');
    }

    // Admin sets targets via PUT /targets
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/targets`, 'PUT', ADMIN_A, {
        targets: [{ targetKind: 'school' }],
      });
      const res = await PUT_asset_targets(req, { params: Promise.resolve({ id: asset1Id }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.updated === true, 'Admin successfully updated asset targets');
    }

    // Update metadata (PATCH)
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}`, 'PATCH', ADMIN_A, {
        title: 'Document Officiel Mathématiques (Mise à jour)',
        description: 'Description mise à jour pour le deuxième semestre.',
        tags: ['maths', 'semestre2'],
        targets: [{ targetKind: 'school' }],
      });
      const res = await PATCH_asset_by_id(req, { params: Promise.resolve({ id: asset1Id }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.title.includes('Mise à jour'), 'Asset metadata updated via PATCH');
    }

    // =========================================================================
    // PHASE 6: State Machine Lifecycle (Draft -> Ready -> Publish -> Archive)
    // =========================================================================
    console.log('\n--- Phase 6: State Machine Lifecycle ---');
    // Publish asset1
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/publish`, 'POST', ADMIN_A);
      const res = await POST_publish_asset(req, { params: Promise.resolve({ id: asset1Id }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.status === 'published', 'Asset published successfully (status=published)');
    }

    // Publish staffAsset
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${staffAssetId}/publish`, 'POST', ADMIN_A);
      const res = await POST_publish_asset(req, { params: Promise.resolve({ id: staffAssetId }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.status === 'published', 'Staff-only asset published successfully');
    }

    // =========================================================================
    // PHASE 7: Audience Isolation & Student Visibility
    // =========================================================================
    console.log('\n--- Phase 7: Audience Isolation & Student Visibility ---');
    // Student A1 view
    {
      const req = createReq('http://localhost:3111/api/content/assets', 'GET', STUDENT_A1);
      const res = await GET_assets(req);
      const json = await res.json();
      assert(res.status === 200 && json.success, 'Student A1 queried asset library');
      const hasAsset1 = json.data.some((a: any) => a.id === asset1Id);
      const hasStaffAsset = json.data.some((a: any) => a.id === staffAssetId);
      assert(hasAsset1 === true, 'School-wide published asset is visible to student');
      assert(hasStaffAsset === false, 'Staff-only asset (studentVisible=false) is completely hidden from student');
    }

    // Direct GET /api/content/assets/[id] by student
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}`, 'GET', STUDENT_A1);
      const res = await GET_asset_by_id(req, { params: Promise.resolve({ id: asset1Id }) });
      assert(res.status === 200, 'Student can view authorized asset details');
    }

    // Direct GET /api/content/assets/[id] of staff asset by student -> 404 NOT_FOUND
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${staffAssetId}`, 'GET', STUDENT_A1);
      const res = await GET_asset_by_id(req, { params: Promise.resolve({ id: staffAssetId }) });
      assert(res.status === 404, 'Student direct access to staff-only asset rejected with 404 NOT_FOUND');
    }

    // =========================================================================
    // PHASE 8: Stream Download & Access Event Audit Logging
    // =========================================================================
    console.log('\n--- Phase 8: Stream Download & Access Event Audit Logging ---');
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/download`, 'GET', STUDENT_A1);
      const res = await GET_download_asset(req, { params: Promise.resolve({ id: asset1Id }) });
      assert(res.status === 200, 'Authorized stream download returns HTTP 200');
      assert(res.headers.get('Content-Type') === 'application/pdf', 'Correct Content-Type header on download stream');
      assert(res.headers.get('X-Content-Type-Options') === 'nosniff', 'Security header X-Content-Type-Options: nosniff present');
      assert(Boolean(res.headers.get('Content-Disposition')?.includes('attachment; filename=')), 'Content-Disposition header triggers download');

      // Verify access event logged in DB
      const events = await db.select().from(digitalAssetAccessEvents).where(eq(digitalAssetAccessEvents.assetId, asset1Id));
      assert(events.length >= 1 && events.some(e => e.actorId === STUDENT_A1 && e.eventType === 'download'), 'Download access event recorded in digital_asset_access_events table');
    }

    // Student download of staff asset -> 404 NOT_FOUND
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${staffAssetId}/download`, 'GET', STUDENT_A1);
      const res = await GET_download_asset(req, { params: Promise.resolve({ id: staffAssetId }) });
      assert(res.status === 404, 'Student download of staff-only asset denied with 404 NOT_FOUND');
    }

    // =========================================================================
    // PHASE 9: Usage Links (Cross-Feature Association)
    // =========================================================================
    console.log('\n--- Phase 9: Usage Links ---');
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/usage-links`, 'POST', ADMIN_A, {
        usageType: 'homework',
        usageRefId: HOMEWORK_ID,
      });
      const res = await POST_usage_links(req, { params: Promise.resolve({ id: asset1Id }) });
      const json = await res.json();
      assert(res.status === 201 && json.data.usageRefId === HOMEWORK_ID, 'Asset linked to homework assessment via usage-links');
    }

    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/usage-links`, 'GET', ADMIN_A);
      const res = await GET_usage_links(req, { params: Promise.resolve({ id: asset1Id }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.length === 1, 'GET usage-links returns active association');
    }

    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/usage-links?usageRefId=${HOMEWORK_ID}`, 'DELETE', ADMIN_A);
      const res = await DELETE_usage_links(req, { params: Promise.resolve({ id: asset1Id }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.removed === true, 'Usage link removed via DELETE');
    }

    // =========================================================================
    // PHASE 10: Multi-Tenant Isolation
    // =========================================================================
    console.log('\n--- Phase 10: Multi-Tenant Isolation ---');
    {
      // Admin B tries to fetch Asset A
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}`, 'GET', ADMIN_B);
      const res = await GET_asset_by_id(req, { params: Promise.resolve({ id: asset1Id }) });
      assert(res.status === 404, 'Cross-tenant GET /api/content/assets/[id] returns 404 NOT_FOUND');
    }

    {
      // Admin B tries to download Asset A
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/download`, 'GET', ADMIN_B);
      const res = await GET_download_asset(req, { params: Promise.resolve({ id: asset1Id }) });
      assert(res.status === 404, 'Cross-tenant GET /api/content/assets/[id]/download returns 404 NOT_FOUND');
    }

    {
      // Admin B tries to update Tenant A type
      const req = createReq(`http://localhost:3111/api/content/attachment-types/${normalTypeId}`, 'PUT', ADMIN_B, {
        name: 'Hacked Name',
      });
      const res = await PUT_attachment_type(req, { params: Promise.resolve({ id: normalTypeId }) });
      assert(res.status === 404, 'Cross-tenant PUT /api/content/attachment-types/[id] returns 404 NOT_FOUND');
    }

    {
      // Admin B list assets -> 0 assets from Tenant A
      const req = createReq('http://localhost:3111/api/content/assets', 'GET', ADMIN_B);
      const res = await GET_assets(req);
      const json = await res.json();
      assert(res.status === 200 && json.data.length === 0, 'Tenant B asset list does not leak Tenant A records');
    }

    // Archive asset and verify state
    {
      const req = createReq(`http://localhost:3111/api/content/assets/${asset1Id}/archive`, 'POST', ADMIN_A);
      const res = await POST_archive_asset(req, { params: Promise.resolve({ id: asset1Id }) });
      const json = await res.json();
      assert(res.status === 200 && json.data.status === 'archived', 'Asset successfully transitioned to archived status');
    }

  } finally {
    console.log('\n--- Cleaning up test fixtures ---');
    await db.delete(digitalAssetAccessEvents).where(eq(digitalAssetAccessEvents.assetId, asset1Id)).catch(() => {});
    await db.delete(digitalAssetUsageLinks).where(eq(digitalAssetUsageLinks.assetId, asset1Id)).catch(() => {});
    await db.delete(digitalAssetTagLinks).where(eq(digitalAssetTagLinks.assetId, asset1Id)).catch(() => {});
    await db.delete(digitalAssetTargets).where(eq(digitalAssetTargets.assetId, asset1Id)).catch(() => {});
    await db.delete(digitalAssets).where(eq(digitalAssets.tenantId, TENANT_A)).catch(() => {});
    await db.delete(attachmentTypes).where(eq(attachmentTypes.tenantId, TENANT_A)).catch(() => {});
    const { assessmentDefinitions } = await import('../src/features/assessment/models/assessment-schema');
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.id, HOMEWORK_ID)).catch(() => {});
    await db.delete(user).where(and(eq(user.tenantId, TENANT_A))).catch(() => {});
    await db.delete(user).where(and(eq(user.tenantId, TENANT_B))).catch(() => {});
    await db.delete(user).where(and(eq(user.tenantId, TENANT_DISABLED))).catch(() => {});
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, TENANT_A)).catch(() => {});
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, TENANT_B)).catch(() => {});
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, TENANT_DISABLED)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, TENANT_A)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, TENANT_B)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, TENANT_DISABLED)).catch(() => {});
    console.log('Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
  process.exit(0);
}

runAttachmentsLifecycleE2E().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
