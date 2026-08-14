// Safe CSV import/export for library copies.
//
// Guarantees:
// - Bounded: byte cap, row cap, field-length cap.
// - UTF-8 only: the route decodes with TextDecoder(fatal); a BOM is stripped.
// - Strict header validation: the first row must be exactly the export template.
// - Formula-injection protection: export prefixes `= + - @ \t \r` cells with `'`,
//   import reverses that prefix so round-trips preserve the literal value.
// - Idempotent import: keyed on (tenant, accession_number). Re-importing the same
//   file yields `skip` rows and zero writes; edition/branch cannot be re-keyed.
// - Dry-run: validates every row without writing.
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { branches, libraryCopies, libraryEditions } from '@/models/Schema';

export const CSV_HEADERS = ['isbn13', 'accession_number', 'barcode', 'branch_code', 'shelf_location', 'condition', 'price', 'acquired_at'] as const;
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;
export const MAX_FIELD_LENGTH = 2048;
export const MAX_EXPORT_ROWS = 10_000;

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
const COPY_CONDITIONS = new Set(['new', 'good', 'fair', 'poor', 'damaged']);
const ISBN13_RE = /^\d{13}$/;
const ISBN10_RE = /^\d{9}[\dX]$/;
const PRICE_RE = /^\d+(\.\d{1,2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// CSV cell helpers
// ---------------------------------------------------------------------------

export function sanitizeCell(value: string): string {
  if (value.length > 0 && FORMULA_PREFIXES.includes(value.charAt(0))) return `'${value}`;
  return value;
}

export function desanitizeCell(value: string): string {
  if (value.length > 1 && value.charAt(0) === "'" && FORMULA_PREFIXES.includes(value.charAt(1))) return value.slice(1);
  return value;
}

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Strict RFC-4180 parser
// ---------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      if (field.length >= MAX_FIELD_LENGTH) throw new ApiError(422, 'FIELD_TOO_LONG', `Champ trop long (max ${MAX_FIELD_LENGTH} caractères).`);
      field += ch; i += 1; continue;
    }
    if (ch === '"') {
      if (field.length > 0) throw new ApiError(422, 'MALFORMED_CSV', 'Guillemet au milieu d’un champ non cité.');
      inQuotes = true; i += 1; continue;
    }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i += 1;
      row.push(field); field = '';
      if (row.some(c => c.trim() !== '')) {
        rows.push(row);
        if (rows.length > MAX_CSV_ROWS) throw new ApiError(422, 'CSV_TOO_LARGE', `Fichier trop grand (max ${MAX_CSV_ROWS} lignes).`);
      }
      row = [];
      i += 1; continue;
    }
    if (field.length >= MAX_FIELD_LENGTH) throw new ApiError(422, 'FIELD_TOO_LONG', `Champ trop long (max ${MAX_FIELD_LENGTH} caractères).`);
    field += ch; i += 1;
  }
  if (inQuotes) throw new ApiError(422, 'MALFORMED_CSV', 'Guillemets non fermés.');
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(c => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportCopiesCsv(tenantId: string, filters: { query?: string; state?: string; branchId?: string } = {}) {
  const where = [eq(libraryCopies.tenantId, tenantId)];
  if (filters.state) where.push(eq(libraryCopies.state, filters.state as typeof libraryCopies.$inferSelect.state));
  if (filters.branchId) where.push(eq(libraryCopies.branchId, filters.branchId));
  if (filters.query?.trim()) {
    const q = `%${filters.query.trim()}%`;
    where.push(or(
      sql`${libraryCopies.accessionNumber} ilike ${q}`,
      sql`${libraryCopies.barcode} ilike ${q}`,
      sql`${libraryEditions.isbn13} ilike ${q}`,
    ) ?? sql`false`);
  }
  const rows = await db.select({
    isbn13: libraryEditions.isbn13, accessionNumber: libraryCopies.accessionNumber, barcode: libraryCopies.barcode,
    branchCode: branches.code, shelfLocation: libraryCopies.shelfLocation, condition: libraryCopies.condition,
    price: libraryCopies.price, acquiredAt: libraryCopies.acquiredAt,
  }).from(libraryCopies)
    .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
    .innerJoin(branches, eq(libraryCopies.branchId, branches.id))
    .where(and(...where))
    .orderBy(asc(libraryCopies.accessionNumber))
    .limit(MAX_EXPORT_ROWS);

  const header = CSV_HEADERS.map(h => escapeCsvCell(h)).join(',');
  const lines = rows.map(r => [
    r.isbn13 ?? '', r.accessionNumber, r.barcode ?? '', r.branchCode, r.shelfLocation ?? '',
    r.condition, r.price ?? '', r.acquiredAt ?? '',
  ].map(v => escapeCsvCell(sanitizeCell(v))).join(','));
  return { csv: [header, ...lines].join('\n'), count: rows.length };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportRowResult = {
  row: number;
  accessionNumber: string;
  ok: boolean;
  action: 'create' | 'update' | 'skip' | 'error';
  errors: string[];
};

export type ImportSummary = {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
};

function normalizeHeader(headers: string[]): boolean {
  if (headers.length !== CSV_HEADERS.length) return false;
  return headers.every((h, idx) => h.trim().toLowerCase() === CSV_HEADERS[idx]);
}

export async function importCopiesCsv(tenantId: string, input: { text: string; dryRun?: boolean }): Promise<ImportSummary> {
  const dryRun = input.dryRun ?? false;
  const text = input.text.replace(/^﻿/, '');
  const parsed = parseCsv(text);
  if (parsed.length === 0) throw new ApiError(422, 'INVALID_HEADER', 'Fichier vide.');
  const [rawHeaders, ...dataRows] = parsed;
  if (!rawHeaders || !normalizeHeader(rawHeaders)) {
    throw new ApiError(422, 'INVALID_HEADER', `En-têtes attendus : ${CSV_HEADERS.join(', ')}.`);
  }

  return db.transaction(async tx => {
    const editions = await tx.select({ id: libraryEditions.id, isbn13: libraryEditions.isbn13, isbn10: libraryEditions.isbn10 })
      .from(libraryEditions).where(eq(libraryEditions.tenantId, tenantId));
    const byIsbn13 = new Map<string, string>();
    const byIsbn10 = new Map<string, string>();
    for (const e of editions) {
      if (e.isbn13) byIsbn13.set(e.isbn13, e.id);
      if (e.isbn10) byIsbn10.set(e.isbn10, e.id);
    }

    const branchRows = await tx.select({ id: branches.id, code: branches.code }).from(branches).where(eq(branches.tenantId, tenantId));
    const branchByCode = new Map(branchRows.map(b => [b.code, b.id]));

    // Pre-resolve every row before touching existing copies so the batch is
    // validated once, dry-run included.
    const resolved: Array<{
      row: number;
      accessionNumber: string;
      editionId: string;
      branchId: string;
      barcode: string | null;
      shelfLocation: string | null;
      condition: typeof libraryCopies.$inferSelect.condition;
      price: string | null;
      acquiredAt: string | null;
      errors: string[];
    }> = [];

    const seenAccessions = new Set<string>();
    const seenBarcodes = new Set<string>();

    for (const [idx, cells] of dataRows.entries()) {
      const rowNumber = idx + 2; // 1 = header
      const errors: string[] = [];
      if (cells.length > CSV_HEADERS.length) errors.push('Trop de colonnes.');
      const col = (name: string): string => {
        const position = CSV_HEADERS.indexOf(name as (typeof CSV_HEADERS)[number]);
        return position >= 0 ? (cells[position] ?? '') : '';
      };
      const rawIsbn = desanitizeCell(col('isbn13')).trim();
      const accessionNumber = desanitizeCell(col('accession_number')).trim();
      const rawBarcode = desanitizeCell(col('barcode')).trim();
      const rawBranch = desanitizeCell(col('branch_code')).trim();
      const rawShelf = desanitizeCell(col('shelf_location')).trim();
      const rawCondition = desanitizeCell(col('condition')).trim();
      const rawPrice = desanitizeCell(col('price')).trim();
      const rawAcquired = desanitizeCell(col('acquired_at')).trim();

      if (!accessionNumber) errors.push('Numéro d’inventaire requis.');
      else if (accessionNumber.length > 50) errors.push('Numéro d’inventaire trop long (max 50).');
      else if (seenAccessions.has(accessionNumber)) errors.push('Numéro d’inventaire dupliqué dans le fichier.');
      else seenAccessions.add(accessionNumber);

      const barcode = rawBarcode.length > 0 ? rawBarcode : null;
      if (barcode) {
        if (barcode.length > 50) errors.push('Code-barres trop long (max 50).');
        else if (seenBarcodes.has(barcode)) errors.push('Code-barres dupliqué dans le fichier.');
        else seenBarcodes.add(barcode);
      }

      let editionId = '';
      if (!rawIsbn) errors.push('ISBN requis pour retrouver l’édition.');
      else {
        const isbn = rawIsbn.replace(/[\s-]/g, '');
        if (ISBN13_RE.test(isbn)) editionId = byIsbn13.get(isbn) ?? '';
        else if (ISBN10_RE.test(isbn)) editionId = byIsbn10.get(isbn) ?? '';
        else errors.push('ISBN invalide.');
        if (!editionId && errors.length === 0) errors.push('Aucune édition trouvée pour cet ISBN.');
      }

      let branchId = '';
      if (!rawBranch) errors.push('Code succursale requis.');
      else {
        branchId = branchByCode.get(rawBranch) ?? '';
        if (!branchId) errors.push(`Succursale « ${rawBranch} » introuvable.`);
      }

      let condition: typeof libraryCopies.$inferSelect.condition = 'good';
      if (rawCondition) {
        if (COPY_CONDITIONS.has(rawCondition)) condition = rawCondition as typeof libraryCopies.$inferSelect.condition;
        else errors.push(`État « ${rawCondition} » invalide (new/good/fair/poor/damaged).`);
      }

      let price: string | null = null;
      if (rawPrice) {
        if (PRICE_RE.test(rawPrice)) price = rawPrice;
        else errors.push('Prix invalide (format 0.00).');
      }

      let acquiredAt: string | null = null;
      if (rawAcquired) {
        if (DATE_RE.test(rawAcquired)) acquiredAt = rawAcquired;
        else errors.push('Date invalide (format AAAA-MM-JJ).');
      }

      let shelfLocation: string | null = null;
      if (rawShelf.length > 0) {
        if (rawShelf.length <= 100) shelfLocation = rawShelf;
        else errors.push('Emplacement trop long (max 100).');
      }

      resolved.push({ row: rowNumber, accessionNumber, editionId, branchId, barcode, shelfLocation, condition, price, acquiredAt, errors });
    }

    const valid = resolved.filter(r => r.errors.length === 0);
    const accessions = valid.map(r => r.accessionNumber);
    const barcodes = valid.map(r => r.barcode).filter((b): b is string => b !== null);

    const existingByAccession = new Map<string, typeof libraryCopies.$inferSelect>();
    if (accessions.length > 0) {
      const rows = await tx.select().from(libraryCopies)
        .where(and(eq(libraryCopies.tenantId, tenantId), inArray(libraryCopies.accessionNumber, accessions)));
      for (const c of rows) existingByAccession.set(c.accessionNumber, c);
    }
    const copyIdByBarcode = new Map<string, string>();
    if (barcodes.length > 0) {
      const rows = await tx.select({ id: libraryCopies.id, barcode: libraryCopies.barcode }).from(libraryCopies)
        .where(and(eq(libraryCopies.tenantId, tenantId), inArray(libraryCopies.barcode, barcodes)));
      for (const c of rows) if (c.barcode) copyIdByBarcode.set(c.barcode, c.id);
    }

    const results: ImportRowResult[] = [];
    const upserts: typeof valid = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of resolved) {
      if (r.errors.length > 0) {
        results.push({ row: r.row, accessionNumber: r.accessionNumber, ok: false, action: 'error', errors: r.errors });
        failed += 1;
        continue;
      }
      const existing = existingByAccession.get(r.accessionNumber);
      if (existing) {
        if (existing.editionId !== r.editionId || existing.branchId !== r.branchId) {
          results.push({ row: r.row, accessionNumber: r.accessionNumber, ok: false, action: 'error', errors: ['L’exemplaire existe avec une autre édition ou succursale.'] });
          failed += 1;
          continue;
        }
        if (r.barcode && copyIdByBarcode.get(r.barcode) && copyIdByBarcode.get(r.barcode) !== existing.id) {
          results.push({ row: r.row, accessionNumber: r.accessionNumber, ok: false, action: 'error', errors: ['Ce code-barres appartient déjà à un autre exemplaire.'] });
          failed += 1;
          continue;
        }
        const changed = r.barcode !== existing.barcode || r.shelfLocation !== existing.shelfLocation || r.condition !== existing.condition || r.price !== existing.price || r.acquiredAt !== existing.acquiredAt;
        if (changed) {
          results.push({ row: r.row, accessionNumber: r.accessionNumber, ok: true, action: 'update', errors: [] });
          upserts.push(r); updated += 1;
        } else {
          results.push({ row: r.row, accessionNumber: r.accessionNumber, ok: true, action: 'skip', errors: [] });
          skipped += 1;
        }
      } else {
        if (r.barcode && copyIdByBarcode.get(r.barcode)) {
          results.push({ row: r.row, accessionNumber: r.accessionNumber, ok: false, action: 'error', errors: ['Ce code-barres appartient déjà à un autre exemplaire.'] });
          failed += 1;
          continue;
        }
        results.push({ row: r.row, accessionNumber: r.accessionNumber, ok: true, action: 'create', errors: [] });
        upserts.push(r); created += 1;
      }
    }

    if (!dryRun && upserts.length > 0) {
      for (const r of upserts) {
        await tx.insert(libraryCopies).values({
          tenantId, editionId: r.editionId, branchId: r.branchId, accessionNumber: r.accessionNumber,
          barcode: r.barcode, shelfLocation: r.shelfLocation, condition: r.condition, price: r.price, acquiredAt: r.acquiredAt,
        }).onConflictDoUpdate({
          target: [libraryCopies.tenantId, libraryCopies.accessionNumber],
          set: { barcode: r.barcode, shelfLocation: r.shelfLocation, condition: r.condition, price: r.price, acquiredAt: r.acquiredAt, updatedAt: new Date().toISOString() },
        });
      }
    }

    return { dryRun, total: resolved.length, created, updated, skipped, errors: failed, rows: results };
  });
}
