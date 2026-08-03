import { and, count, eq, ilike, ne, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, userCreateSchema, userUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import { toDbRole, toDbStatus, toUiRole, toUiStatus } from '@/models/userMapping';

// ponytail: staff/guardian accounts are `user` rows with role != 'student'.
// qualification, salary and last_login are stopgap columns - see MIGRATION-NOTES.md.

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
    createdAt: row.createdAt,
    lastLogin: row.lastLogin,
    qualification: row.qualification,
    salary: row.salary,
    employeeId: row.employeeId,
    specialization: row.specialization,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    const filters = [
      eq(user.tenantId, tenantId),
      // Students have their own endpoint; this list is staff and guardians.
      ne(user.role, 'student'),
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
      db.select().from(user).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(user).where(where),
    ]);
    const total = totalRows[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      data: rows.map(toApiUser),
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
    const id = `USR-${Date.now()}`;

    const [inserted] = await db
      .insert(user)
      .values({
        id,
        tenantId,
        name: body.fullName || 'Nouvel Utilisateur',
        email: body.email || `${id.toLowerCase()}@schoolos.ma`,
        phone: body.phone || '+212 6 00-000000',
        role: toDbRole(body.role, 'teacher'),
        userStatus: toDbStatus(body.status),
        qualification: body.qualification || null,
        // numeric() maps to string in drizzle, avoiding float precision loss.
        salary: body.salary ? String(body.salary) : null,
      })
      .returning();

    recordAudit(context, 'create', 'user', inserted!.id);

    return NextResponse.json({
      success: true,
      data: toApiUser(inserted!),
      message: 'Utilisateur créé en base de données avec succès',
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

    await db
      .update(user)
      .set({
        name: body.fullName,
        email: body.email,
        phone: body.phone,
        role: toDbRole(body.role, 'teacher'),
        userStatus: toDbStatus(body.status),
      })
      .where(and(
        eq(user.id, body.id),
        eq(user.tenantId, tenantId),
      ));

    recordAudit(context, 'update', 'user', body.id);

    return NextResponse.json({
      success: true,
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
      await db.delete(user).where(and(
        eq(user.id, id),
        eq(user.tenantId, tenantId),
      ));
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
