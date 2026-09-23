import type { NextRequest } from 'next/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { platformSupportTickets, platformSupportTicketMessages, tenants, user, type SupportAttachment } from '@/models/Schema';

export type PlatformTicket = {
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

export type PlatformTicketMessage = {
  id: string;
  ticketId: string;
  senderType: 'client' | 'super_admin';
  senderName: string;
  message: string;
  attachments?: SupportAttachment[] | null;
  createdAt: string;
};

export type AssignableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['super_admin']);

    const { searchParams } = new URL(req.url);
    const ticketIdParam = searchParams.get('ticketId');

    // If specific ticket messages requested
    if (ticketIdParam) {
      const [ticket] = await db
        .select()
        .from(platformSupportTickets)
        .where(eq(platformSupportTickets.id, ticketIdParam))
        .limit(1);

      if (!ticket) {
        throw new ApiError(404, 'NOT_FOUND', 'Ticket introuvable.');
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

    const conditions: any[] = [];

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
          ilike(platformSupportTickets.schoolName, q),
          ilike(platformSupportTickets.contactName, q),
          ilike(platformSupportTickets.contactEmail, q),
          ilike(platformSupportTickets.lastMessage, q)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [tickets, statsRows, schoolList, adminUsers, existingAssignees] = await Promise.all([
      db
        .select()
        .from(platformSupportTickets)
        .where(whereClause)
        .orderBy(desc(platformSupportTickets.updatedAt)),

      db
        .select({
          total: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${platformSupportTickets.status} in ('new', 'in_progress', 'waiting_client'))::int`,
          critical: sql<number>`count(*) filter (where ${platformSupportTickets.priority} in ('critical', 'high'))::int`,
          resolved: sql<number>`count(*) filter (where ${platformSupportTickets.status} = 'resolved')::int`,
          avgMinutes: sql<number>`coalesce(round(avg(extract(epoch from (${platformSupportTickets.firstRespondedAt} - ${platformSupportTickets.createdAt})) / 60) filter (where ${platformSupportTickets.firstRespondedAt} is not null))::int, 18)`,
        })
        .from(platformSupportTickets),

      db
        .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
        .from(tenants)
        .orderBy(tenants.name),

      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        })
        .from(user)
        .where(and(eq(user.role, 'super_admin'), eq(user.userStatus, 'active'))),

      db
        .selectDistinct({ assignedTo: platformSupportTickets.assignedTo })
        .from(platformSupportTickets)
        .where(sql`${platformSupportTickets.assignedTo} IS NOT NULL AND ${platformSupportTickets.assignedTo} != ''`),
    ]);

    const assignableUsers = adminUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      image: u.image || null,
    }));

    const assigneesSet = new Set<string>();
    for (const u of adminUsers) {
      if (u.name) assigneesSet.add(u.name);
    }
    for (const a of existingAssignees) {
      if (a.assignedTo) assigneesSet.add(a.assignedTo);
    }
    const assigneesList = Array.from(assigneesSet);

    const stats = statsRows[0] || {
      total: 0,
      open: 0,
      critical: 0,
      resolved: 0,
      avgMinutes: 18,
    };

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total: stats.total,
          open: stats.open,
          critical: stats.critical,
          resolved: stats.resolved,
          avgResponseTime: `${stats.avgMinutes} min`,
        },
        tickets,
        schools: schoolList,
        assignees: assigneesList,
        assignableUsers,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const postTicketSchema = z.object({
  action: z.enum(['update', 'create', 'assign']).default('update'),
  // Create payload
  tenantId: z.string().uuid().optional(),
  schoolName: z.string().min(2).max(255).optional(),
  subject: z.string().min(3).max(255).optional(),
  category: z.enum(['technical', 'billing', 'onboarding', 'cndp_compliance', 'feature_request']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  contactName: z.string().min(2).max(255).optional(),
  contactEmail: z.string().email().optional(),
  initialMessage: z.string().min(2).max(4000).optional(),
  // Update & Assign payload
  ticketId: z.string().uuid().optional(),
  status: z.enum(['new', 'in_progress', 'waiting_client', 'resolved', 'closed']).optional(),
  assignedTo: z.string().nullable().optional(),
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
    const ctx = await requireRequestContext(req, ['super_admin']);
    const body = await parseJson(req, postTicketSchema);

    // 1. Create a new support ticket
    if (body.action === 'create') {
      if (!body.schoolName || !body.subject || !body.category || !body.contactName || !body.contactEmail || !body.initialMessage) {
        throw new ApiError(400, 'BAD_REQUEST', 'Tous les champs obligatoires doivent être renseignés.');
      }

      const attachmentsList = body.attachments || [];

      const [newTicket] = await db
        .insert(platformSupportTickets)
        .values({
          tenantId: body.tenantId || null,
          schoolName: body.schoolName,
          subject: body.subject,
          category: body.category,
          priority: body.priority,
          status: 'new',
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          lastMessage: body.initialMessage,
          messagesCount: 1,
          assignedTo: body.assignedTo || null,
          attachments: attachmentsList,
        })
        .returning();

      if (newTicket) {
        await db.insert(platformSupportTicketMessages).values({
          ticketId: newTicket.id,
          senderType: 'client',
          senderName: body.contactName,
          message: body.initialMessage,
          attachments: attachmentsList,
        });
      }

      recordAudit(ctx, 'create', 'support_ticket', newTicket?.id || 'unknown', {
        schoolName: body.schoolName,
        subject: body.subject,
        priority: body.priority,
      });

      return NextResponse.json({
        success: true,
        data: {
          ticket: newTicket,
          message: 'Ticket créé et enregistré avec succès dans la base de données.',
        },
      });
    }

    // 2. Update or Assign an existing support ticket
    if (!body.ticketId) {
      throw new ApiError(400, 'BAD_REQUEST', 'L’identifiant du ticket est requis.');
    }

    const [existingTicket] = await db
      .select()
      .from(platformSupportTickets)
      .where(eq(platformSupportTickets.id, body.ticketId))
      .limit(1);

    if (!existingTicket) {
      throw new ApiError(404, 'NOT_FOUND', 'Ticket introuvable en base de données.');
    }

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.status) {
      updates.status = body.status;
      if (body.status === 'resolved' && !existingTicket.resolvedAt) {
        updates.resolvedAt = new Date().toISOString();
      }
    }

    if (body.assignedTo !== undefined) {
      updates.assignedTo = body.assignedTo;
    }

    const hasReplyText = Boolean(body.replyMessage && body.replyMessage.trim());
    const hasAttachments = Boolean(body.attachments && body.attachments.length > 0);

    if (hasReplyText || hasAttachments) {
      const trimmedReply = body.replyMessage?.trim() || '';
      updates.lastMessage = trimmedReply || '📎 Pièces jointes partagées par le support';
      updates.messagesCount = sql`${platformSupportTickets.messagesCount} + 1`;

      if (!existingTicket.firstRespondedAt) {
        updates.firstRespondedAt = new Date().toISOString();
      }

      // Record message in thread
      await db.insert(platformSupportTicketMessages).values({
        ticketId: existingTicket.id,
        senderType: 'super_admin',
        senderName: ctx.name || 'Support SuperAdmin',
        message: trimmedReply || 'Pièces jointes fournies par l’équipe support.',
        attachments: body.attachments || [],
      });
    }

    const [updatedTicket] = await db
      .update(platformSupportTickets)
      .set(updates)
      .where(eq(platformSupportTickets.id, body.ticketId))
      .returning();

    recordAudit(ctx, 'update', 'support_ticket', body.ticketId, {
      status: body.status,
      assignedTo: body.assignedTo,
      hasReply: hasReplyText || hasAttachments,
    });

    return NextResponse.json({
      success: true,
      data: {
        ticket: updatedTicket,
        message: 'Ticket mis à jour et persisté avec succès.',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
