import { logger } from '@/libs/logger';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { listAddonDefinitions } from '@/libs/api/addon-catalog';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { exportJobs, files, invoices, tenants, user } from '@/models/Schema';

// GET /api/super-admin/health - real platform health & infrastructure signal.
// Everything below is measured from the live database (or, for maintenance
// mode, a real environment variable) - nothing is fabricated.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    let database = { connected: false, version: null as string | null, sizeBytes: null as number | null };
    let storage = { filesCount: 0, totalBytes: 0 };
    let backgroundJobs = { total: 0, pending: 0, processing: 0, complete: 0, failed: 0 };
    const counts = { tenants: 0, students: 0, teachers: 0, invoices: 0 };
    let featureFlags = { enabled: 0, disabled: 0, addons: [] as { id: string; name: string; enabled: boolean }[] };

    try {
      const healthRes = await db.execute(sql`select version() as version, pg_database_size(current_database()) as size_bytes`);
      const row = (healthRes.rows as { version?: string; size_bytes?: string }[])[0];
      database = {
        connected: true,
        version: row?.version ?? null,
        sizeBytes: row?.size_bytes != null ? Number(row.size_bytes) : null,
      };

      const [
        filesRow,
        jobRows,
        tenantRow,
        studentRow,
        teacherRow,
        invoiceRow,
        addons,
      ] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int`, totalBytes: sql<number>`coalesce(sum(${files.sizeBytes}), 0)::int` })
          .from(files)
          .where(eq(files.isDeleted, false)),
        db
          .select({ status: exportJobs.status, count: sql<number>`count(*)::int` })
          .from(exportJobs)
          .groupBy(exportJobs.status),
        db.select({ count: sql<number>`count(*)::int` }).from(tenants),
        db.select({ count: sql<number>`count(*)::int` }).from(user).where(eq(user.role, 'student')),
        db.select({ count: sql<number>`count(*)::int` }).from(user).where(eq(user.role, 'teacher')),
        db.select({ count: sql<number>`count(*)::int` }).from(invoices),
        listAddonDefinitions(),
      ]);

      storage = { filesCount: filesRow[0]?.count ?? 0, totalBytes: filesRow[0]?.totalBytes ?? 0 };
      for (const j of jobRows) {
        backgroundJobs.total += j.count;
        if (j.status === 'pending') backgroundJobs.pending = j.count;
        else if (j.status === 'processing') backgroundJobs.processing = j.count;
        else if (j.status === 'complete') backgroundJobs.complete = j.count;
        else if (j.status === 'failed') backgroundJobs.failed = j.count;
      }
      counts.tenants = tenantRow[0]?.count ?? 0;
      counts.students = studentRow[0]?.count ?? 0;
      counts.teachers = teacherRow[0]?.count ?? 0;
      counts.invoices = invoiceRow[0]?.count ?? 0;
      featureFlags = {
        enabled: addons.filter(a => a.enabled).length,
        disabled: addons.filter(a => !a.enabled).length,
        addons: addons.map(a => ({ id: a.id, name: a.name, enabled: a.enabled })),
      };
    } catch (err) {
      // The endpoint still answers; `database.connected` stays false and the
      // client renders the degraded state instead of throwing.
      logger.error({ err }, 'Health metrics query failed');
    }

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
        database,
        storage,
        backgroundJobs,
        counts,
        featureFlags,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
