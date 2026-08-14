import { NextResponse } from 'next/server';
import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { announcements, assignments, attendance, classSections, classSubjects, invoices, smsMessages, user } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import {
  requireRelationship,
  resolveEffectiveChildren,
  type EffectiveChild,
  type RelationshipAuth,
} from '@/features/parent/services/relationship-resolver';

// GET /api/guardian/me/home — the household home aggregate. The active child
// defaults to the primary relationship, or is taken from the optional ?child=
// relationshipId (which is reauthorized server-side; a non-owned id is a
// uniform 404). Each widget loads independently and degrades to
// { degraded: true, reason } when its underlying data is unavailable or fails,
// so the home never breaks wholesale. Later phases replace the placeholder
// loaders; the widget key set is the stable contract.

export type HomeWidget =
  | { degraded: true; reason: 'not_available' | 'error' }
  | { degraded: false; value: number; label: string };

export type ParentHomeWidgets = {
  alerts: HomeWidget;
  attendanceToday: HomeWidget;
  balances: HomeWidget;
  upcoming: HomeWidget;
  homework: HomeWidget;
  messages: HomeWidget;
};

const WIDGET_KEYS = ['alerts', 'attendanceToday', 'balances', 'upcoming', 'homework', 'messages'] as const;

/** Placeholder loaders — each phase wires its widget here. */
async function studentSection(tenantId: string, studentId: string) {
  const [row] = await db.select({ classSectionId: user.classSectionId }).from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId))).limit(1);
  return row?.classSectionId ?? null;
}

const widgetLoaders: Record<keyof ParentHomeWidgets, (auth: RelationshipAuth, tenantId: string) => Promise<HomeWidget>> = {
  alerts: async (auth, tenantId) => {
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, auth.studentId), eq(attendance.date, today), inArray(attendance.status, ['absent', 'late']), eq(attendance.isVoided, false)));
    return { degraded: false, value: Number(row?.n ?? 0), label: 'absence(s) ou retard(s) aujourd’hui' };
  },
  attendanceToday: async (auth, tenantId) => {
    if (!auth.rights.attendance) return { degraded: true, reason: 'not_available' };
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, auth.studentId), eq(attendance.date, today), eq(attendance.isVoided, false)));
    return { degraded: false, value: Number(row?.n ?? 0), label: 'séance(s) enregistrée(s)' };
  },
  balances: async (auth, tenantId) => {
    if (!auth.rights.finance) return { degraded: true, reason: 'not_available' };
    const [row] = await db.select({ amount: sql<number>`coalesce(sum(${invoices.netAmount} - ${invoices.paidAmount}), 0)` }).from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, auth.studentId), inArray(invoices.status, ['pending', 'partial', 'overdue'])));
    return { degraded: false, value: Number(row?.amount ?? 0), label: 'MAD restant à payer' };
  },
  upcoming: async (auth, tenantId) => {
    const sectionId = await studentSection(tenantId, auth.studentId);
    const sectionScope = sectionId ? or(isNull(announcements.targetClassSectionId), eq(announcements.targetClassSectionId, sectionId)) : isNull(announcements.targetClassSectionId);
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(announcements).where(and(eq(announcements.tenantId, tenantId), or(isNull(announcements.targetRole), eq(announcements.targetRole, 'parent')), sectionScope));
    return { degraded: false, value: Number(row?.n ?? 0), label: 'annonce(s) disponible(s)' };
  },
  homework: async (auth, tenantId) => {
    if (!auth.rights.academic) return { degraded: true, reason: 'not_available' };
    const sectionId = await studentSection(tenantId, auth.studentId);
    if (!sectionId) return { degraded: false, value: 0, label: 'devoir à venir' };
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(assignments).innerJoin(classSubjects, eq(assignments.classSubjectId, classSubjects.id)).innerJoin(classSections, eq(classSubjects.classId, classSections.classId)).where(and(eq(assignments.tenantId, tenantId), eq(classSections.id, sectionId), gt(assignments.dueDate, new Date().toISOString())));
    return { degraded: false, value: Number(row?.n ?? 0), label: 'devoir(s) à venir' };
  },
  messages: async (auth, tenantId) => {
    if (!auth.rights.communication) return { degraded: true, reason: 'not_available' };
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(smsMessages).where(and(eq(smsMessages.tenantId, tenantId), eq(smsMessages.studentId, auth.studentId)));
    return { degraded: false, value: Number(row?.n ?? 0), label: 'message(s) lié(s) à l’enfant' };
  },
};

function pickActiveChild(children: EffectiveChild[], requested: string | null): EffectiveChild {
  if (requested) {
    const match = children.find((c) => c.relationshipId === requested);
    if (match) return match;
  }
  // Caller guards on children.length > 0 before invoking.
  return children.find((c) => c.isPrimaryContact) ?? children[0]!;
}

export async function GET(request: Request) {
  try {
    const ctx = await requireParentContext(request);
    const tenantId = ctx.tenantId as string;

    const children = await resolveEffectiveChildren(tenantId, ctx.userId);
    if (children.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          children: [],
          activeChild: null,
          widgets: Object.fromEntries(WIDGET_KEYS.map((k) => [k, { degraded: true, reason: 'not_available' } as HomeWidget])),
        },
      });
    }

    // Reauthorize the requested child: an unowned/ineffective relationshipId is
    // a uniform 404 (never a distinguishing 403).
    const requested = new URL(request.url).searchParams.get('child');
    let auth: RelationshipAuth;
    if (requested) {
      auth = await requireRelationship(ctx, requested);
    } else {
      const active = pickActiveChild(children, null);
      auth = await requireRelationship(ctx, active.relationshipId);
    }

    const widgets = {} as ParentHomeWidgets;
    for (const key of WIDGET_KEYS) {
      try {
        widgets[key] = await widgetLoaders[key](auth, tenantId);
      } catch {
        widgets[key] = { degraded: true, reason: 'error' };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        children,
        activeChild: {
          relationshipId: auth.relationshipId,
          studentId: auth.studentId,
          name: children.find((c) => c.relationshipId === auth.relationshipId)?.name ?? null,
          rights: auth.rights,
          isPrimaryContact: auth.isPrimaryContact,
        },
        widgets,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
