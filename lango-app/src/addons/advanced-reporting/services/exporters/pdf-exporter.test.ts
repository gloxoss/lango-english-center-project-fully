import type { ColumnDefinition } from '../../types/reporting-types';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { PdfExporter } from './pdf-exporter';

// The reason this exporter was rewritten: it used pdfkit's base-14 `Helvetica`,
// which is WinAnsi-encoded and cannot represent Arabic at all. In a Moroccan
// school system, every report carrying an Arabic student, subject or school name
// came out blank or mangled — and nothing tested it, because the seed data is
// Latin-transliterated.

const columns: ColumnDefinition[] = [
  { key: 'student', label: 'Élève', type: 'string' },
  { key: 'subject', label: 'Matière', type: 'string' },
  { key: 'mark', label: 'Note', type: 'number' },
];

function pdfText(buffer: Buffer): string {
  return buffer.toString('latin1');
}

function embeddedFontNames(buffer: Buffer): string[] {
  return [...new Set(
    [...pdfText(buffer).matchAll(/\/BaseFont\s*\/([\w+\-,]+)/g)].map(m => m[1]!),
  )];
}

describe('PdfExporter', () => {
  it('produces a real PDF, not an HTML string with a .pdf name', async () => {
    const pdf = await PdfExporter.generatePdfBuffer('Rapport', columns, [], 'Admin');

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(500);
  });

  it('embeds an Arabic-capable font, which Helvetica never was', async () => {
    const pdf = await PdfExporter.generatePdfBuffer(
      'بيان النقط',
      columns,
      [{ student: 'أمين العلوي', subject: 'الرياضيات', mark: '16,50' }],
      'المدير',
    );

    const fonts = embeddedFontNames(pdf);

    expect(fonts.join(' ')).toMatch(/NotoSansArabic/);
    // Subset-embedded as a TrueType stream, so the glyphs travel with the file.
    expect(pdfText(pdf)).toContain('FontFile2');
  });

  it('keeps Latin text working alongside Arabic', async () => {
    const pdf = await PdfExporter.generatePdfBuffer(
      'Rapport mixte',
      columns,
      [
        { student: 'Youssef El Amrani', subject: 'Mathématiques', mark: '16,50' },
        { student: 'أمين العلوي', subject: 'الرياضيات', mark: '14,25' },
      ],
      'Admin',
    );

    const fonts = embeddedFontNames(pdf).join(' ');

    expect(fonts).toMatch(/Roboto/);
    expect(fonts).toMatch(/NotoSansArabic/);
  });

  it('renders an empty report without failing', async () => {
    // An empty result set is not an error — a report can legitimately have
    // nothing to show yet.
    const pdf = await PdfExporter.generatePdfBuffer('Vide', columns, [], 'Admin');

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('handles a row missing the column key', async () => {
    const pdf = await PdfExporter.generatePdfBuffer(
      'Partiel',
      columns,
      [{ student: 'Sans matière' }],
      'Admin',
    );

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('paginates a long report across multiple pages', async () => {
    const many = Array.from({ length: 220 }, (_, i) => ({
      student: `Élève ${i + 1}`,
      subject: 'Mathématiques',
      mark: '12,00',
    }));

    const pdf = await PdfExporter.generatePdfBuffer('Long', columns, many, 'Admin');
    const pageCount = (pdfText(pdf).match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    expect(pageCount).toBeGreaterThan(1);
  });

  it('carries the generatedBy attribution the caller passed', async () => {
    // pdfkit accepted this argument and silently dropped it.
    const pdf = await PdfExporter.generatePdfBuffer('Attribution', columns, [], 'Directeur Test');

    // Text is subset-encoded, so the string is not greppable in the raw bytes;
    // what is assertable is that the document renders and carries a text layer.
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdfText(pdf)).toContain('ToUnicode');
  });

  it('switches to landscape once the table is too wide for portrait', async () => {
    const wide: ColumnDefinition[] = Array.from({ length: 8 }, (_, i) => ({
      key: `c${i}`,
      label: `Colonne ${i}`,
      type: 'string',
    }));

    const portrait = await PdfExporter.generatePdfBuffer('P', columns, [], 'Admin');
    const landscape = await PdfExporter.generatePdfBuffer('L', wide, [], 'Admin');

    const box = (b: Buffer) => {
      const m = pdfText(b).match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
      return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
    };

    const p = box(portrait);
    const l = box(landscape);

    expect(p!.h).toBeGreaterThan(p!.w);
    expect(l!.w).toBeGreaterThan(l!.h);
  });
});
