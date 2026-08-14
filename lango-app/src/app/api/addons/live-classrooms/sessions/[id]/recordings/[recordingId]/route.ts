import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { deleteRecording, setRecordingRetention } from '@/features/live-classrooms/services/recording-service';

const retentionSchema = z.object({
  retentionDays: z.number().int().min(0).max(3650).nullable(),
}).strict();

type RouteContext = { params: Promise<{ id: string; recordingId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.recordings.manage');

    const { id, recordingId } = await params;
    const body = await parseJson(request, retentionSchema);
    const recording = await setRecordingRetention(context, tenantId, id, recordingId, body.retentionDays);
    return NextResponse.json({ success: true, data: recording });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.recordings.manage');

    const { id, recordingId } = await params;
    const recording = await deleteRecording(context, tenantId, id, recordingId);
    return NextResponse.json({ success: true, data: recording });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
