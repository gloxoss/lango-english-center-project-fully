import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import {
  addEventAttachment,
  getEventAttachment,
  listEventAttachments,
} from '@/features/events/services/event-operations-service';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

// GET: `?file=<attachmentId>` streams the binary; the default branch lists
// the event's attachments (metadata only).
export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file');

    if (fileId) {
      const attachment = await getEventAttachment(tenantId, id, fileId);
      if (!attachment) {
        return NextResponse.json({ success: false, message: 'Pièce jointe introuvable' }, { status: 404 });
      }
      try {
        const bytes = await readUploadedFile(tenantId, attachment.fileKey);
        const ext = attachment.fileKey.split('.').pop() ?? 'pdf';
        return new NextResponse(new Uint8Array(bytes), {
          headers: {
            'Content-Type': attachment.mimeType ?? contentTypeFor(ext),
            'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.title)}"`,
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch {
        return NextResponse.json({ success: false, message: 'Pièce jointe introuvable' }, { status: 404 });
      }
    }

    const attachments = await listEventAttachments(tenantId, id);
    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title');
    const occurrenceId = formData.get('occurrenceId');

    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }
    const resolvedTitle = typeof title === 'string' && title.trim() ? title.trim() : file.name;

    const attachmentId = randomUUID();
    const ext = await saveUploadedFile(tenantId, `events/${id}/${attachmentId}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);
    const fileKey = `events/${id}/${attachmentId}.${ext}`;

    const attachment = await addEventAttachment(tenantId, id, context.userId, {
      title: resolvedTitle,
      fileKey,
      mimeType: file.type,
      sizeBytes: file.size,
      kind: file.type.startsWith('image/') ? 'image' : 'document',
      occurrenceId: typeof occurrenceId === 'string' && occurrenceId ? occurrenceId : null,
    });

    recordAudit(context, 'create', 'event_attachment', attachment.id, { eventId: id, title: resolvedTitle });
    return NextResponse.json({ success: true, data: attachment }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
