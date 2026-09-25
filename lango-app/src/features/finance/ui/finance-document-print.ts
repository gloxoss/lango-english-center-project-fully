import { openDocumentPreview } from '@/features/documents/ui/pdf-preview';

// The source record is loaded and authorized again on the server before rendering.
export function printInvoiceDocument(invoice: { id: string }, _labels: unknown, locale: string): void {
  openDocumentPreview({ kind: 'invoice', sourceId: invoice.id }, locale);
}

export function printReceiptDocument(receipt: { id: string }, _labels: unknown, locale: string): void {
  openDocumentPreview({ kind: 'receipt', sourceId: receipt.id }, locale);
}

export function printStatementDocument(statement: { studentId: string; period: { startDate: string; endDate: string } }, _labels: unknown, locale: string): void {
  openDocumentPreview({ kind: 'statement', sourceId: statement.studentId, startDate: statement.period.startDate, endDate: statement.period.endDate }, locale);
}
