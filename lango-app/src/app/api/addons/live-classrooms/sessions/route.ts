import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import {
  createLiveSession, listLiveSessions, type SessionListFilters,
} from '@/features/live-classrooms/services/session-service';

const isoDate = z.string().refine(v => !Number.isNaN(Date.parse(v)), 'Date ISO requise');

const policySchema = z.object({
  recordingEnabled: z.boolean(),
  waitingRoom: z.boolean(),
  chat: z.boolean(),
  screenShare: z.boolean(),
  guestPolicy: z.enum(['allow', 'deny']),
  maxParticipants: z.number().int().min(0).nullable().optional(),
}).strict();

const sessionCreateSchema = z.object({
  providerProfileId: z.uuid(),
  classOfferingId: z.uuid().nullable().optional(),
  classSectionId: z.uuid(),
  classSubjectId: z.uuid(),
  teacherUserId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(4000).nullable().optional(),
  objectives: z.string().max(4000).nullable().optional(),
  scheduledStart: isoDate,
  scheduledEnd: isoDate,
  timezone: z.string().max(64).optional(),
  policy: policySchema,
  sourceTimetableSlotId: z.uuid().nullable().optional(),
  adminOverrideReason: z.string().trim().max(1000).nullable().optional(),
  createAsDraft: z.boolean().optional(),
}).strict();

function intParam(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.read');

    const url = new URL(request.url);
    const filters: SessionListFilters = {
      status: url.searchParams.get('status') ?? undefined,
      teacherUserId: url.searchParams.get('teacherUserId') ?? undefined,
      classSectionId: url.searchParams.get('classSectionId') ?? undefined,
      classSubjectId: url.searchParams.get('classSubjectId') ?? undefined,
      providerProfileId: url.searchParams.get('providerProfileId') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      page: intParam(url.searchParams.get('page'), 1, 1, 100000),
      pageSize: intParam(url.searchParams.get('pageSize'), 50, 1, 100),
    };

    // Audience restriction: a teacher may only browse their own sessions.
    if (context.role === 'teacher') {
      filters.teacherUserId = context.userId;
    }

    const result = await listLiveSessions(tenantId, filters);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.manage');

    const body = await parseJson(request, sessionCreateSchema);
    const session = await createLiveSession(context, tenantId, body);
    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
