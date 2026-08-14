import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { branches, libraryCopies, libraryEditions, tenants, user } from '@/models/Schema';
import { createCatalogRecord, createCopy, createEdition } from './library-service';
import { CSV_HEADERS, exportCopiesCsv, importCopiesCsv, parseCsv, sanitizeCell, desanitizeCell } from './library-copies-csv';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('library copies CSV import/export', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  let branchId = '';
  let adminId = '';
  const isbnA = `978${randomUUID().toString().replace(/\D/g, '').slice(0, 10)}`;
  const isbnB = `978${randomUUID().toString().replace(/\D/g, '').slice(0, 10)}`;
  let editionId = '';
  let editionBId = '';

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `CSV Test ${suffix}`, slug: `csv-test-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `CSV${suffix}` }).returning();
    branchId = branch!.id;
    adminId = `csv-admin-${suffix}`;
    await db.insert(user).values({ id: adminId, tenantId, branchId, email: `${adminId}@test.local`, name: 'CSV Admin', role: 'school_admin' });
    const recordA = await createCatalogRecord(tenantId, { title: 'CSV Book A' });
    const editionA = await createEdition(tenantId, { recordId: recordA.id, isbn13: isbnA });
    editionId = editionA.id;
    const recordB = await createCatalogRecord(tenantId, { title: 'CSV Book B' });
    const editionB = await createEdition(tenantId, { recordId: recordB.id, isbn13: isbnB });
    editionBId = editionB.id;
  }, 30_000);

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  const csvFor = (rows: string[][]) => [CSV_HEADERS.join(','), ...rows.map(r => r.join(','))].join('\n');

  it('exports the exact header template and sanitizes formula cells', async () => {
    await createCopy(tenantId, { editionId, branchId, accessionNumber: `EXPA-${suffix}`, barcode: '=SUM(A1)', shelfLocation: 'A-1' });
    const { csv, count } = await exportCopiesCsv(tenantId);
    expect(count).toBeGreaterThan(0);
    const [header, ...rows] = parseCsv(csv);
    expect(header).toEqual([...CSV_HEADERS]);
    const barcodeRow = rows.find(r => r[1] === `EXPA-${suffix}`);
    expect(barcodeRow).toBeDefined();
    expect(barcodeRow![2]).toBe(`'=SUM(A1)`);
    expect(desanitizeCell(barcodeRow![2] ?? '')).toBe('=SUM(A1)');
  });

  it('imports new copies and re-import is a no-op (idempotent)', async () => {
    const text = csvFor([
      [isbnA, `IMA-${suffix}`, `BARI-${suffix}`, `CSV${suffix}`, 'A-2', 'new', '25.00', '2026-01-10'],
      [isbnA, `IMB-${suffix}`, '', `CSV${suffix}`, '', 'good', '', ''],
    ]);
    const first = await importCopiesCsv(tenantId, { text });
    expect(first.errors).toBe(0);
    expect(first.created).toBe(2);
    expect(first.updated).toBe(0);
    expect(first.skipped).toBe(0);

    const again = await importCopiesCsv(tenantId, { text });
    expect(again.created).toBe(0);
    expect(again.updated).toBe(0);
    expect(again.skipped).toBe(2);
    expect(again.errors).toBe(0);

    const [rowA] = await db.select({ barcode: libraryCopies.barcode, price: libraryCopies.price, condition: libraryCopies.condition, acquiredAt: libraryCopies.acquiredAt })
      .from(libraryCopies).where(eq(libraryCopies.accessionNumber, `IMA-${suffix}`));
    expect(rowA).toMatchObject({ barcode: `BARI-${suffix}`, price: '25.00', condition: 'new', acquiredAt: '2026-01-10' });

    // An update row (changed price) is applied and then idempotent again.
    const changed = csvFor([[isbnA, `IMA-${suffix}`, `BARI-${suffix}`, `CSV${suffix}`, 'A-2', 'new', '30.00', '2026-01-10']]);
    const up = await importCopiesCsv(tenantId, { text: changed });
    expect(up.updated).toBe(1);
    const [rowA2] = await db.select({ price: libraryCopies.price }).from(libraryCopies).where(eq(libraryCopies.accessionNumber, `IMA-${suffix}`));
    expect(rowA2!.price).toBe('30.00');
  });

  it('dry-run reports the same actions without writing', async () => {
    const text = csvFor([[isbnA, `DRY-${suffix}`, '', `CSV${suffix}`, '', 'good', '', '']]);
    const dry = await importCopiesCsv(tenantId, { text, dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(dry.created).toBe(1);
    expect(dry.rows[0]!.action).toBe('create');
    const existing = await db.select({ n: libraryCopies.accessionNumber }).from(libraryCopies).where(eq(libraryCopies.accessionNumber, `DRY-${suffix}`));
    expect(existing).toHaveLength(0);
  });

  it('rejects malformed CSV, missing headers, and row-level bad references', async () => {
    await expect(importCopiesCsv(tenantId, { text: `${CSV_HEADERS.join(',')}\n"unterminated,field` })).rejects.toMatchObject({ code: 'MALFORMED_CSV' });
    await expect(importCopiesCsv(tenantId, { text: 'wrong,headers\n1,2' })).rejects.toMatchObject({ code: 'INVALID_HEADER' });

    const result = await importCopiesCsv(tenantId, { text: csvFor([
      ['9999999999999', `BAD-${suffix}`, '', `CSV${suffix}`, '', 'good', '', ''], // unknown ISBN
      [isbnA, `BAD2-${suffix}`, '', `NOPE${suffix}`, '', 'good', '', ''],        // unknown branch
      [isbnA, `BAD-${suffix}`, '', `CSV${suffix}`, '', 'good', '', ''],          // duplicate accession in file
      [isbnA, `BAD3-${suffix}`, '', `CSV${suffix}`, '', 'weird', 'x', 'not-a-date'], // bad condition/price/date
    ]) });
    expect(result.errors).toBe(4);
    expect(result.created).toBe(0);
    const rowErrors = result.rows.filter(r => !r.ok).map(r => r.errors.join('; '));
    expect(rowErrors[0]).toContain('Aucune édition');
    expect(rowErrors[1]).toContain('introuvable');
    expect(rowErrors[2]).toContain('dupliqué');
    expect(rowErrors[3]).toContain('État');
    expect(rowErrors[3]).toContain('Prix');
    expect(rowErrors[3]).toContain('Date');
  });

  it('blocks re-keying an existing copy and barcode reuse by another copy', async () => {
    const text = csvFor([
      [isbnB, `IMA-${suffix}`, '', `CSV${suffix}`, '', 'good', '', ''], // same accession, different edition
      [isbnA, `BC-${suffix}`, `BARI-${suffix}`, `CSV${suffix}`, '', 'good', '', ''], // barcode already used by IMA-*
    ]);
    const result = await importCopiesCsv(tenantId, { text });
    expect(result.errors).toBe(2);
    expect(result.rows[0]!.errors[0]).toContain('autre édition ou succursale');
    expect(result.rows[1]!.errors[0]).toContain('déjà à un autre exemplaire');
  });

  it('isolates by tenant: an edition from another tenant is not resolvable', async () => {
    const [otherTenant] = await db.insert(tenants).values({ name: `CSV Other ${suffix}`, slug: `csv-other-${suffix}` }).returning();
    try {
      const result = await importCopiesCsv(otherTenant!.id, { text: csvFor([[isbnA, `ISO-${suffix}`, '', `CSV${suffix}`, '', 'good', '', '']]), dryRun: true });
      expect(result.rows[0]!.ok).toBe(false);
      expect(result.rows[0]!.errors[0]).toContain('Aucune édition');
    } finally {
      await db.delete(tenants).where(eq(tenants.id, otherTenant!.id));
    }
  });

  it('rejects files that exceed the row or field caps', async () => {
    const many = Array.from({ length: 5100 }, (_, i) => [isbnA, `CAP-${suffix}-${i}`, '', `CSV${suffix}`, '', 'good', '', '']);
    await expect(importCopiesCsv(tenantId, { text: csvFor(many) })).rejects.toMatchObject({ code: 'CSV_TOO_LARGE' });
    await expect(importCopiesCsv(tenantId, { text: csvFor([[isbnA, `CAPX-${suffix}`, 'x'.repeat(3000), `CSV${suffix}`, '', 'good', '', '']]) })).rejects.toMatchObject({ code: 'FIELD_TOO_LONG' });
  });

  it('exports then re-imports the export with zero changes', async () => {
    const { csv } = await exportCopiesCsv(tenantId);
    const result = await importCopiesCsv(tenantId, { text: csv });
    expect(result.errors).toBe(0);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });
});
