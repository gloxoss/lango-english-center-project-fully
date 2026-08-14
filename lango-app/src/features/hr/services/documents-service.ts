import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { employeeDocuments, employeeProfiles } from '@/models/Schema';

// HR documents: immutable blob references on employee_profiles. The actual file
// lives on the tenant-scoped local disk (src/libs/api/uploads.ts); this service
// owns the metadata rows and the tenant-scoped authorization guards.

const ALLOWED_DOCUMENT_TYPES = ['contract', 'cin', 'passport', 'diploma', 'other'] as const;
export type HrDocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number];

export function isAllowedDocumentType(value: string): value is HrDocumentType {
  return (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(value);
}

async function requireEmployee(tenantId: string, employeeId: string) {
  const [row] = await db.select({ id: employeeProfiles.id }).from(employeeProfiles)
    .where(and(eq(employeeProfiles.id, employeeId), eq(employeeProfiles.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');
}

export async function listDocuments(tenantId: string, employeeId: string) {
  await requireEmployee(tenantId, employeeId);
  return db
    .select({
      id: employeeDocuments.id,
      documentType: employeeDocuments.documentType,
      storageKey: employeeDocuments.storageKey,
      originalName: employeeDocuments.originalName,
      mimeType: employeeDocuments.mimeType,
      fileSize: employeeDocuments.fileSize,
      issuedAt: employeeDocuments.issuedAt,
      expiryDate: employeeDocuments.expiryDate,
      visibility: employeeDocuments.visibility,
      uploadedById: employeeDocuments.uploadedById,
      archivedAt: employeeDocuments.archivedAt,
      createdAt: employeeDocuments.createdAt,
    })
    .from(employeeDocuments)
    .where(and(eq(employeeDocuments.tenantId, tenantId), eq(employeeDocuments.employeeId, employeeId)))
    .orderBy(desc(employeeDocuments.createdAt));
}

export type CreateDocumentInput = {
  documentType: HrDocumentType;
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  issuedAt?: string | null;
  expiryDate?: string | null;
  visibility?: string;
};

export async function createDocument(tenantId: string, actorId: string, employeeId: string, input: CreateDocumentInput) {
  await requireEmployee(tenantId, employeeId);
  const [row] = await db
    .insert(employeeDocuments)
    .values({
      tenantId,
      employeeId,
      documentType: input.documentType,
      storageKey: input.storageKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      issuedAt: input.issuedAt ?? null,
      expiryDate: input.expiryDate ?? null,
      visibility: input.visibility ?? 'private',
      uploadedById: actorId,
    })
    .returning();
  return row;
}

export async function getDocument(tenantId: string, employeeId: string, documentId: string) {
  await requireEmployee(tenantId, employeeId);
  const [row] = await db
    .select()
    .from(employeeDocuments)
    .where(and(
      eq(employeeDocuments.id, documentId),
      eq(employeeDocuments.employeeId, employeeId),
      eq(employeeDocuments.tenantId, tenantId),
    ))
    .limit(1);
  return row ?? null;
}

export async function setDocumentArchived(tenantId: string, employeeId: string, documentId: string, archived: boolean) {
  const doc = await getDocument(tenantId, employeeId, documentId);
  if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Document introuvable pour cet employé.');
  const [row] = await db
    .update(employeeDocuments)
    .set({ archivedAt: archived ? new Date().toISOString() : null })
    .where(eq(employeeDocuments.id, documentId))
    .returning();
  return row;
}
