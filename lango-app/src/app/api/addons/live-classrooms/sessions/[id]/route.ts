import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import {
  cancelLiveSession, getSessionDetail, updateLiveSession,
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

const sessionUpdateSchema = z.object({
  providerProfileId: z.uuid().optional(),
  classOfferingId: z.uuid().nullable().optional(),
  classSectionId: z.uuid().optional(),
  classSubjectId: z.uuid().optional(),
  teacherUserId: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(4000).nullable().optional(),
  objectives: z.string().max(4000).nullable().optional(),
  scheduledStart: isoDate.optional(),
  scheduledEnd: isoDate.optional(),
  timezone: z.string().max(64).optional(),
  policy: policySchema.optional(),
  sourceTimetableSlotId: z.uuid().nullable().optional(),
  adminOverrideReason: z.string().trim().max(1000).nullable().optional(),
}).strict();

const cancelSchema = z.object({ reason: z.string().trim().max(1000).optional() }).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.read');

    const { id } = await params;
    const detail = await getSessionDetail(tenantId, id, { actorRole: context.role, actorUserId: context.userId });
    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.manage');

    const { id } = await params;
    const body = await parseJson(request, sessionUpdateSchema);
    const session = await updateLiveSession(context, tenantId, id, body);
    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.manage');

    const { id } = await params;
    const body = await parseJson(request, cancelSchema);
    const session = await cancelLiveSession(context, tenantId, id, body.reason);
    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
