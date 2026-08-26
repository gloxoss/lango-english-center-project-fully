import { and, eq } from 'drizzle-orm';
import type { AppRole, RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { rolePermissions, userPermissionOverrides, tenants } from '@/models/Schema';

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
  'settings.integrations.manage': 'Gérer les connexions et fournisseurs externes',
  'settings.jobs.manage': 'Gérer les tâches planifiées et la maintenance',
  'settings.approve': 'Approuver les modifications de paramètres',
  'settings.secret.rotate': 'Rotation et consultation des secrets',
  'settings.rollback': 'Restaurer une version antérieure d\'un paramètre',
  'settings.custom_field.manage': 'Gérer les champs personnalisés',
  'settings.numbering.manage': 'Gérer les séries de numérotation',
  'settings.jobs.operate': 'Opérer les tâches planifiées (déclenchement, activation)',
  'settings.translation.manage': 'Gérer le dictionnaire de traductions',
  'settings.finance_mapping.manage': 'Gérer les liaisons comptables PCG',

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
  'finance.close': 'Clôturer une période fiscale',

  // Office Accounting
  'accounting.account.read': 'Consulter le plan comptable',
  'accounting.account.manage': 'Gérer le plan comptable',
  'accounting.voucher.prepare': 'Préparer les pièces comptables',
  'accounting.voucher.approve': 'Approuver les pièces comptables',
  'accounting.voucher.post': 'Comptabiliser les pièces approuvées',
  'accounting.voucher.reverse': 'Contrepasser les écritures comptables',
  'accounting.deposit.create': 'Créer les encaissements hors frais scolaires',
  'accounting.expense.prepare': 'Préparer les dépenses',
  'accounting.expense.approve': 'Approuver les dépenses',
  'accounting.journal.create': 'Créer les écritures de journal',
  'accounting.period.close': 'Clôturer les périodes comptables',
  'accounting.period.reopen': 'Rouvrir exceptionnellement une période comptable',
  'accounting.reconcile': 'Effectuer les rapprochements bancaires',
  'accounting.statement.read': 'Consulter les états financiers',
  'accounting.export': 'Exporter les données comptables',

  // Users & access
  'users.read': 'Voir les utilisateurs',
  'users.manage': 'Gérer les utilisateurs',
  'users.permissions.manage': 'Gérer les permissions',

  // Audit
  'audit.read': 'Consulter les journaux d\'audit',

  // Analytics / Portail direction
  'analytics.read': 'Consulter le portail direction',
  'leadership.portal.use': 'Utiliser le portail direction',
  'leadership.scope.manage': 'Gérer les périmètres et délégations de direction',
  'leadership.approve': 'Exercer une autorité d’approbation attribuée',
  'leadership.sensitive.read': 'Consulter les projections sensibles autorisées de direction',
  'leadership.export': 'Exporter les rapports autorisés de direction',

  // Guardians
  'guardians.read': 'Voir les parents/tuteurs',
  'guardians.manage': 'Gérer les parents/tuteurs',

  // Students extended
  'students.guardians.manage': 'Lier/délier tuteurs d\'un élève',
  'students.placements.manage': 'Gérer l\'historique de placement (rollback)',

  // Admissions
  'admissions.view': 'Voir les demandes d\'admission',
  'admissions.manage': 'Gérer les demandes d\'admission',

  // Communication
  'communication.read': 'Voir les communications',
  'communication.send': 'Envoyer des communications',

  // Grading
  'grading.read': 'Voir les notes',
  'grading.manage': 'Gérer les notes',
  'grading.review': 'Relire les notes en lecture seule (vérification sans modification)',

  // Reports
  'reports.read': 'Consulter les rapports',
  'reports.export': 'Exporter les rapports',
  'reports.manage': 'Gérer la configuration des rapports et des vues enregistrées',
  'reports.schedule': 'Programmer la livraison automatique de rapports',

  // HR & Payroll (Phase 6)
  'hr.read': 'Voir les données RH et paie',
  'hr.manage': 'Gérer les RH et la paie',

  // Advanced HR & Employee Management Add-on
  'hr.employee.read': 'Consulter le répertoire et les profils employés',
  'hr.employee.manage': 'Créer et modifier les employés',
  'hr.organization.manage': 'Gérer les départements et les postes',
  'hr.documents.read': 'Consulter les documents RH',
  'hr.documents.manage': 'Gérer les documents RH',
  'hr.sensitive.read': 'Consulter les données sensibles RH (salaire, CNI, contrats, RIB)',
  'hr.access.manage': 'Gérer les accès, invitations et sorties des employés',
  'hr.export': 'Exporter les données RH',

  // Payroll & Workforce Operations add-on (granular, maker/checker-friendly).
  // School_admin receives all via ALL_PERMISSIONS; other roles get none by
  // default and are granted explicitly per-user/per-tenant. Maker/checker is
  // enforced in the services on top of these grants (e.g. the run approver can
  // never be the preparer/calculator).
  'payroll.configure': 'Configurer les paramètres de paie (composantes, structures, réglementation)',
  'payroll.calculate': 'Lancer le calcul de la paie',
  'payroll.review': 'Relire une paie calculée (séparation des tâches)',
  'payroll.approve': 'Approuver une paie',
  'payroll.post': 'Comptabiliser une paie approuvée',
  'payroll.sensitive.read': 'Consulter les données sensibles de paie (salaires, RIB, CNSS, taxes)',
  'payroll.payment.prepare': 'Préparer les lots de paiement de salaires',
  'payroll.payment.approve': 'Approuver les lots de paiement de salaires',
  'payroll.payment.reconcile': 'Réconcilier les paiements de salaires',
  'payroll.leave.manage': 'Administrer les congés (catégories, politiques, solde, approbation)',
  'payroll.advances.manage': 'Gérer les avances sur salaire (approbation, décaissement, recouvrement)',
  'payroll.awards.manage': 'Gérer les récompenses et primes',
  'payroll.self.read': 'Consulter ses propres bulletins et données de paie (self-service)',

  // CRM (Phase 7)
  'crm.manage': 'Gérer le pipeline CRM et les prospects',

  // Attachments Book
  'content.manage': 'Gérer les ressources pédagogiques',
  'content.types.manage': 'Configurer les types de pièces jointes',

  // Cards & Admit Cards
  'cards.templates.manage': 'Gérer les modèles de documents et cartes',
  'cards.issue': 'Émettre des documents et cartes',
  'cards.revoke': 'Révoquer des documents et cartes',

  // Certificates
  'certificates.templates.manage': 'Gérer les définitions, modèles et signataires de certificats',
  'certificates.issue': 'Émettre des certificats',
  'certificates.revoke': 'Révoquer ou corriger des certificats',
  'certificates.approve': 'Approuver les demandes de certificats',

  // Event Management Add-on
  'events.read': 'Voir les événements',
  'events.create': 'Créer des événements',
  'events.manage_own': 'Gérer ses propres événements',
  'events.manage_all': 'Gérer tous les événements',
  'events.approve': 'Approuver les événements',
  'events.publish': 'Publier les événements',
  'events.registration.manage': 'Gérer les inscriptions aux événements',
  'events.checkin': 'Gérer le pointage des événements',
  'events.communication.send': 'Envoyer des communications pour les événements',
  'events.report.read': 'Consulter les rapports d\'événements',

  // Guard & Security Portal (core role feature)
  'guard.portal.use': 'Utiliser le portail sécurité',
  'guard.visitors.manage': 'Gérer les visiteurs (check-in/out, pass)',
  'guard.visitors.approve': 'Approuver les invitations de visiteurs',
  'guard.pickup.release': 'Vérifier et libérer les élèves',
  'guard.incidents.manage': 'Signaler et gérer les incidents',
  'guard.evidence.read': 'Consulter la trace des accès et libérations',
  'guard.gates.manage': 'Configurer portes, postes, affectations',
  'guard.emergency.activate': 'Activer/terminer le mode urgence',

  // Receptionist Portal (front desk) — narrow operational set. Deliberately
  // excludes finance, admissions conversion, bulk messaging, grades, HR,
  // medical and safeguarding data (see receptionist-portal EXECUTION-PLAN §8).
  'reception.portal.use': 'Utiliser le portail accueil',
  'reception.lookup': 'Rechercher des personnes (projection limitée)',
  'reception.inquiry.create': 'Enregistrer et router des demandes de renseignements',
  'reception.inquiry.manage': 'Suivre et programmer le suivi des demandes',
  'reception.appointment.manage': 'Gérer les rendez-vous (planifier, pointer, clôturer)',
  'reception.handoff.manage': 'Gérer les transferts et tâches du front office',
  'reception.visitor.manage': 'Pointer les visiteurs et éditer les passes',
  'reception.pickup.release': 'Vérifier et libérer les élèves (autorisation explicite)',

  // Hostel Management Add-on
  'hostel.read': 'Consulter les résidences et le tableau d\'occupation',
  'hostel.manage': 'Gérer résidences, zones, catégories, chambres et lits',
  'hostel.allocation.read': 'Consulter les demandes et affectations',
  'hostel.allocation.manage': 'Réserver, affecter, transférer, enregistrer arrivée/sortie',
  'hostel.supervision.read': 'Consulter appels du soir, permissions de sortie et escalades',
  'hostel.supervision.manage': 'Enregistrer l\'appel du soir, les sorties/retours, les escalades',
  'hostel.safeguarding.read': 'Consulter les notes et motifs sensibles (protection)',
  'hostel.export': 'Exporter les données d\'internat',
  'hostel.policies.manage': 'Configurer les politiques d\'internat',

  // Inventory Management Add-on
  'inventory.read': 'Consulter l\'inventaire et les stocks',
  'inventory.catalog.manage': 'Gérer les produits, catégories, unités, magasins et fournisseurs',
  'inventory.purchase.manage': 'Gérer les achats et les réceptions',
  'inventory.sell': 'Enregistrer les ventes (caisse/boutique)',
  'inventory.issue.manage': 'Gérer les prêts, retours et sorties',
  'inventory.adjust.manage': 'Gérer les ajustements et transferts de stock',
  'inventory.export': 'Exporter les données inventaire et réconcilier',

  // Broadcast Messaging Add-on
  'broadcast.read': 'Consulter les audiences et campagnes',
  'broadcast.manage': 'Gérer les segments, modèles et campagnes',
  'broadcast.send': 'Envoyer des campagnes',
  'broadcast.connections.manage': 'Gérer les connexions de canaux',
  'broadcast.export': 'Exporter les rapports de diffusion',
  'broadcast.automations.manage': 'Gérer les automations de diffusion',

  // Library Management Add-on + Librarian Portal
  'library.catalog.read': 'Consulter le catalogue de la bibliothèque',
  'library.catalog.manage': 'Gérer le catalogue de la bibliothèque',
  'library.copy.manage': 'Gérer les exemplaires et leurs états',
  'library.circulation.operate': 'Opérer les prêts, retours et renouvellements',
  'library.circulation.override': 'Passer outre les blocages de prêt',
  'library.hold.manage': 'Gérer les réservations et files d\'attente',
  'library.stocktake.manage': 'Gérer les inventaires et comptages',
  'library.stocktake.approve': 'Approuver les ajustements d\'inventaire',
  'library.policy.manage': 'Gérer les politiques de prêt',
  'library.report.read': 'Consulter les rapports de bibliothèque',
  'library.charge.waive': 'Remettre (annuler) des frais de bibliothèque',

  // Live Classrooms Add-on
  // Naming uses the `live` module prefix because the addon id `live-classrooms`
  // contains a hyphen and cannot be a permission-key segment.
  'live.read': 'Consulter les classes virtuelles',
  'live.manage': 'Créer, modifier et annuler des classes virtuelles',
  'live.host': 'Animer (modérateur) une classe virtuelle',
  'live.join': 'Rejoindre une classe virtuelle',
  'live.attendance.read': 'Consulter les présences des classes virtuelles',
  'live.attendance.manage': 'Réconcilier et reporter les présences des classes virtuelles',
  'live.recordings.read': 'Consulter les enregistrements des classes virtuelles',
  'live.recordings.manage': 'Gérer les enregistrements (rétention, suppression)',
  'live.providers.manage': 'Gérer les fournisseurs de classes virtuelles',
  'live.reports.read': 'Consulter les rapports de classes virtuelles',
  'live.export': 'Exporter les rapports de classes virtuelles',

  // Student Transport Add-on
  'transport.read': 'Consulter le module transport',
  'transport.route.manage': 'Gérer les itinéraires et les arrêts',
  'transport.vehicle.manage': 'Gérer le parc de véhicules',
  'transport.driver.manage': 'Gérer les conducteurs et accompagnateurs',
  'transport.assignment.read': 'Consulter les affectations de transport élèves',
  'transport.assignment.manage': 'Gérer les affectations de transport élèves',
  'transport.trip.read': 'Consulter les trajets et feuille de route',
  'transport.trip.manage': 'Gérer les trajets et l\'état du service',
  'transport.boarding.manage': 'Enregistrer le pointage et la montée/descente des élèves',
  'transport.incident.read': 'Consulter les signalements d\'incidents de transport',
  'transport.incident.manage': 'Gérer et résoudre les incidents de transport',
  'transport.safeguarding.read': 'Consulter les notes sensibles et la protection des élèves',
  'transport.report': 'Consulter les rapports et l\'utilisation du transport',
  'transport.export': 'Exporter les données de transport',
  'transport.policy.manage': 'Gérer les politiques et règles de transport',

  // School Website CMS Add-on
  'website.read': 'Consulter le site web de l\'école',
  'website.theme.manage': 'Gérer le thème et l\'identité du site web',
  'website.pages.manage': 'Gérer les pages du site web',
  'website.menu.manage': 'Gérer le menu du site web',
  'website.news.manage': 'Gérer les actualités du site web',
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
    'content.manage',
    'cards.issue', // Exam coordinator / admit cards
    'certificates.issue',
    'events.read', 'events.create', 'events.manage_own', 'events.checkin',
    // Live Classrooms: teachers schedule/host/reconcile their assigned classes.
    'live.read', 'live.manage', 'live.host',
    'live.attendance.read', 'live.attendance.manage',
    'live.recordings.read', 'live.reports.read', 'live.export',
    // Transport
    'transport.read', 'transport.trip.read', 'transport.boarding.manage',
  ],
  accountant: [
    'students.read',
    'finance.read', 'finance.manage',
    'accounting.account.read', 'accounting.account.manage',
    'accounting.voucher.prepare', 'accounting.voucher.approve', 'accounting.voucher.post', 'accounting.voucher.reverse',
    'accounting.deposit.create', 'accounting.expense.prepare', 'accounting.expense.approve',
    'accounting.journal.create', 'accounting.period.close', 'accounting.reconcile',
    'accounting.statement.read', 'accounting.export',
    'reports.read', 'reports.export',
    'guardians.read',
    // Read-only payroll review only (maker/checker separation): accountant can
    // open the workforce hub and review calculated runs, but cannot calculate,
    // approve, or post (those stay school_admin). Matches the workforce page
    // guards which list 'accountant' in allowedRoles with payroll.review.
    'payroll.review',
    // hr.read/hr.manage deliberately excluded: full HR/payroll ownership isn't
    // part of the Accountant Portal's scope (future-implementation/accountant-portal).
    // Procurement is finance-adjacent: accountants view inventory and manage
    // purchase orders/receipts but not the shop (no inventory.sell).
    'inventory.read', 'inventory.purchase.manage',
  ],
  student: [
    'attendance.read',
    'grading.read',
    'academics.read',
    'events.read',
    // Live Classrooms: students join their own active-placement sessions.
    // The join route additionally enforces placement/roster membership.
    'live.join',
  ],
  parent: [
    'students.read',
    'attendance.read',
    'grading.read',
    'finance.read',
    'communication.read',
    'events.read',
    // Live Classrooms: parents join sessions for their child's active placement.
    'live.join',
  ],
  receptionist: [
    'students.read', 'students.create',
    'guardians.read', 'guardians.manage',
    'students.guardians.manage',
    // admissions.manage, communication.send and crm.manage were deliberately
    // removed from the receptionist default set (receptionist-portal spec:
    // "Do not implicitly grant admissions conversion / arbitrary bulk
    // messaging"). Read-only context (admissions.view, communication.read)
    // stays; admission conversion and campaign sends require a different role.
    'admissions.view',
    'communication.read',
    'cards.issue',
    'certificates.issue',
    'events.read', 'events.checkin',
    // Front-desk hostel ops: read occupancy, record roll call & leave passes.
    // Allocation commits stay school_admin-gated (hostel.allocation.manage).
    'hostel.read', 'hostel.allocation.read', 'hostel.supervision.read', 'hostel.supervision.manage',
    // Front-desk shop: view inventory and run counter sales (no catalog/admin).
    'inventory.read', 'inventory.sell',
    // Front-desk may view broadcast audiences/campaigns (no send/manage).
    'broadcast.read',
    // Front-desk transport: view assignments and incidents.
    'transport.read', 'transport.assignment.read', 'transport.incident.read',
    // Receptionist Portal — narrow operational set. release stays guard-owned
    // (reception.pickup.release is NOT here; grant via userPermissionOverrides).
    'reception.portal.use',
    'reception.lookup',
    'reception.inquiry.create', 'reception.inquiry.manage',
    'reception.appointment.manage',
    'reception.handoff.manage',
    'reception.visitor.manage',
  ],
  guard: [
    // Operational guard set. students.read/attendance.read/events.read are
    // deliberately absent: they are inert for this role (students/attendance
    // API allowlists already exclude guard) and would otherwise surface dead
    // directory links in the sidebar. events.checkin keeps the event duty.
    'guard.portal.use',
    'guard.visitors.manage',
    'guard.pickup.release',
    'guard.incidents.manage',
    'guard.evidence.read',
    'events.checkin',
    // Operational transport boarding & incidents
    'transport.read', 'transport.boarding.manage', 'transport.incident.manage',
  ],
  // Alumni self-service routes are entirely self-scoped (role='alumni' +
  // own userId) - no module capability needed, matches this app's "no
  // unnecessary permission growth" discipline (future-implementation/alumni-portal).
  alumni: [],
  librarian: [
    // Operational library set. Deliberately excludes catalog.manage,
    // circulation.override, stocktake.approve, policy.manage and charge.waive -
    // those stay school_admin-gated (grant explicitly per-librarian if needed).
    // No student/teacher/HR/finance/guardian/audit keys: the portal is confined
    // to its curated operational surface (blast-radius discipline).
    'library.catalog.read',
    'library.copy.manage',
    'library.circulation.operate',
    'library.hold.manage',
    'library.stocktake.manage',
    'library.report.read',
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
 * Guard: throws 403 if the user lacks all of the required permissions.
 * Used where a read-only "review" capability should unlock the same surface as
 * the broader read capability (e.g. grading.review alongside grading.read).
 */
export async function requireAnyCapability(
  context: RequestContext,
  permissions: readonly PermissionKey[],
): Promise<void> {
  if (!context.tenantId && context.role !== 'super_admin') {
    throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  }

  for (const permission of permissions) {
    const allowed = await hasCapability(
      context.userId,
      context.tenantId ?? '',
      context.role,
      permission,
    );
    if (allowed) return;
  }

  throw new ApiError(403, 'FORBIDDEN',
    `Permission manquante: ${permissions.map(p => PERMISSIONS[p] ?? p).join(' ou ')}`);
}

/**
 * Get all effective permissions for a user.
 */
export async function getEffectivePermissions(
  userId: string,
  tenantId: string,
  role: AppRole,
): Promise<Record<PermissionKey, boolean>> {
  // Resolve every key in parallel: sequential resolution is ~2 DB round-trips
  // per permission (user + role override lookups) and the full map runs into
  // the hundreds — serializing that made /api/portal/me take >7s.
  const entries = await Promise.all(
    ALL_PERMISSIONS.map(async (key) => [key, await hasCapability(userId, tenantId, role, key)] as const),
  );

  return Object.fromEntries(entries) as Record<PermissionKey, boolean>;
}

/**
 * Guard: throws 403 if the tenant does not have an allowed plan tier.
 */
export async function requirePlanTier(
  context: RequestContext,
  allowedTiers: Array<'trial' | 'basic' | 'standard' | 'premium'>,
): Promise<void> {
  if (!context.tenantId) {
    if (context.role === 'super_admin') return;
    throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  }
  
  const [tenant] = await db
    .select({ planTier: tenants.planTier })
    .from(tenants)
    .where(eq(tenants.id, context.tenantId))
    .limit(1);
    
  if (!tenant) {
    throw new ApiError(404, 'NOT_FOUND', 'Établissement introuvable.');
  }

  if (!allowedTiers.includes(tenant.planTier as any)) {
    throw new ApiError(403, 'FORBIDDEN', 'Votre abonnement actuel ne permet pas d\'utiliser cette fonctionnalité.');
  }
}
