import type { NextRequest } from 'next/server';
import { and, count, desc, eq, inArray, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { auditLogs, guardianStudents, user } from '@/models/Schema';
import { branchWhere } from '@/libs/api/portal-scope';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'guardians.read');

    const { id: guardianId } = await params;

    // A guardian row carries no branch of its own; its campus is the campus of
    // its linked students. Narrow the visible links to the active branch, and
    // a guardian whose links all live elsewhere is invisible (404).
    const [totalLinks] = await db
      .select({ n: count() })
      .from(guardianStudents)
      .where(and(eq(guardianStudents.guardianId, guardianId), eq(guardianStudents.tenantId, tenantId)));
    const links = await db
      .select({ id: guardianStudents.id })
      .from(guardianStudents)
      .innerJoin(user, eq(user.id, guardianStudents.studentId))
      .where(and(eq(guardianStudents.guardianId, guardianId), eq(guardianStudents.tenantId, tenantId), branchWhere(ctx, user.branchId)));
    if (totalLinks && Number(totalLinks.n) > 0 && links.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tuteur introuvable.' } }, { status: 404 });
    }
    const linkIds = links.map(l => l.id);

    const entityConditions = [and(eq(auditLogs.entityType, 'guardian'), eq(auditLogs.entityId, guardianId))!];
    if (linkIds.length > 0) {
      entityConditions.push(and(eq(auditLogs.entityType, 'guardian_student'), inArray(auditLogs.entityId, linkIds))!);
    }

    const entries = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        actorId: auditLogs.actorId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, tenantId),
          or(...entityConditions),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    // Resolve actor names
    const actorIds = Array.from(new Set(entries.map(e => e.actorId).filter(Boolean))) as string[];
    const actorMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const actors = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, actorIds));
      for (const a of actors) {
        actorMap.set(a.id, a.name);
      }
    }

    const formatted = entries.map((e) => {
      const meta = (e.metadata as Record<string, any>) || {};
      let description = '';
      if (e.entityType === 'guardian') {
        if (e.action === 'create') description = 'Création de la fiche tuteur';
        else if (e.action === 'update') description = 'Mise à jour des coordonnées personnelles';
        else if (e.action === 'delete') description = 'Suppression de la fiche';
      } else if (e.entityType === 'guardian_student') {
        if (meta.event === 'unlinked') {
          description = 'Clôture de la liaison avec l\'élève (archivée)';
        } else if (meta.event === 'reactivated') {
          description = 'Réactivation de la liaison élève';
        } else if (e.action === 'create') {
          description = `Rattachement de l'élève${meta.studentName ? ` ${meta.studentName}` : ''} (${meta.relationshipType || 'Parent'})`;
        } else if (e.action === 'update') {
          const studentSuffix = meta.studentName ? ` pour ${meta.studentName}` : '';
          const changed = Object.keys(meta.patch || {});
          if (changed.includes('canPickup')) {
            description = `Modification de l'autorisation de récupération (${meta.patch.canPickup ? 'Autorisé' : 'Révoqué'})${studentSuffix}`;
          } else if (changed.includes('emergencyPriority')) {
            description = `Modification de la priorité d'urgence (${meta.patch.emergencyPriority ?? 'Aucune'})${studentSuffix}`;
          } else if (changed.includes('isPrimaryContact')) {
            description = `Définition comme contact principal (${meta.patch.isPrimaryContact ? 'Oui' : 'Non'})${studentSuffix}`;
          } else if (changed.includes('isFinanciallyResponsible')) {
            description = `Mise à jour de la responsabilité financière (${meta.patch.isFinanciallyResponsible ? 'Oui' : 'Non'})${studentSuffix}`;
          } else {
            description = `Mise à jour des paramètres de la liaison élève${studentSuffix}`;
          }
        }
      }

      return {
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        actorName: e.actorId ? (actorMap.get(e.actorId) || 'Personnel scolaire') : 'Système',
        description: description || `${e.action} sur ${e.entityType}`,
        metadata: e.metadata,
        createdAt: e.createdAt,
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
