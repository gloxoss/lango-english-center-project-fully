import { CsvExporter } from '@/addons/advanced-reporting/services/exporters/csv-exporter';
import { ExcelExporter } from '@/addons/advanced-reporting/services/exporters/excel-exporter';
import type { ColumnDefinition } from '@/addons/advanced-reporting/types/reporting-types';
import { ApiError } from '@/libs/api/errors';
import type { StudentJournalRow } from './journal-extract';

export interface ExportResult {
  kind: 'file' | 'pushed';
  format?: 'csv' | 'xlsx';
  filename?: string;
  mimeType?: string;
  buffer?: Buffer;
  message: string;
}

export interface AccountingExportAdapter {
  readonly id: string;
  readonly name: string;
  exportJournal(tenantId: string, rows: StudentJournalRow[]): Promise<ExportResult>;
}

const COLUMNS: ColumnDefinition[] = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'type', label: 'Type', type: 'string' },
  { key: 'reference', label: 'Référence', type: 'string' },
  { key: 'studentId', label: 'Élève', type: 'string' },
  { key: 'amount', label: 'Montant', type: 'currency' },
  { key: 'direction', label: 'Sens', type: 'string' },
  { key: 'currency', label: 'Devise', type: 'string' },
];

const stamp = () => new Date().toISOString().slice(0, 10);

class CsvAdapter implements AccountingExportAdapter {
  readonly id = 'csv';
  readonly name = 'Extraction CSV';
  async exportJournal(_tenantId: string, rows: StudentJournalRow[]): Promise<ExportResult> {
    const csv = CsvExporter.generateCsv(COLUMNS, rows as unknown as Record<string, any>[]);
    return {
      kind: 'file',
      format: 'csv',
      filename: `journal-${stamp()}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf-8'),
      message: 'Journal exporté en CSV.',
    };
  }
}

class XlsxAdapter implements AccountingExportAdapter {
  readonly id = 'xlsx';
  readonly name = 'Classeur Excel';
  async exportJournal(_tenantId: string, rows: StudentJournalRow[]): Promise<ExportResult> {
    const buffer = await ExcelExporter.generateExcelBuffer('Journal', COLUMNS, rows as unknown as Record<string, any>[]);
    return {
      kind: 'file',
      format: 'xlsx',
      filename: `journal-${stamp()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
      message: 'Journal exporté en XLSX.',
    };
  }
}

class DammancomAdapter implements AccountingExportAdapter {
  readonly id = 'dammancom';
  readonly name = 'DAMANCOM/INP';
  async exportJournal(): Promise<ExportResult> {
    // TODO(L — DAMANCOM/INP export): blocked on the exact Moroccan filing-format
    // spec (DGI INP / DAMANCOM). Inputs required from the accountant/DGI:
    //   - field layout (INP format: fixed-width or delimited?), column order,
    //     mandatory codes (DGI form codes, identifiant fiscal, N° article),
    //   - file encoding (ISO-8859-1 / UTF-8) + line endings + file-naming rule,
    //   - whether it is a single combined file or per-document-type (factures /
    //     règlements / avoirs) and the submission channel (upload portal vs SFTP).
    // Implement `exportJournal` to emit the compliant file (or push payload) once
    // the spec is confirmed; map rows → DGI codes via certified mappings (Phase M).
    throw new ApiError(501, 'ERP_NOT_IMPLEMENTED', 'Le connecteur DAMANCOM/INP est en attente de spécification.');
  }
}

class SageAdapter implements AccountingExportAdapter {
  readonly id = 'sage';
  readonly name = 'Sage';
  async exportJournal(): Promise<ExportResult> {
    // TODO(J — Sage export): blocked on the target Sage product + import format.
    // Inputs required (pick one target first):
    //   - Sage 100 / Sage Business Cloud / Sage Compta locale, and its journal
    //     import format (CSV template, .csv/.imp column map) or API (Business Cloud);
    //   - account-code mapping: tenant PCG account → Sage plan comptable code,
    //     journal code + currency = tenant base currency.
    // Implement `exportJournal` to emit the mapped journal in the target's format
    // (or push via API) once the spec is confirmed; validate against a Sage sample.
    throw new ApiError(501, 'ERP_NOT_IMPLEMENTED', 'Le connecteur Sage est en attente de spécification.');
  }
}

const adapters = new Map<string, AccountingExportAdapter>();
for (const a of [new CsvAdapter(), new XlsxAdapter(), new DammancomAdapter(), new SageAdapter()]) {
  adapters.set(a.id, a);
}

export function getAccountingExportAdapter(id: string): AccountingExportAdapter | null {
  return adapters.get(id) ?? null;
}
