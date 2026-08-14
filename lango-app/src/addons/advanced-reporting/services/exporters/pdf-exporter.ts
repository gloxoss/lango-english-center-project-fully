import PDFDocument from 'pdfkit';
import type { ColumnDefinition } from '../../types/reporting-types';

export class PdfExporter {
  /**
   * Generates a real PDF (via pdfkit) as a Buffer: title, generated-at
   * timestamp, and a paginated data table. Replaces the previous
   * implementation, which produced an HTML string served with a .pdf
   * filename - not a real PDF.
   */
  static generatePdfBuffer(title: string, columns: ColumnDefinition[], rows: Record<string, any>[], generatedBy: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: rows.length && columns.length > 5 ? 'landscape' : 'portrait' });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(16).text(title, { align: 'center' });
      doc.font('Helvetica').fontSize(9).text(`Généré le ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });
      doc.moveDown(1);

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colWidth = usableWidth / Math.max(columns.length, 1);
      let y = doc.y;

      const drawHeaderRow = () => {
        doc.font('Helvetica-Bold').fontSize(8);
        columns.forEach((col, i) => {
          doc.text(col.label, doc.page.margins.left + i * colWidth, y, { width: colWidth - 4 });
        });
        y += 16;
        doc.font('Helvetica').fontSize(8);
      };

      drawHeaderRow();

      for (const row of rows) {
        if (y > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeaderRow();
        }
        columns.forEach((col, i) => {
          doc.text(String(row[col.key] ?? ''), doc.page.margins.left + i * colWidth, y, { width: colWidth - 4 });
        });
        y += 14;
      }

      if (rows.length === 0) {
        doc.fontSize(9).text('Aucune donnée pour ce rapport.', { align: 'center' });
      }

      doc.end();
    });
  }
}
