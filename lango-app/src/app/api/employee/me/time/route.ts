import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { workforcePunchEvents } from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

function minutesBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, Math.round((e - s) / 60000));
}

// GET /api/employee/me/time
// Own punch history plus derived work sessions (paired in/out events).
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId);

    const punches = await db
      .select({
        id: workforcePunchEvents.id,
        punchType: workforcePunchEvents.punchType,
        scannedAt: workforcePunchEvents.scannedAt,
        notes: workforcePunchEvents.notes,
      })
      .from(workforcePunchEvents)
      .where(and(eq(workforcePunchEvents.tenantId, tenantId), eq(workforcePunchEvents.employeeId, ctx.userId)))
      .orderBy(asc(workforcePunchEvents.scannedAt));

    // Pair consecutive in -> out events into work sessions.
    const sessions: Array<{ in: string; out: string; durationMinutes: number }> = [];
    let openStart: string | null = null;

    for (const punch of punches) {
      if (punch.punchType === 'in') {
        openStart = punch.scannedAt;
      } else if (punch.punchType === 'out' && openStart) {
        sessions.push({
          in: openStart,
          out: punch.scannedAt,
          durationMinutes: minutesBetween(openStart, punch.scannedAt),
        });
        openStart = null;
      }
    }

    const openSession = openStart ? { in: openStart } : null;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayTotalMinutes = sessions
      .filter(s => s.in.slice(0, 10) === todayStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    return NextResponse.json({
      success: true,
      data: {
        punches: punches.slice().reverse(), // newest first for display
        sessions: sessions.slice().reverse(),
        openSession,
        todayTotalMinutes,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
