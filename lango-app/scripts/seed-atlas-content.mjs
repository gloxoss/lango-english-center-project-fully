import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const UPLOADS_ROOT = process.env.UPLOADS_DIR || '/app/uploads';

function blobKeyFor(tenantId, assetId, versionId, sha256) {
  return `tenant/${tenantId}/assets/${assetId}/versions/${versionId}/${sha256}`;
}

async function writeBlob(key, buffer) {
  const fullPath = path.join(UPLOADS_ROOT, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

// Minimal valid PDF header/trailer for magic byte checks (starts with %PDF)
const SAMPLE_PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Atlas Resource Document) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
// Minimal valid PNG (starts with 89 50 4E 47 0D 0A 1A 0A)
const SAMPLE_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
// Minimal MP3 frame header (starts with FFFB or audio bytes)
const SAMPLE_MP3_BUFFER = Buffer.concat([
  Buffer.from([0xff, 0xfb, 0x90, 0x44]),
  Buffer.alloc(1024, 0xaa),
]);

async function main() {
  console.log('Seeding Attachments Book content for Atlas High School...');
  const atlasRes = await pool.query("SELECT id, name, slug FROM tenants WHERE slug = 'atlas'");
  if (atlasRes.rows.length === 0) {
    throw new Error("Tenant 'atlas' not found in database.");
  }
  const atlas = atlasRes.rows[0];
  const tenantId = atlas.id;
  console.log(`Found Atlas tenant: ${tenantId} (${atlas.name})`);

  // 1. Ensure addon_entitlements has attachments-book
  await pool.query(
    `INSERT INTO addon_entitlements (id, tenant_id, addon_id, is_enabled, created_at, updated_at)
     VALUES ($1, $2, 'attachments-book', true, NOW(), NOW())
     ON CONFLICT (tenant_id, addon_id) DO UPDATE SET is_enabled = true, updated_at = NOW()`,
    [crypto.randomUUID(), tenantId]
  );
  console.log('Enabled attachments-book entitlement for Atlas.');

  // Find admin, teacher, sections, subjects
  const adminRes = await pool.query(
    "SELECT id, name, email FROM \"user\" WHERE tenant_id = $1 AND role = 'school_admin' LIMIT 1",
    [tenantId]
  );
  const teacherRes = await pool.query(
    "SELECT id, name, email FROM \"user\" WHERE tenant_id = $1 AND role = 'teacher' LIMIT 1",
    [tenantId]
  );
  const adminId = adminRes.rows[0]?.id || 'USR-ADMIN-ATLAS';
  const teacherId = teacherRes.rows[0]?.id || 'USR-TEACHER-ATLAS';

  const sectionRes = await pool.query(
    "SELECT id FROM class_sections WHERE tenant_id = $1 LIMIT 1",
    [tenantId]
  );
  const sectionId = sectionRes.rows[0]?.id;

  const subjectRes = await pool.query(
    "SELECT id FROM class_subjects WHERE tenant_id = $1 LIMIT 1",
    [tenantId]
  );
  const subjectId = subjectRes.rows[0]?.id;

  // 2. Clear existing types and assets for Atlas to create a clean, deterministic seed
  await pool.query('DELETE FROM digital_assets WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM attachment_types WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM digital_asset_tags WHERE tenant_id = $1', [tenantId]);
  console.log('Cleaned previous Atlas attachments data.');

  // 3. Insert Canonical Attachment Types
  const typesToInsert = [
    {
      id: crypto.randomUUID(),
      name: 'Documents de cours',
      code: 'DOCS',
      icon: 'file-text',
      color: '#0066FF',
      allowedMimeFamilies: JSON.stringify(['document', 'pdf']),
      maxSizeBytes: 26214400, // 25 MB
      studentVisible: true,
      downloadable: true,
      isSystem: true,
      isActive: true,
      displayOrder: 1,
    },
    {
      id: crypto.randomUUID(),
      name: 'Supports de présentation',
      code: 'SUPPORTS',
      icon: 'presentation',
      color: '#8B5CF6',
      allowedMimeFamilies: JSON.stringify(['document', 'pdf', 'image']),
      maxSizeBytes: 52428800, // 50 MB
      studentVisible: true,
      downloadable: true,
      isSystem: false,
      isActive: true,
      displayOrder: 2,
    },
    {
      id: crypto.randomUUID(),
      name: 'Ressources multimédia',
      code: 'MEDIA',
      icon: 'image',
      color: '#10B981',
      allowedMimeFamilies: JSON.stringify(['image', 'audio']),
      maxSizeBytes: 31457280, // 30 MB
      studentVisible: true,
      downloadable: true,
      isSystem: false,
      isActive: true,
      displayOrder: 3,
    },
    {
      id: crypto.randomUUID(),
      name: 'Guides pédagogiques & corrigés',
      code: 'STAFF_ONLY',
      icon: 'lock',
      color: '#F59E0B',
      allowedMimeFamilies: JSON.stringify(['document', 'pdf']),
      maxSizeBytes: 20971520, // 20 MB
      studentVisible: false,
      downloadable: true,
      isSystem: false,
      isActive: true,
      displayOrder: 4,
    },
    {
      id: crypto.randomUUID(),
      name: 'Archives & anciens examens',
      code: 'ARCHIVES',
      icon: 'archive',
      color: '#64748B',
      allowedMimeFamilies: JSON.stringify(['pdf']),
      maxSizeBytes: 15728640, // 15 MB
      studentVisible: true,
      downloadable: true,
      isSystem: false,
      isActive: false, // Inactive / Archived tab
      displayOrder: 5,
    },
  ];

  for (const t of typesToInsert) {
    await pool.query(
      `INSERT INTO attachment_types (id, tenant_id, name, code, icon, color, allowed_mime_families, max_size_bytes, student_visible, downloadable, is_system, is_active, display_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
      [t.id, tenantId, t.name, t.code, t.icon, t.color, t.allowedMimeFamilies, t.maxSizeBytes, t.studentVisible, t.downloadable, t.isSystem, t.isActive, t.displayOrder]
    );
  }
  console.log(`Inserted ${typesToInsert.length} attachment types.`);

  const docType = typesToInsert[0];
  const supportType = typesToInsert[1];
  const mediaType = typesToInsert[2];
  const staffType = typesToInsert[3];

  // Helper to create asset + version + blob
  async function createAssetWithVersion(data) {
    const assetId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const sha256 = crypto.createHash('sha256').update(data.buffer).digest('hex');
    const storageKey = blobKeyFor(tenantId, assetId, 'v1', sha256);

    await writeBlob(storageKey, data.buffer);

    await pool.query(
      `INSERT INTO digital_assets (id, tenant_id, title, description, attachment_type_id, owner_id, status, current_version_id, downloadable, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())`,
      [assetId, tenantId, data.title, data.description, data.typeId, data.ownerId, data.status, versionId]
    );

    await pool.query(
      `INSERT INTO digital_asset_versions (id, asset_id, version_number, storage_key, original_filename, safe_filename, detected_mime, extension, byte_size, sha256, scan_status, uploader_id, created_at)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, 'clean', $10, NOW())`,
      [versionId, assetId, storageKey, data.filename, data.filename.replace(/[^a-zA-Z0-9._-]/g, '_'), data.mime, data.ext, data.buffer.length, sha256, data.ownerId]
    );

    // Targets
    for (const tgt of data.targets || []) {
      await pool.query(
        `INSERT INTO digital_asset_targets (id, asset_id, target_kind, target_role_value, target_ref_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [crypto.randomUUID(), assetId, tgt.kind, tgt.roleValue || null, tgt.refId || null]
      );
    }

    // Tags
    for (const tagName of data.tags || []) {
      const tagRes = await pool.query(
        `INSERT INTO digital_asset_tags (id, tenant_id, name, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (tenant_id, name) DO UPDATE SET name = $3 RETURNING id`,
        [crypto.randomUUID(), tenantId, tagName.toLowerCase()]
      );
      const tagId = tagRes.rows[0].id;
      await pool.query(
        `INSERT INTO digital_asset_tag_links (id, asset_id, tag_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (asset_id, tag_id) DO NOTHING`,
        [crypto.randomUUID(), assetId, tagId]
      );
    }

    return assetId;
  }

  // 4. Create sample assets
  await createAssetWithVersion({
    title: "Guide d'accueil & Règlement Intérieur 2026-2027",
    description: "Document officiel fixant les règles de vie scolaire, horaires et calendrier pour l'année académique.",
    typeId: docType.id,
    ownerId: adminId,
    status: 'published',
    buffer: SAMPLE_PDF_BUFFER,
    filename: 'reglement-interieur-atlas.pdf',
    mime: 'application/pdf',
    ext: 'pdf',
    targets: [{ kind: 'school' }],
    tags: ['accueil', 'reglement', 'officiel'],
  });

  await createAssetWithVersion({
    title: 'Manuel de Cours - Anglais B1 Intermediate',
    description: 'Manuel complet comprenant les unités 1 à 6, vocabulaire et exercices grammaticaux.',
    typeId: docType.id,
    ownerId: teacherId,
    status: 'published',
    buffer: SAMPLE_PDF_BUFFER,
    filename: 'english-b1-intermediate.pdf',
    mime: 'application/pdf',
    ext: 'pdf',
    targets: [{ kind: 'school' }],
    tags: ['anglais', 'manuel', 'b1'],
  });

  await createAssetWithVersion({
    title: 'Support Présentation - Physique-Chimie : Les Solutions Aqueuses',
    description: 'Diapositives de synthèse avec schémas expérimentaux et formules de concentration molaire.',
    typeId: supportType.id,
    ownerId: teacherId,
    status: 'published',
    buffer: SAMPLE_PDF_BUFFER,
    filename: 'presentation-solutions-aqueuses.pdf',
    mime: 'application/pdf',
    ext: 'pdf',
    targets: sectionId ? [{ kind: 'class_section', refId: sectionId }] : [{ kind: 'school' }],
    tags: ['physique', 'chimie', 'cours'],
  });

  await createAssetWithVersion({
    title: "Enregistrement Audio - Exercice Compréhension Orale N°2",
    description: 'Dialogue authentique entre deux interlocuteurs avec questions à choix multiples.',
    typeId: mediaType.id,
    ownerId: teacherId,
    status: 'published',
    buffer: SAMPLE_MP3_BUFFER,
    filename: 'listening-comprehension-session2.mp3',
    mime: 'audio/mpeg',
    ext: 'mp3',
    targets: [{ kind: 'school' }],
    tags: ['audio', 'oral', 'listening'],
  });

  await createAssetWithVersion({
    title: 'Infographie - Tableau Périodique des Éléments HD',
    description: 'Ressource visuelle haute résolution pour les travaux dirigés de sciences.',
    typeId: mediaType.id,
    ownerId: teacherId,
    status: 'published',
    buffer: SAMPLE_PNG_BUFFER,
    filename: 'tableau-periodique-elements.png',
    mime: 'image/png',
    ext: 'png',
    targets: [{ kind: 'school' }],
    tags: ['infographie', 'chimie', 'visuel'],
  });

  await createAssetWithVersion({
    title: 'Corrigé Détaillé & Grille de Notation - Devoir Surveillé N°1',
    description: 'Document réservé au corps professoral pour harmonisation de la correction.',
    typeId: staffType.id,
    ownerId: teacherId,
    status: 'published',
    buffer: SAMPLE_PDF_BUFFER,
    filename: 'corrige-ds1-enseignants.pdf',
    mime: 'application/pdf',
    ext: 'pdf',
    targets: [{ kind: 'role', roleValue: 'teacher' }],
    tags: ['corrige', 'confidentiel', 'professeurs'],
  });

  // Draft asset
  await createAssetWithVersion({
    title: 'Brouillon - Fiche Travaux Pratiques Informatique & Algorithmique',
    description: 'Document en cours de rédaction pour la session du deuxième trimestre.',
    typeId: docType.id,
    ownerId: teacherId,
    status: 'draft',
    buffer: SAMPLE_PDF_BUFFER,
    filename: 'tp-algo-draft.pdf',
    mime: 'application/pdf',
    ext: 'pdf',
    targets: [{ kind: 'school' }],
    tags: ['informatique', 'brouillon'],
  });

  // Archived asset
  await createAssetWithVersion({
    title: 'Archives - Annales Baccalauréat National 2024-2025',
    description: 'Anciennes épreuves archivées conservées à titre de consultation historique.',
    typeId: docType.id,
    ownerId: adminId,
    status: 'archived',
    buffer: SAMPLE_PDF_BUFFER,
    filename: 'annales-bac-2024.pdf',
    mime: 'application/pdf',
    ext: 'pdf',
    targets: [{ kind: 'school' }],
    tags: ['annales', 'archives'],
  });

  console.log('Successfully seeded 8 digital assets across various statuses and types.');
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
