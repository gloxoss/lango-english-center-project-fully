import { PDFDocument } from '@pdfme/pdf-lib';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_DEFAULTS, documentDesignSchema, type DocumentModel } from '../contracts';
import { renderSchoolPdf } from './pdf-renderer';

const model: DocumentModel = {
  kind: 'invoice', title: 'Facture', reference: 'INV-2026-001', filename: 'invoice.pdf',
  school: { name: 'École Atlas المدرسة' },
  details: [{ label: 'Élève', value: 'سارة Bennani' }],
  columns: [{ key: 'description', label: 'Description' }, { key: 'amount', label: 'Montant', numeric: true }],
  rows: [{ description: 'Frais scolaires', amount: '100,00 MAD' }],
  totals: [{ label: 'Total net', value: '100,00 MAD', strong: true }],
};

describe('school PDFs', () => {
  it('renders a real A4 document with mixed Latin and Arabic text', async () => {
    const bytes = await renderSchoolPdf(model, DOCUMENT_DEFAULTS.invoice);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28, 0);
  });

  it('uses A5 for receipts and flows long tables onto more pages', async () => {
    const receipt = await renderSchoolPdf({ ...model, kind: 'receipt', rows: Array.from({ length: 90 }, (_, index) => ({ description: `Ligne ${index + 1}`, amount: '100,00 MAD' })) }, DOCUMENT_DEFAULTS.receipt);
    const pdf = await PDFDocument.load(receipt);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(419.53, 0);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it('rejects repeated sections and unknown template fields', () => {
    expect(documentDesignSchema.safeParse({ ...DOCUMENT_DEFAULTS.invoice, sectionOrder: ['identity', 'identity', 'lines', 'totals', 'footer'] }).success).toBe(false);
    expect(documentDesignSchema.safeParse({ ...DOCUMENT_DEFAULTS.invoice, arbitraryCss: 'display:none' }).success).toBe(false);
  });
});
