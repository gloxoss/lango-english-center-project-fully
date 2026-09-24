import { and, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, userCreateSchema, userUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { generateSetupToken, hashSetupToken, SETUP_TOKEN_TTL_MS } from '@/libs/setup-token';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';
import { accountSetupTokens, branches, smsMessages, twoFactor, user } from '@/models/Schema';
import { toDbRole, toDbStatus, toUiRole, toUiStatus } from '@/models/userMapping';

// ponytail: staff/guardian accounts are `user` rows with role != 'student'.
// qualification and last_login are stopgap columns - see MIGRATION-NOTES.md.

// Response shape matches the previous SQLite implementation exactly so the settings
// and staff views keep working untouched.
function toApiUser(row: typeof user.$inferSelect) {
  return {
    id: row.id,
    schoolId: row.tenantId,
    fullName: row.name,
    email: row.email,
    phone: row.phone,
    role: toUiRole(row.role),
    status: toUiStatus(row.userStatus),
    branchId: row.branchId,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin,
    qualification: row.qualification,
    employeeId: row.employeeId,
    specialization: row.specialization,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'users.manage');
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    const filters = [
      eq(user.tenantId, tenantId),
      context.branchId ? eq(user.branchId, context.branchId) : undefined,
      // Students have their own endpoint; this list is staff and guardians.
      ne(user.role, 'student'),
      ne(user.role, 'super_admin'),
    ];

    if (search) {
      const term = `%${search}%`;
      filters.push(
        or(
          ilike(user.name, term),
          ilike(user.email, term),
          ilike(user.phone, term),
        )!,
      );
    }

    if (role && role !== 'all') {
      filters.push(eq(user.role, toDbRole(role)));
    }

    if (status && status !== 'all') {
      filters.push(eq(user.userStatus, toDbStatus(status)));
    }

    const pagination = parsePagination(searchParams);
    const where = and(...filters);

    const [rows, totalRows] = await Promise.all([
      db.select().from(user).where(where).orderBy(desc(user.createdAt), user.id).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(user).where(where),
    ]);
    const total = totalRows[0]?.total ?? 0;
    const tfaRows = rows.length
      ? await db.select({ userId: twoFactor.userId, verified: twoFactor.verified })
          .from(twoFactor)
          .innerJoin(user, eq(twoFactor.userId, user.id))
          .where(and(eq(user.tenantId, tenantId), inArray(user.id, rows.map(row => row.id))))
      : [];
    const tfaByUser = new Map(tfaRows.map(row => [row.userId, Boolean(row.verified)]));

    return NextResponse.json({
      success: true,
      data: rows.map(row => ({ ...toApiUser(row), tfaVerified: tfaByUser.get(row.id) ?? false })),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'users.manage');
    const body = await parseJson(request, userCreateSchema);
    const branchId = context.branchId ?? body.branchId ?? null;
    if (branchId) {
      const [branch] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId))).limit(1);
      if (!branch || (context.branchId && body.branchId && body.branchId !== context.branchId)) {
        throw new ApiError(403, 'BRANCH_OUT_OF_SCOPE', 'Branche hors de votre périmètre.');
      }
    }
    const id = `USR-${Date.now()}`;

    const [inserted] = await db
      .insert(user)
      .values({
        id,
        tenantId,
        branchId,
        name: body.fullName || 'Nouvel Utilisateur',
        email: body.email || `${id.toLowerCase()}@schoolos.ma`,
        phone: body.phone || '+212 6 00-000000',
        role: toDbRole(body.role, 'teacher'),
        userStatus: toDbStatus(body.status),
        qualification: body.qualification || null,
      })
      .returning();

    // Honest invitation semantics: creating a `user` row is NOT sending an
    // invitation. When a phone is provided, mint a single-use activation token
    // (only its SHA-256 digest is stored) and queue the SMS — the gateway is
    // simulated, so the row is recorded 'queued', never claimed 'sent'. Without
    // a phone there is no delivery path and no token is created.
    let invitation: { tokenCreated: boolean; deliveryStatus: 'queued' | 'no_phone' };
    if (body.phone) {
      const token = generateSetupToken();
      const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS).toISOString();
      await db.insert(accountSetupTokens).values({
        tenantId,
        userId: inserted!.id,
        token: hashSetupToken(token),
        expiresAt,
      });
      await db.insert(smsMessages).values({
        tenantId,
        recipientPhone: normalizeMoroccanPhone(body.phone) || body.phone,
        body: `SchoolOS : activez votre compte via ce lien : /setup-account?token=${token}`,
        status: 'queued',
        createdById: context.userId,
      });
      invitation = { tokenCreated: true, deliveryStatus: 'queued' };
    } else {
      invitation = { tokenCreated: false, deliveryStatus: 'no_phone' };
    }

    recordAudit(context, 'create', 'user', inserted!.id, { invitation: invitation.deliveryStatus });

    return NextResponse.json({
      success: true,
      data: toApiUser(inserted!),
      invitation,
      message: invitation.tokenCreated
        ? 'Compte créé — lien d\'activation généré et SMS mis en file d\'attente.'
        : 'Compte créé — aucun numéro de téléphone fourni, aucun lien d\'activation généré.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'users.manage');
    const body = await parseJson(request, userUpdateSchema);
    const [existing] = await db.select({ id: user.id, role: user.role, branchId: user.branchId })
      .from(user)
      .where(and(
        eq(user.id, body.id),
        eq(user.tenantId, tenantId),
        context.branchId ? eq(user.branchId, context.branchId) : undefined,
      ))
      .limit(1);
    if (!existing || existing.role === 'super_admin') {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
    }
    if (body.role !== undefined && !['school_admin', 'teacher', 'accountant', 'receptionist', 'librarian', 'guard'].includes(existing.role)) {
      throw new ApiError(409, 'ROLE_CHANGE_FORBIDDEN', 'Ce type de compte ne peut pas changer de rôle ici.');
    }
    if (body.id === context.userId && (body.status === 'inactive' || body.status === 'archived' || body.status === 'Inactif' || body.status === 'Archivé')) {
      throw new ApiError(409, 'SELF_DISABLE_FORBIDDEN', 'Vous ne pouvez pas désactiver votre propre compte.');
    }
    if (body.id === context.userId && ((body.role !== undefined && body.role !== existing.role) || (body.branchId !== undefined && body.branchId !== existing.branchId))) {
      throw new ApiError(409, 'SELF_ACCESS_CHANGE_FORBIDDEN', 'Vous ne pouvez pas modifier votre propre rôle ou branche.');
    }
    const nextBranchId = body.branchId === undefined ? existing.branchId : body.branchId;
    if (context.branchId && nextBranchId !== context.branchId) {
      throw new ApiError(403, 'BRANCH_OUT_OF_SCOPE', 'Branche hors de votre périmètre.');
    }
    if (nextBranchId) {
      const [branch] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, nextBranchId), eq(branches.tenantId, tenantId))).limit(1);
      if (!branch) {
        throw new ApiError(400, 'UNKNOWN_BRANCH', 'Branche inconnue.');
      }
    }

    const [updated] = await db
      .update(user)
      .set({
        ...(body.fullName !== undefined ? { name: body.fullName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.role !== undefined ? { role: toDbRole(body.role, existing.role) } : {}),
        ...(body.status !== undefined ? { userStatus: toDbStatus(body.status) } : {}),
        ...(body.branchId !== undefined ? { branchId: nextBranchId } : {}),
      })
      .where(and(
        eq(user.id, body.id),
        eq(user.tenantId, tenantId),
        context.branchId ? eq(user.branchId, context.branchId) : undefined,
      ))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
    }

    recordAudit(context, 'update', 'user', body.id, {
      roleChanged: body.role !== undefined,
      statusChanged: body.status !== undefined,
      branchChanged: body.branchId !== undefined,
    });

    return NextResponse.json({
      success: true,
      data: toApiUser(updated),
      message: 'Utilisateur mis à jour en base de données',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'users.manage');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      if (id === context.userId) {
        throw new ApiError(409, 'SELF_DELETE_FORBIDDEN', 'Vous ne pouvez pas supprimer votre propre compte.');
      }
      const [deleted] = await db.delete(user).where(and(
        eq(user.id, id),
        eq(user.tenantId, tenantId),
        ne(user.role, 'super_admin'),
        context.branchId ? eq(user.branchId, context.branchId) : undefined,
      )).returning({ id: user.id });
      if (!deleted) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
      }
      recordAudit(context, 'delete', 'user', id);
      return NextResponse.json({
        success: true,
        message: 'Utilisateur supprimé de la base de données',
        id,
      });
    }

    return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
