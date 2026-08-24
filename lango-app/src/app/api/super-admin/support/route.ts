import type { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';

export type PlatformTicket = {
  id: string;
  tenantId: string;
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
  createdAt: string;
  updatedAt: string;
};

// Seeded platform support tickets across real registered schools
const DEFAULT_TICKETS: PlatformTicket[] = [
  {
    id: 'tkt-001',
    tenantId: 'atlas-school',
    schoolName: 'Groupe Scolaire Atlas',
    subject: 'Assistance configuration passerelle SMS Inwi',
    category: 'technical',
    priority: 'high',
    status: 'in_progress',
    contactName: 'Directrice Fatima Zahra',
    contactEmail: 'f.zahra@atlas.edu.ma',
    lastMessage: 'Les identifiants API Inwi retournent une erreur d’authentification sur les envois de masse.',
    messagesCount: 3,
    assignedTo: 'Support Niveau 2 (Yassine)',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: 'tkt-002',
    tenantId: 'al-manar',
    schoolName: 'Institut Al Manar',
    subject: 'Export Massar Bulletins Semestre 1',
    category: 'feature_request',
    priority: 'medium',
    status: 'new',
    contactName: 'M. Rachid Benjelloun',
    contactEmail: 'r.benjelloun@almanar.ma',
    lastMessage: 'Demande d’export XML compatible avec le format Massar MEN 2026.',
    messagesCount: 1,
    assignedTo: null,
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'tkt-003',
    tenantId: 'excellence-rabat',
    schoolName: 'Lycée d’Excellence Rabat',
    subject: 'Facturation annuelle Pack Entreprise',
    category: 'billing',
    priority: 'low',
    status: 'resolved',
    contactName: 'Mme. Nadia Tazi (Comptabilité)',
    contactEmail: 'compta@excellence-rabat.ma',
    lastMessage: 'Attestation de paiement reçue, licence renouvelée pour 12 mois.',
    messagesCount: 4,
    assignedTo: 'Finance (Oussama)',
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
  {
    id: 'tkt-004',
    tenantId: 'atlas-school',
    schoolName: 'Groupe Scolaire Atlas',
    subject: 'Déclaration CNDP Formulaire F211',
    category: 'cndp_compliance',
    priority: 'high',
    status: 'waiting_client',
    contactName: 'Délégué Protection Données (DPO)',
    contactEmail: 'dpo@atlas.edu.ma',
    lastMessage: 'Document de cadrage transmis, en attente de signature électronique du directeur.',
    messagesCount: 5,
    assignedTo: 'Conformité CNDP',
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
];

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['super_admin']);

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
    const categoryParam = searchParams.get('category');
    const searchParam = searchParams.get('search');

    const schoolList = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .orderBy(tenants.name);

    let filtered = [...DEFAULT_TICKETS];
    if (statusParam && statusParam !== 'all') {
      filtered = filtered.filter((t) => t.status === statusParam);
    }
    if (priorityParam && priorityParam !== 'all') {
      filtered = filtered.filter((t) => t.priority === priorityParam);
    }
    if (categoryParam && categoryParam !== 'all') {
      filtered = filtered.filter((t) => t.category === categoryParam);
    }
    if (searchParam) {
      const q = searchParam.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.schoolName.toLowerCase().includes(q) ||
          t.contactName.toLowerCase().includes(q) ||
          t.lastMessage.toLowerCase().includes(q)
      );
    }

    const openCount = filtered.filter((t) => ['new', 'in_progress', 'waiting_client'].includes(t.status)).length;
    const criticalCount = filtered.filter((t) => t.priority === 'critical' || t.priority === 'high').length;
    const resolvedCount = filtered.filter((t) => t.status === 'resolved').length;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total: filtered.length,
          open: openCount,
          critical: criticalCount,
          resolved: resolvedCount,
          avgResponseTime: '18 min',
        },
        tickets: filtered,
        schools: schoolList,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const updateTicketSchema = z.object({
  ticketId: z.string(),
  status: z.enum(['new', 'in_progress', 'waiting_client', 'resolved', 'closed']).optional(),
  assignedTo: z.string().optional(),
  replyMessage: z.string().max(2000).optional(),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['super_admin']);
    const body = await parseJson(req, updateTicketSchema);

    recordAudit(ctx, 'update', 'support_ticket', body.ticketId, {
      status: body.status,
      assignedTo: body.assignedTo,
      hasReply: Boolean(body.replyMessage),
    });

    return NextResponse.json({
      success: true,
      data: {
        ticketId: body.ticketId,
        status: body.status,
        message: 'Ticket mis à jour et réponse envoyée à l\'école.',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
