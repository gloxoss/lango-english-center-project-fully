import { and, eq } from 'drizzle-orm';
import type { AppRole, RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { rolePermissions, userPermissionOverrides } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Permission keys — grouped by module.
//
// Core set for V1. Module-specific permissions are added as each module ships.
// This list is the single source of truth; the permissions table is seeded
// from it and used for tenant-level overrides only.
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  // Settings
  'settings.read': 'Voir les paramètres',
  'settings.organization.manage': 'Modifier les paramètres d\'organisation',
  'settings.localization.manage': 'Modifier les paramètres de localisation',
  'settings.security.manage': 'Modifier les paramètres de sécurité',
  'settings.attendance.manage': 'Modifier les paramètres de présence',

  // Students
  'students.read': 'Voir les élèves',
  'students.create': 'Créer des élèves',
  'students.update': 'Modifier des élèves',
  'students.delete': 'Supprimer des élèves',
  'students.import': 'Importer des élèves',
  'students.export': 'Exporter les données élèves',

  // Teachers
  'teachers.read': 'Voir les enseignants',
  'teachers.create': 'Créer des enseignants',
  'teachers.update': 'Modifier des enseignants',
  'teachers.delete': 'Supprimer des enseignants',

  // Academics
  'academics.read': 'Voir la structure académique',
  'academics.manage': 'Gérer la structure académique',

  // Attendance
  'attendance.read': 'Voir les présences',
  'attendance.manage': 'Gérer les présences',

  // Finance
  'finance.read': 'Voir les finances',
  'finance.manage': 'Gérer les finances',
  'finance.approve': 'Approuver les opérations financières',

  // Users & access
  'users.read': 'Voir les utilisateurs',
  'users.manage': 'Gérer les utilisateurs',
  'users.permissions.manage': 'Gérer les permissions',

  // Audit
  'audit.read': 'Consulter les journaux d\'audit',

  // Guardians
  'guardians.read': 'Voir les parents/tuteurs',
  'guardians.manage': 'Gérer les parents/tuteurs',

  // Communication
  'communication.read': 'Voir les communications',
  'communication.send': 'Envoyer des communications',

  // Grading
  'grading.read': 'Voir les notes',
  'grading.manage': 'Gérer les notes',

  // Reports
  'reports.read': 'Consulter les rapports',
  'reports.export': 'Exporter les rapports',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// ---------------------------------------------------------------------------
// Default role→permission mappings.
// These are used when no tenant-level overrides exist.
// ---------------------------------------------------------------------------

const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, readonly PermissionKey[]> = {
  super_admin: ALL_PERMISSIONS,
  school_admin: ALL_PERMISSIONS,
  teacher: [
    'students.read',
    'academics.read',
    'attendance.read', 'attendance.manage',
    'grading.read', 'grading.manage',
    'communication.read',
    'guardians.read',
    'reports.read',
  ],
  accountant: [
    'students.read',
    'finance.read', 'finance.manage',
    'reports.read', 'reports.export',
    'guardians.read',
  ],
  student: [
    'attendance.read',
    'grading.read',
    'academics.read',
  ],
  parent: [
    'students.read',
    'attendance.read',
    'grading.read',
    'finance.read',
    'communication.read',
  ],
  receptionist: [
    'students.read', 'students.create',
    'guardians.read', 'guardians.manage',
    'communication.read', 'communication.send',
  ],
  guard: [
    'students.read',
    'attendance.read',
  ],
};

// ---------------------------------------------------------------------------
// Permission check logic
//
// Resolution: role default → tenant override → user override.
// User overrides are additive (grant) or subtractive (revoke).
// ---------------------------------------------------------------------------

/**
 * Check if a user has a specific permission.
 * Returns true if the permission is granted, false if denied.
 */
export async function hasCapability(
  userId: string,
  tenantId: string,
  role: AppRole,
  permission: PermissionKey,
): Promise<boolean> {
  // Super admin always has all permissions.
  if (role === 'super_admin') {
    return true;
  }

  // 1. Check user-level override first (most specific).
  const [userOverride] = await db
    .select()
    .from(userPermissionOverrides)
    .where(and(
      eq(userPermissionOverrides.tenantId, tenantId),
      eq(userPermissionOverrides.userId, userId),
      eq(userPermissionOverrides.permissionId, permission),
    ))
    .limit(1);

  if (userOverride) {
    return userOverride.granted;
  }

  // 2. Check tenant-level role override.
  const [roleOverride] = await db
    .select()
    .from(rolePermissions)
    .where(and(
      eq(rolePermissions.tenantId, tenantId),
      eq(rolePermissions.roleId, role),
      eq(rolePermissions.permissionId, permission),
    ))
    .limit(1);

  if (roleOverride) {
    // The row is the tenant's decision for this role, in either direction -
    // returning true unconditionally here would make revocation impossible.
    return roleOverride.granted;
  }

  // 3. Fall back to hardcoded defaults.
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
  return defaults.includes(permission);
}

/**
 * Guard: throws 403 if the user lacks the required permission.
 * Drop-in enhancement for `requireRequestContext(req, ['school_admin'])`.
 */
export async function requireCapability(
  context: RequestContext,
  permission: PermissionKey,
): Promise<void> {
  if (!context.tenantId && context.role !== 'super_admin') {
    throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  }

  const allowed = await hasCapability(
    context.userId,
    context.tenantId ?? '',
    context.role,
    permission,
  );

  if (!allowed) {
    throw new ApiError(403, 'FORBIDDEN',
      `Permission manquante: ${PERMISSIONS[permission] ?? permission}`);
  }
}

/**
 * Get all effective permissions for a user.
 */
export async function getEffectivePermissions(
  userId: string,
  tenantId: string,
  role: AppRole,
): Promise<Record<PermissionKey, boolean>> {
  const result: Record<string, boolean> = {};

  for (const key of ALL_PERMISSIONS) {
    result[key] = await hasCapability(userId, tenantId, role, key);
  }

  return result as Record<PermissionKey, boolean>;
}
