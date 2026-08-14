// access-scopes-config.ts
// Static configuration for Access Scopes & Role Matrix modules
// Decoupled from JSX per Next.js App Structure Rule 3 (Content Separation).

export const ACCESS_SCOPES = [
  {
    id: 'all_classes',
    title: 'Toutes les classes',
    code: 'GLOBAL',
    description: "Accès complet à l'ensemble des niveaux, cycles et classes de l'établissement.",
    badge: 'Accès Global',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    applicableRoles: ['super_admin', 'school_admin', 'accountant'],
  },
  {
    id: 'assigned_classes',
    title: 'Classes assignées',
    code: 'RESTRICTED',
    description: "Accès uniquement aux élèves, présences et notes des classes directement attribuées.",
    badge: 'Accès Restreint',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    applicableRoles: ['teacher'],
  },
  {
    id: 'finance_only',
    title: 'Finances uniquement',
    code: 'FINANCE',
    description: "Accès exclusif aux encaissements, factures, frais de scolarité et rapports financiers.",
    badge: 'Accès Spécialisé',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    applicableRoles: ['accountant'],
  },
  {
    id: 'campus_main',
    title: 'Campus Principal',
    code: 'BRANCH',
    description: "Accès limité aux données et opérations du campus auquel l'utilisateur est rattaché.",
    badge: 'Accès Local',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    applicableRoles: ['receptionist', 'guard'],
  },
] as const;

export const MATRIX_MODULES = [
  { key: 'dashboard', label: 'Tableau de bord', perms: ['settings.read'] },
  { key: 'students', label: 'Élèves & Profils', perms: ['students.read', 'students.create', 'students.update', 'students.delete'] },
  { key: 'teachers', label: 'Corps Enseignant', perms: ['teachers.read', 'teachers.create', 'teachers.update', 'teachers.delete'] },
  { key: 'attendance', label: 'Présences & Absences', perms: ['attendance.read', 'attendance.manage'] },
  { key: 'academics', label: 'Matières & Classes', perms: ['academics.read', 'academics.manage'] },
  { key: 'finance', label: 'Finances & Facturation', perms: ['finance.read', 'finance.manage', 'finance.approve'] },
  { key: 'communication', label: 'Communication & SMS', perms: ['communication.read', 'communication.send'] },
  { key: 'grading', label: 'Examens & Bulletins', perms: ['grading.read', 'grading.manage'] },
  { key: 'reports', label: 'Rapports & Analytics', perms: ['reports.read', 'reports.export'] },
  { key: 'settings', label: 'Paramètres Établissement', perms: ['settings.organization.manage', 'settings.security.manage', 'users.permissions.manage'] },
] as const;

export const ROLE_CONFIG: Record<string, { label: string; badgeColor: string; description: string }> = {
  super_admin: { label: 'Super Admin', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200', description: 'Accès total sans restriction à tous les paramètres et données' },
  school_admin: { label: 'Directeur', badgeColor: 'bg-sky-100 text-sky-800 border-sky-200', description: "Gestion globale de l'établissement, du personnel et de la pédagogie" },
  teacher: { label: 'Enseignant', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200', description: 'Gestion des présences, notes et devoirs pour ses classes assignées' },
  accountant: { label: 'Comptable', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200', description: 'Gestion de la facturation, paiements, dépenses et comptabilité' },
  receptionist: { label: 'Réceptionniste', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200', description: 'Accueil des familles, inscriptions et communication de premier niveau' },
  guard: { label: 'Surveillant', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200', description: 'Contrôle des entrées/sorties et consultation des présences du jour' },
  librarian: { label: 'Bibliothécaire', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200', description: 'Gestion du catalogue, des prêts/retours et des réservations à la bibliothèque' },
  parent: { label: 'Parent / Tuteur', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200', description: 'Consultation du suivi scolaire et paiement en ligne des enfants' },
};
