import type { NextRequest } from 'next/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { platformSupportTickets, platformSupportTicketMessages, tenants, type SupportAttachment } from '@/models/Schema';

export type TenantTicket = {
  id: string;
  tenantId: string | null;
  schoolName: string;
  subject: string;
  category: 'technical' | 'billing' | 'onboarding' | 'cndp_compliance' | 'feature_request';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
  contactName: string;
  contactEmail: string;
  lastMessage: string;
  messagesCount: number;
  assignedTo: string | null;
  attachments?: SupportAttachment[] | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantTicketMessage = {
  id: string;
  ticketId: string;
  senderType: 'client' | 'super_admin';
  senderName: string;
  message: string;
  attachments?: SupportAttachment[] | null;
  createdAt: string;
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant', 'teacher', 'super_admin']);
    const tenantId = requireTenant(ctx);

    const { searchParams } = new URL(req.url);
    const ticketIdParam = searchParams.get('ticketId');

    // If specific ticket messages requested
    if (ticketIdParam) {
      const [ticket] = await db
        .select()
        .from(platformSupportTickets)
        .where(
          and(
            eq(platformSupportTickets.id, ticketIdParam),
            eq(platformSupportTickets.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!ticket) {
        throw new ApiError(404, 'NOT_FOUND', 'Demande d’assistance introuvable.');
      }

      const messages = await db
        .select()
        .from(platformSupportTicketMessages)
        .where(eq(platformSupportTicketMessages.ticketId, ticketIdParam))
        .orderBy(platformSupportTicketMessages.createdAt);

      return NextResponse.json({
        success: true,
        data: {
          ticket,
          messages,
        },
      });
    }

    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
    const categoryParam = searchParams.get('category');
    const searchParam = searchParams.get('search');

    const conditions: any[] = [eq(platformSupportTickets.tenantId, tenantId)];

    if (statusParam && statusParam !== 'all') {
      conditions.push(eq(platformSupportTickets.status, statusParam));
    }
    if (priorityParam && priorityParam !== 'all') {
      conditions.push(eq(platformSupportTickets.priority, priorityParam));
    }
    if (categoryParam && categoryParam !== 'all') {
      conditions.push(eq(platformSupportTickets.category, categoryParam));
    }
    if (searchParam && searchParam.trim()) {
      const q = `%${searchParam.trim()}%`;
      conditions.push(
        or(
          ilike(platformSupportTickets.subject, q),
          ilike(platformSupportTickets.lastMessage, q),
          ilike(platformSupportTickets.contactName, q)
        )
      );
    }

    const [tickets, statsRows] = await Promise.all([
      db
        .select()
        .from(platformSupportTickets)
        .where(and(...conditions))
        .orderBy(desc(platformSupportTickets.updatedAt)),

      db
        .select({
          total: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${platformSupportTickets.status} in ('new', 'in_progress', 'waiting_client'))::int`,
          waitingClient: sql<number>`count(*) filter (where ${platformSupportTickets.status} = 'waiting_client')::int`,
          resolved: sql<number>`count(*) filter (where ${platformSupportTickets.status} in ('resolved', 'closed'))::int`,
        })
        .from(platformSupportTickets)
        .where(eq(platformSupportTickets.tenantId, tenantId)),
    ]);

    const stats = statsRows[0] || {
      total: 0,
      open: 0,
      waitingClient: 0,
      resolved: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total: stats.total,
          open: stats.open,
          waitingClient: stats.waitingClient,
          resolved: stats.resolved,
        },
        tickets,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const postTenantTicketSchema = z.object({
  action: z.enum(['create', 'reply', 'resolve']).default('create'),
  // Create payload
  subject: z.string().min(3).max(255).optional(),
  category: z.enum(['technical', 'billing', 'onboarding', 'cndp_compliance', 'feature_request']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  initialMessage: z.string().min(2).max(4000).optional(),
  // Reply & Resolve payload
  ticketId: z.string().uuid().optional(),
  replyMessage: z.string().max(4000).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        size: z.number(),
        mimeType: z.string(),
        type: z.enum(['image', 'video', 'file']),
      })
    )
    .optional(),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant', 'teacher', 'super_admin']);
    const tenantId = requireTenant(ctx);
    const body = await parseJson(req, postTenantTicketSchema);

    // 1. Create a new support ticket from the tenant
    if (body.action === 'create') {
      if (!body.subject || !body.category || !body.initialMessage) {
        throw new ApiError(400, 'BAD_REQUEST', 'Le sujet, la catégorie et le message sont obligatoires.');
      }

      // Fetch tenant school name
      const [tenantRow] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const schoolName = tenantRow?.name || 'Établissement';
      const attachmentsList = body.attachments || [];

      const [newTicket] = await db
        .insert(platformSupportTickets)
        .values({
          tenantId,
          schoolName,
          subject: body.subject,
          category: body.category,
          priority: body.priority,
          status: 'new',
          contactName: ctx.name || 'Gestionnaire École',
          contactEmail: ctx.email,
          lastMessage: body.initialMessage,
          messagesCount: 1,
          attachments: attachmentsList,
        })
        .returning();

      if (newTicket) {
        await db.insert(platformSupportTicketMessages).values({
          ticketId: newTicket.id,
          senderType: 'client',
          senderName: ctx.name || 'Gestionnaire École',
          message: body.initialMessage,
          attachments: attachmentsList,
        });
      }

      recordAudit(ctx, 'create', 'support_ticket', newTicket?.id || 'unknown', {
        schoolName,
        subject: body.subject,
        priority: body.priority,
        category: body.category,
      });

      return NextResponse.json({
        success: true,
        data: {
          ticket: newTicket,
          message: 'Votre demande d’assistance a été enregistrée avec succès.',
        },
      });
    }

    // 2. Reply to an existing ticket
    if (body.action === 'reply') {
      const hasReplyText = Boolean(body.replyMessage && body.replyMessage.trim());
      const hasAttachments = Boolean(body.attachments && body.attachments.length > 0);

      if (!body.ticketId || (!hasReplyText && !hasAttachments)) {
        throw new ApiError(400, 'BAD_REQUEST', 'Identifiant de ticket et message ou pièce jointe requis.');
      }

      const [existingTicket] = await db
        .select()
        .from(platformSupportTickets)
        .where(
          and(
            eq(platformSupportTickets.id, body.ticketId),
            eq(platformSupportTickets.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existingTicket) {
        throw new ApiError(404, 'NOT_FOUND', 'Demande d’assistance introuvable.');
      }

      const trimmedReply = body.replyMessage?.trim() || '';
      const replyAttachments = body.attachments || [];

      const [newMsg] = await db
        .insert(platformSupportTicketMessages)
        .values({
          ticketId: body.ticketId,
          senderType: 'client',
          senderName: ctx.name || 'Gestionnaire École',
          message: trimmedReply || 'Pièces jointes transmises par l’établissement.',
          attachments: replyAttachments,
        })
        .returning();

      // Update ticket: set last message, increment message count, transition status to in_progress
      const [updatedTicket] = await db
        .update(platformSupportTickets)
        .set({
          lastMessage: trimmedReply || '📎 Fichiers joints reçus',
          messagesCount: sql`${platformSupportTickets.messagesCount} + 1`,
          status: existingTicket.status === 'resolved' || existingTicket.status === 'closed' ? 'in_progress' : existingTicket.status,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(platformSupportTickets.id, body.ticketId),
            eq(platformSupportTickets.tenantId, tenantId)
          )
        )
        .returning();

      recordAudit(ctx, 'update', 'support_ticket', body.ticketId, {
        action: 'reply',
        sender: ctx.name,
      });

      return NextResponse.json({
        success: true,
        data: {
          message: newMsg,
          ticket: updatedTicket,
        },
      });
    }

    // 3. Mark ticket as resolved by the school
    if (body.action === 'resolve') {
      if (!body.ticketId) {
        throw new ApiError(400, 'BAD_REQUEST', 'Identifiant de ticket requis.');
      }

      const [updatedTicket] = await db
        .update(platformSupportTickets)
        .set({
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(platformSupportTickets.id, body.ticketId),
            eq(platformSupportTickets.tenantId, tenantId)
          )
        )
        .returning();

      if (!updatedTicket) {
        throw new ApiError(404, 'NOT_FOUND', 'Demande d’assistance introuvable.');
      }

      recordAudit(ctx, 'update', 'support_ticket', body.ticketId, {
        action: 'resolve',
      });

      return NextResponse.json({
        success: true,
        data: {
          ticket: updatedTicket,
          message: 'Le ticket a été marqué comme résolu.',
        },
      });
    }

    throw new ApiError(400, 'BAD_REQUEST', 'Action non reconnue.');
  } catch (error) {
    return apiErrorResponse(error);
  }
}
