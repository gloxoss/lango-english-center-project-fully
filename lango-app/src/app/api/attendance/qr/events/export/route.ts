import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { queryScanEvents } from '@/libs/attendance/qr-events';
import { PdfExporter } from '@/addons/advanced-reporting/services/exporters/pdf-exporter';
import type { ColumnDefinition } from '@/addons/advanced-reporting/types/reporting-types';

function csvEscape(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function parseFilters(searchParams: URLSearchParams) {
  return {
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    classSectionId: searchParams.get('classSectionId') || undefined,
    studentName: searchParams.get('studentName') || undefined,
    deviceId: searchParams.get('deviceId') || undefined,
    operatorId: searchParams.get('operatorId') || undefined,
    resultStatus: searchParams.get('resultStatus') || undefined,
    rejectionReason: searchParams.get('rejectionReason') || undefined,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.read');

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    const { events } = await queryScanEvents(tenantId, {
      ...parseFilters(searchParams),
      limit: 5000,
    });

    const rows = events.map(e => ({
      timestamp: e.scannedAt,
      result: e.resultStatus,
      stagedStatus: e.stagedStatus ?? '',
      rejectionReason: e.rejectionReason ?? '',
      student: e.studentName ?? e.studentId ?? '',
      className: e.className ?? '',
      sectionName: e.sectionName ?? '',
      device: e.deviceLabel ?? '',
      operator: e.operatorName ?? '',
    }));

    if (format === 'pdf') {
      const columns: ColumnDefinition[] = [
        { key: 'timestamp', label: 'Horodatage', type: 'datetime' },
        { key: 'result', label: 'Résultat', type: 'string' },
        { key: 'stagedStatus', label: 'Staged', type: 'string' },
        { key: 'rejectionReason', label: 'Raison rejet', type: 'string' },
        { key: 'student', label: 'Élève', type: 'string' },
        { key: 'className', label: 'Classe', type: 'string' },
        { key: 'sectionName', label: 'Section', type: 'string' },
        { key: 'device', label: 'Dispositif', type: 'string' },
        { key: 'operator', label: 'Opérateur', type: 'string' },
      ];
      const buffer = await PdfExporter.generatePdfBuffer('Rapport de scans QR', columns, rows, context.name);

      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="qr-scan-audit-${Date.now()}.pdf"`,
        },
      });
    }

    const header = 'Horodatage,Résultat,Staged,Raison rejet,Élève,Classe,Section,Dispositif,Opérateur\n';
    const csv = header + rows.map(r => [
      csvEscape(r.timestamp),
      csvEscape(r.result),
      csvEscape(r.stagedStatus),
      csvEscape(r.rejectionReason),
      csvEscape(r.student),
      csvEscape(r.className),
      csvEscape(r.sectionName),
      csvEscape(r.device),
      csvEscape(r.operator),
    ].join(',')).join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qr-scan-audit-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
