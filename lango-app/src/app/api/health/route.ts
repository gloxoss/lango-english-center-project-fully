import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { logger } from '@/libs/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  try {
    // Probe database connectivity with a lightweight ping
    await db.execute(sql`SELECT 1`);

    return NextResponse.json(
      {
        status: 'healthy',
        database: 'reachable',
        uptime,
        timestamp,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error({ err: error }, '[Health Check] Database probe failed');

    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'unreachable',
        uptime,
        timestamp,
      },
      { status: 503 },
    );
  }
}
