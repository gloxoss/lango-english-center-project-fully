import { NextResponse } from 'next/server';
import { GET as getAnalytics } from '@/app/api/analytics/route';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireLeadershipScope } from '@/features/leadership/services/scope-service';

const METRIC_DEFINITIONS = {
  enrollment: 'Active tenant users whose role is student.',
  attendance: 'Present attendance rows divided by all marked attendance rows in the trailing 30-day window.',
  collections: 'Recorded payments divided by non-cancelled invoiced net amount.',
  academicAverage: 'Average final percentage across recorded assessment results.',
  workforcePresence: 'Present staff attendance rows divided by all marked staff attendance rows in the trailing 30-day window.',
  alerts: 'Open attendance flags, overdue invoices, and currently locked accounts, reported separately by source.',
} as const;

/**
 * Purpose-limited facade over the existing tenant-scoped analytics projection.
 * The delegated handler enforces session, role, capability, and tenant scope.
 */
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const scope = await requireLeadershipScope(context);
    if (scope.type !== 'tenant') {
      throw new ApiError(403, 'SCOPED_PROJECTION_NOT_AVAILABLE', 'La projection limitée à ce périmètre est en cours de configuration.');
    }

    const response = await getAnalytics(request);
    if (!response.ok) return response;

    const payload = await response.json();
    const data = payload?.data;
    if (!data) return response;

    return NextResponse.json({
      ...payload,
      data: {
        ...data,
        meta: {
          generatedAt: new Date().toISOString(),
          freshness: 'live',
          scope,
          coverage: {
            attendance: data.attendanceRate30d == null ? 'insufficient' : 'available',
            academics: data.averageGrade == null ? 'insufficient' : 'available',
            workforce: data.staffPresenceRate == null ? 'insufficient' : 'available',
            finance: data.finance?.invoicedTotal > 0 ? 'available' : 'insufficient',
          },
          definitions: METRIC_DEFINITIONS,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
