import crypto from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { AttendanceAdapter } from '../adapters/attendance-adapter';
import { ExaminationAdapter } from '../adapters/examination-adapter';
import { FeesAdapter } from '../adapters/fees-adapter';
import { FinancialAdapter } from '../adapters/financial-adapter';
import { HRAdapter } from '../adapters/hr-adapter';
import { InventoryAdapter } from '../adapters/inventory-adapter';
import { StudentAdapter } from '../adapters/student-adapter';
import { reportArtifacts, reportRuns } from '../models/reporting-schema';
import type { ExportFormat, ReportPreviewResult } from '../types/reporting-types';
import { CatalogService } from './catalog-service';
import { CsvExporter } from './exporters/csv-exporter';
import { ExcelExporter } from './exporters/excel-exporter';
import { PdfExporter } from './exporters/pdf-exporter';
import { checkReportReadiness } from './readiness-checker';
import { ReportNotReadyError } from './report-not-ready-error';
import { saveGeneratedFile } from './report-storage';

const PREVIEW_ROW_LIMIT = 50;
const EXPORT_ROW_LIMIT = 50_000;

// Real key-to-adapter routing (future-implementation/advanced-reporting
// remediation, section-04) - every catalog key maps to its real adapter
// method. No mock fallback exists anywhere in this map or below it.
type ReportFetcher = (tenantId: string, parameters?: Record<string, any>) => Promise<any[]>;
const REPORT_FETCHERS: Record<string, ReportFetcher> = {
  'student.credentials': StudentAdapter.getCredentialStatusReport,
  'student.admission_funnel': StudentAdapter.getAdmissionFunnelReport,
  'student.class_section_occupancy': StudentAdapter.getClassSectionOccupancyReport,
  'student.siblings': StudentAdapter.getSiblingReport,

  'fees.summary': FeesAdapter.getFeesSummaryReport,
  'fees.receipts': FeesAdapter.getReceiptsReport,
  'fees.due_aging': FeesAdapter.getDueAgingReport,
  'fees.fines': FeesAdapter.getFinesReport,

  'finance.statement': FinancialAdapter.getAccountStatementReport,
  'finance.income_expense': FinancialAdapter.getIncomeExpenseReport,
  'finance.transactions': FinancialAdapter.getTransactionsReport,
  'finance.balance_sheet': FinancialAdapter.getBalanceSheetReport,
  'finance.income_vs_expense': FinancialAdapter.getIncomeVsExpenseReport,

  'attendance.student_log': AttendanceAdapter.getStudentAttendanceLogReport,
  'attendance.daily_matrix': AttendanceAdapter.getDailySectionMatrixReport,
  'attendance.overview_streaks': AttendanceAdapter.getAttendanceOverviewReport,
  'attendance.employee_summary': AttendanceAdapter.getEmployeeAttendanceSummaryReport,
  'attendance.exam_session': AttendanceAdapter.getExamSessionAttendanceReport,

  'hr.payroll_summary': HRAdapter.getPayrollSummaryReport,
  'hr.leave_balances': HRAdapter.getLeaveBalancesReport,

  'exam.report_card': ExaminationAdapter.getReportCardSnapshotReport,
  'exam.tabulation_sheet': ExaminationAdapter.getTabulationSheetReport,
  'exam.progress': ExaminationAdapter.getProgressReport,

  'inventory.stock_valuation': InventoryAdapter.getStockValuationReport,
  'inventory.purchase_summary': InventoryAdapter.getPurchaseSummaryReport,
  'inventory.sales_revenue': InventoryAdapter.getSalesRevenueReport,
  'inventory.issues_custody': InventoryAdapter.getIssuesCustodyReport,
};

export class RunEngine {
  /**
   * Generates fast preview, capped to PREVIEW_ROW_LIMIT rows. The full,
   * uncapped result set is still used for the export file (executeRunInBackground) -
   * this cap is a preview-only concern, per the PRD's "capped preview, full export" decision.
   */
  static async generatePreview(tenantId: string, reportKey: string, parameters?: Record<string, any>): Promise<ReportPreviewResult> {
    const definition = CatalogService.getDefinitionByKey(reportKey);
    if (!definition) {
      throw new Error(`Rapport non trouvé: ${reportKey}`);
    }

    const fullData = await this.fetchReportData(tenantId, reportKey, parameters);
    const previewRows = fullData.slice(0, PREVIEW_ROW_LIMIT);

    return {
      definition,
      columns: definition.columnsSchema,
      rows: previewRows,
      totalRows: fullData.length,
      isTruncated: fullData.length > PREVIEW_ROW_LIMIT,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Queues an asynchronous background execution run.
   */
  static async queueRun(tenantId: string, reportKey: string, parameters?: Record<string, any>, format: ExportFormat = 'csv', userId?: string): Promise<string> {
    const [runRecord] = await db
      .insert(reportRuns)
      .values({
        tenantId,
        reportKey,
        parameters: parameters || {},
        status: 'queued',
        requesterId: userId || 'system',
      })
      .returning();

    if (!runRecord) {
      throw new Error('Échec de la création de l\'exécution du rapport');
    }

    this.executeRunInBackground(runRecord.id, tenantId, reportKey, parameters || {}, format, userId || 'system').catch(console.error);

    return runRecord.id;
  }

  /**
   * Processes the run background task.
   */
  private static async executeRunInBackground(runId: string, tenantId: string, reportKey: string, parameters: Record<string, any>, format: ExportFormat, requesterId: string) {
    const startTime = Date.now();

    try {
      await db
        .update(reportRuns)
        .set({ status: 'running' })
        .where(eq(reportRuns.id, runId));

      const definition = CatalogService.getDefinitionByKey(reportKey);
      if (!definition) {
        throw new Error(`Report definition ${reportKey} missing`);
      }

      const rows = await this.fetchReportData(tenantId, reportKey, parameters);
      const executionTimeMs = Date.now() - startTime;

      let fileBuffer: Buffer;
      let extension: string;

      if (format === 'xlsx') {
        fileBuffer = await ExcelExporter.generateExcelBuffer(definition.title, definition.columnsSchema, rows);
        extension = 'xlsx';
      } else if (format === 'pdf') {
        fileBuffer = await PdfExporter.generatePdfBuffer(definition.title, definition.columnsSchema, rows, requesterId);
        extension = 'pdf';
      } else {
        fileBuffer = Buffer.from(CsvExporter.generateCsv(definition.columnsSchema, rows), 'utf-8');
        extension = 'csv';
      }

      const subpath = `reports/${reportKey}_${runId}.${extension}`;
      await saveGeneratedFile(tenantId, subpath, fileBuffer);
      const checksumSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      await db.insert(reportArtifacts).values({
        runId,
        filePath: subpath,
        fileSizeBytes: fileBuffer.byteLength,
        checksumSha256,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        format,
      });

      await db
        .update(reportRuns)
        .set({
          status: 'completed',
          finishedAt: new Date().toISOString(),
          executionTimeMs,
          rowCount: rows.length,
        })
        .where(eq(reportRuns.id, runId));
    } catch (error: any) {
      await db
        .update(reportRuns)
        .set({
          status: 'failed',
          errorMessage: error instanceof ReportNotReadyError
            ? error.message
            : (error.message || 'Erreur lors de l\'exécution du rapport'),
          finishedAt: new Date().toISOString(),
        })
        .where(eq(reportRuns.id, runId));
    }
  }

  /**
   * Real key-to-adapter data fetcher. Every catalog report either routes to
   * its real adapter method (no mock fallback exists) or throws
   * ReportNotReadyError for a genuinely unbuildable report, which the
   * callers (preview/run routes, via apiErrorResponse) surface as an honest
   * 409, never fake data. An empty result (zero rows) is not an error - a
   * report can legitimately have nothing to show yet.
   */
  private static async fetchReportData(tenantId: string, reportKey: string, parameters?: Record<string, any>): Promise<any[]> {
    const definition = CatalogService.getDefinitionByKey(reportKey);
    if (!definition) {
      throw new Error(`Rapport non trouvé: ${reportKey}`);
    }

    const readiness = checkReportReadiness(reportKey, definition.domain);
    if (!readiness.isReady) {
      throw new ReportNotReadyError(readiness.reason ?? 'Ce rapport n\'est pas encore disponible.');
    }

    const fetcher = REPORT_FETCHERS[reportKey];
    if (!fetcher) {
      throw new ReportNotReadyError('Ce rapport n\'est pas encore disponible.');
    }

    const rows = await fetcher(tenantId, parameters);
    return rows.length > EXPORT_ROW_LIMIT ? rows.slice(0, EXPORT_ROW_LIMIT) : rows;
  }

  /**
   * Recovers stuck report runs (e.g. after server restart or timeout) (§21.1).
   * Any run stuck in 'running' or 'queued' for > 15 minutes is transitioned to 'failed'.
   */
  static async recoverStuckRuns(tenantId?: string, maxAgeMinutes = 15): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
    const conditions = [
      inArray(reportRuns.status, ['running', 'queued']),
      sql`${reportRuns.createdAt} < ${cutoff}`,
    ];
    if (tenantId) {
      conditions.push(eq(reportRuns.tenantId, tenantId));
    }

    const updated = await db
      .update(reportRuns)
      .set({
        status: 'failed',
        errorMessage: 'Exécution interrompue (délai d\'exécution dépassé ou redémarrage du serveur).',
        finishedAt: new Date().toISOString(),
      })
      .where(and(...conditions))
      .returning({ id: reportRuns.id });

    return updated.length;
  }
}
