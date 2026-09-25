import { and, count, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { hasCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { overdueInvoiceCondition } from '@/libs/finance/definitions';
import {
  admissionInterviews,
  announcementReads,
  announcements,
  applicants,
  attendance,
  classes,
  classSections,
  invoices,
  refunds,
  smsMessages,
  user,
} from '@/models/Schema';

// ---------------------------------------------------------------------------
// General notification surface for the admin shell. The bell used to surface
// only announcements; a director expects cross-system signals. Every block
// below aggregates a REAL source (no fabricated events), is tenant-scoped and
// capability-gated, and carries a click-through destination. Announcements keep
// their existing read/unread persistence; the operational blocks are derived
// state (they disappear once the underlying work is done) - that is the honest
// strongest version without a notifications-persistence subsystem.
// ---------------------------------------------------------------------------
type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: string | null;
  href: string;
  read: boolean;
};

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const branchFilter = context.branchId ? eq(user.branchId, context.branchId) : undefined;

    const [canFinance, canAcademics, canStudents] = await Promise.all([
      hasCapability(context.userId, tenantId, context.role, 'finance.read'),
      hasCapability(context.userId, tenantId, context.role, 'attendance.read'),
      hasCapability(context.userId, tenantId, context.role, 'students.read'),
    ]);

    const action: NotificationItem[] = [];
    const updates: NotificationItem[] = [];
    const system: NotificationItem[] = [];

    // --- Announcements (existing persistence, all roles) ---------------------
    // Audience filter mirrors the announcements surfaces exactly: a viewer
    // only sees announcements addressed to their role (or unaddressed) AND
    // addressed to their class (or school-wide). Without this, a parent would
    // read a teachers-only note (privacy leak, claude-finance review).
    const [viewer] = await db
      .select({ classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.id, context.userId), eq(user.tenantId, tenantId)))
      .limit(1);
    const mySectionId = viewer?.classSectionId ?? null;
    const announcementRoleScope = or(
      isNull(announcements.targetRole),
      eq(announcements.targetRole, context.role as any),
    )!;
    const announcementSectionScope = mySectionId
      ? or(isNull(announcements.targetClassSectionId), eq(announcements.targetClassSectionId, mySectionId))!
      : isNull(announcements.targetClassSectionId)!;
    // announcement_reads has no tenant column; tenant scoping flows through
    // the join to announcements (which is tenant-scoped).
    const readRows = await db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .innerJoin(announcements, eq(announcements.id, announcementReads.announcementId))
      .where(and(
        eq(announcements.tenantId, tenantId),
        eq(announcementReads.userId, context.userId),
      ));
    const readIds = new Set(readRows.map(r => r.announcementId));
    const announcementRows = await db
      .select()
      .from(announcements)
      .where(and(
        eq(announcements.tenantId, tenantId),
        announcementRoleScope,
        announcementSectionScope,
      ))
      .limit(20);
    const unreadAnnouncements = announcementRows.filter(a => !readIds.has(a.id));
    for (const a of unreadAnnouncements.slice(0, 3)) {
      updates.push({
        id: `ann-${a.id}`,
        title: a.title,
        detail: a.body?.slice(0, 120) ?? '',
        createdAt: a.createdAt ? String(a.createdAt) : null,
        href: '/dashboard/communication/announcements',
        read: false,
      });
    }

    // --- Finance: overdue invoices (action) ----------------------------------
    // Canonical overdue definition (libs/finance/definitions): still owed AND
    // past due date — identical to the dashboard KPI so the counts agree.
    if (canFinance) {
      const [overdueRows] = await db
        .select({ c: count() })
        .from(invoices)
        .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(invoices.tenantId, tenantId),
          overdueInvoiceCondition(invoices.status, invoices.dueDate, today),
          branchFilter,
        ));
      const overdueCount = overdueRows?.c ?? 0;
      if (overdueCount > 0) {
        action.push({
          id: 'fin-overdue',
          title: `${overdueCount} facture(s) en retard`,
          detail: 'Impayés échus à relancer',
          createdAt: null,
          href: '/dashboard/finance/invoices',
          read: false,
        });
      }

      const [refundRows] = await db
        .select({ c: count() })
        .from(refunds)
        .where(and(eq(refunds.tenantId, tenantId), eq(refunds.status, 'pending')));
      const refundCount = refundRows?.c ?? 0;
      if (refundCount > 0) {
        action.push({
          id: 'fin-refunds',
          title: `${refundCount} remboursement(s) à approuver`,
          detail: 'Demandes en attente de décision',
          createdAt: null,
          href: '/dashboard/finance/refunds',
          read: false,
        });
      }
    }

    // --- Academics: incomplete attendance today (action) ---------------------
    if (canAcademics) {
      const [expectedRows] = await db
        .select({ c: count() })
        .from(classSections)
        .innerJoin(classes, and(eq(classSections.classId, classes.id), eq(classes.tenantId, tenantId)))
        .where(and(
          eq(classSections.tenantId, tenantId),
          // sections inherit the branch through their class
          context.branchId ? eq(classes.branchId, context.branchId) : undefined,
        ));
      const [doneRows] = await db
        .select({ c: sql<number>`count(distinct ${user.classSectionId})::int` })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.date, today),
          eq(attendance.isVoided, false),
          branchFilter,
        ));
      const expected = expectedRows?.c ?? 0;
      const done = doneRows?.c ?? 0;
      if (expected > 0 && done < expected) {
        action.push({
          id: 'ac-attendance',
          title: `Pointage incomplet : ${done}/${expected} classes`,
          detail: 'Les données d\'assiduité du jour seront complètes après saisie',
          createdAt: null,
          href: '/dashboard/attendance',
          read: false,
        });
      }
    }

    // --- Students: admissions queue (action) ----------------------------------
    if (canStudents) {
      const [applicantRows] = await db
        .select({ c: count() })
        .from(applicants)
        .where(and(
          eq(applicants.tenantId, tenantId),
          inArray(applicants.status, ['new', 'applied', 'contacted', 'qualified']),
          // applicants carries its own branchId — no user join here.
          context.branchId ? eq(applicants.branchId, context.branchId) : undefined,
        ));
      const applicantCount = applicantRows?.c ?? 0;
      if (applicantCount > 0) {
        action.push({
          id: 'adm-queue',
          title: `${applicantCount} dossier(s) d'admission à examiner`,
          detail: 'Candidatures en cours de traitement',
          createdAt: null,
          href: '/dashboard/students/admissions',
          read: false,
        });
      }

      const [interviewRows] = await db
        .select({ c: count() })
        .from(admissionInterviews)
        .where(and(
          eq(admissionInterviews.tenantId, tenantId),
          eq(admissionInterviews.status, 'scheduled'),
          gte(admissionInterviews.scheduledAt, `${today}T00:00:00`),
          lte(admissionInterviews.scheduledAt, `${today}T23:59:59`),
        ));
      const interviewCount = interviewRows?.c ?? 0;
      if (interviewCount > 0) {
        action.push({
          id: 'adm-interviews',
          title: `${interviewCount} entretien(s) aujourd'hui`,
          detail: 'Entretiens d\'admission planifiés',
          createdAt: null,
          href: '/dashboard/students/admissions',
          read: false,
        });
      }
    }

    // --- System: failed SMS in the last 7 days --------------------------------
    if (canAcademics || canFinance) {
      const [smsRows] = await db
        .select({ c: count() })
        .from(smsMessages)
        .where(and(
          eq(smsMessages.tenantId, tenantId),
          eq(smsMessages.status, 'failed'),
          gte(smsMessages.createdAt, `${weekAgo}T00:00:00`),
        ));
      const smsCount = smsRows?.c ?? 0;
      if (smsCount > 0) {
        system.push({
          id: 'sys-sms',
          title: `${smsCount} SMS en échec (7 jours)`,
          detail: 'Vérifier la passerelle et les numéros',
          createdAt: null,
          href: '/dashboard/communication',
          read: false,
        });
      }
    }

    const unreadCount = action.length + updates.length + system.length;

    return NextResponse.json({
      success: true,
      data: { groups: { action, updates, system }, unreadCount },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
