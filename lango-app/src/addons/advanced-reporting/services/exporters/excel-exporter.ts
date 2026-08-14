import ExcelJS from 'exceljs';
import type { ColumnDefinition } from '../../types/reporting-types';
import { CsvExporter } from './csv-exporter';

const NUMERIC_TYPES = new Set(['number', 'currency', 'percentage']);

export class ExcelExporter {
  /**
   * Generates a real .xlsx workbook (via exceljs) as a Buffer: header row,
   * one data row per record, and a totals row summing numeric columns.
   * Every cell value is run through CsvExporter.sanitizeValue first - the
   * same formula-injection defense already proven for CSV applies equally
   * here, since Excel/LibreOffice interpret a leading =, +, -, or @ as a
   * formula regardless of file format.
   */
  static async generateExcelBuffer(title: string, columns: ColumnDefinition[], rows: Record<string, any>[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title.slice(0, 31) || 'Report');

    const headerRow = sheet.addRow(columns.map(c => c.label));
    headerRow.font = { bold: true };

    for (const row of rows) {
      const values = columns.map((c) => {
        const sanitized = CsvExporter.sanitizeValue(row[c.key]);
        return NUMERIC_TYPES.has(c.type) && !Number.isNaN(Number(row[c.key])) ? Number(row[c.key]) : sanitized;
      });
      sheet.addRow(values);
    }

    const totals = columns.map((c, i) => {
      if (i === 0) {
        return 'Total';
      }
      if (!NUMERIC_TYPES.has(c.type)) {
        return '';
      }
      const sum = rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
      return sum;
    });
    const totalsRow = sheet.addRow(totals);
    totalsRow.font = { bold: true };

    sheet.columns.forEach((col) => {
      col.width = 20;
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
