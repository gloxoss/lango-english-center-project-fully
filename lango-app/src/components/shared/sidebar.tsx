'use client';

import {
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { authClient } from '@/libs/auth-client';

// Local, not imported from models/Schema.ts (server-only, would pull drizzle
// pg-core into the client bundle for no reason). Matches src/models/userMapping.ts.
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'Administrateur École',
  teacher: 'Enseignant',
  accountant: 'Comptable',
  student: 'Élève',
  parent: 'Tuteur',
  receptionist: 'Réceptionniste',
  guard: 'Gardien',
};

type SubMenuItem = {
  label: string;
  href: string;
  /** Capability key from src/libs/api/permissions.ts. Undefined = always visible. */
  permission?: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Capability key from src/libs/api/permissions.ts. Undefined = always visible. */
  permission?: string;
  subItems?: SubMenuItem[];
};

export function Sidebar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role || 'school_admin';
  const isSuperAdmin = userRole === 'super_admin';
  const roleLabel = ROLE_LABELS[userRole] ?? userRole;

  // Capability-driven nav visibility (GET /api/me/permissions) - replaces the
  // earlier accountant-only hardcoded href check, which only stripped
  // Academics/Settings and left every other module fully visible.
  // null = not loaded yet (render nothing gated, avoid a flash of items the
  // user doesn't have); super_admin/school_admin get every permission from
  // the API itself (hasCapability short-circuits true for super_admin, and
  // school_admin's DEFAULT_ROLE_PERMISSIONS is ALL_PERMISSIONS), so this is
  // a no-op filter for them.
  const [myPermissions, setMyPermissions] = useState<Set<string> | null>(null);
  useEffect(() => {
    fetch('/api/me/permissions')
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setMyPermissions(new Set<string>(json.data.permissions));
        }
      })
      .catch(() => setMyPermissions(new Set()));
  }, []);
  const canSee = (permission?: string) => !permission || (myPermissions !== null && myPermissions.has(permission));

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'super-admin': true,
    'school-modules': true,
  });

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Super Admin Suite Navigation Items
  const superAdminNavItems: NavItem[] = [
    {
      label: 'Tableau de bord Super Admin',
      href: `/${locale}/dashboard/super-admin`,
      icon: LayoutDashboard,
    },
    {
      label: 'Écoles Clients',
      href: `/${locale}/dashboard/super-admin/schools`,
      icon: Building2,
      subItems: [
        { label: 'Toutes les écoles', href: `/${locale}/dashboard/super-admin/schools` },
        { label: '+ Créer une école', href: `/${locale}/dashboard/super-admin/schools/create` },
      ],
    },
    {
      label: 'Liste accès prioritaire',
      href: `/${locale}/dashboard/super-admin/waitlist`,
      icon: ClipboardList,
    },
    {
      label: 'Abonnements & Tarifs',
      href: `/${locale}/dashboard/super-admin/subscriptions`,
      icon: Package,
      subItems: [
        { label: 'Plans & Modules', href: `/${locale}/dashboard/super-admin/subscriptions` },
        { label: 'Gestion Abonnements', href: `/${locale}/dashboard/super-admin/subscriptions/list` },
      ],
    },
    {
      label: 'Consommation SMS',
      href: `/${locale}/dashboard/super-admin/sms`,
      icon: MessageSquare,
    },
    {
      label: 'Support & Incidents',
      href: `/${locale}/dashboard/super-admin/support`,
      icon: Headphones,
    },
    {
      label: 'Rapports Plateforme',
      href: `/${locale}/dashboard/super-admin/reports`,
      icon: BarChart3,
    },
    {
      label: 'Santé & Infrastructure',
      href: `/${locale}/dashboard/super-admin/settings`,
      icon: Server,
    },
  ];

  // School OS Standard Operational Navigation Items
  const schoolNavItems: NavItem[] = [
    { label: 'Tableau de bord École', href: `/${locale}/dashboard`, icon: LayoutDashboard },
    // Director-level cross-module dashboard (academic averages, HR presence,
    // institutional risk register) - confirmed via a live accountant session
    // that reports.read let it through and leaked grade averages. No single
    // existing capability maps to "director portal" cleanly; reusing
    // settings.organization.manage as the closest already-admin-only proxy
    // rather than inventing a new one for a single page.
    { label: 'Analytics & Croissance', href: `/${locale}/dashboard/analytics`, icon: BarChart3, permission: 'settings.organization.manage' },
    {
      label: 'Élèves & Profils',
      href: `/${locale}/dashboard/students`,
      icon: Users,
      permission: 'students.read',
      subItems: [
        { label: 'Répertoire Élèves', href: `/${locale}/dashboard/students`, permission: 'students.read' },
        { label: 'Demandes Admission', href: `/${locale}/dashboard/students/admissions`, permission: 'admissions.view' },
        { label: '+ Inscrire un élève', href: `/${locale}/dashboard/students/add`, permission: 'students.create' },
        { label: 'Parents & Tuteurs', href: `/${locale}/dashboard/students/parents`, permission: 'guardians.read' },
        { label: 'Importer Élèves', href: `/${locale}/dashboard/students/import`, permission: 'students.import' },
        { label: 'Matricules & N°', href: `/${locale}/dashboard/students/matricules`, permission: 'students.read' },
        { label: 'Photos Élèves', href: `/${locale}/dashboard/students/photos`, permission: 'students.read' },
        { label: 'Transferts', href: `/${locale}/dashboard/students/transfers`, permission: 'students.update' },
        { label: 'Promotions', href: `/${locale}/dashboard/students/promotions`, permission: 'students.placements.manage' },
      ],
    },
    {
      label: 'Matières & Classes',
      href: `/${locale}/dashboard/academics/classes`,
      icon: GraduationCap,
      permission: 'academics.read',
      subItems: [
        { label: 'Classes', href: `/${locale}/dashboard/academics/classes`, permission: 'academics.read' },
        { label: 'Mediums', href: `/${locale}/dashboard/academics/mediums`, permission: 'academics.read' },
        { label: 'Sections', href: `/${locale}/dashboard/academics/sections`, permission: 'academics.read' },
        { label: 'Matières', href: `/${locale}/dashboard/academics/subjects`, permission: 'academics.read' },
        { label: 'Semestres', href: `/${locale}/dashboard/academics/semesters`, permission: 'academics.read' },
        { label: 'Filières', href: `/${locale}/dashboard/academics/streams`, permission: 'academics.read' },
        { label: 'Shifts', href: `/${locale}/dashboard/academics/shifts`, permission: 'academics.read' },
        { label: 'Matières Optionnelles', href: `/${locale}/dashboard/academics/optional-subjects`, permission: 'academics.read' },
        { label: 'Banque de questions', href: `/${locale}/dashboard/academics/question-bank`, permission: 'academics.read' },
        { label: 'Emploi du temps', href: `/${locale}/dashboard/academics/schedule`, permission: 'academics.read' },
        { label: 'Emploi du temps enseignant', href: `/${locale}/dashboard/academics/teacher-schedule`, permission: 'academics.read' },
        { label: 'Conflits horaires', href: `/${locale}/dashboard/academics/conflicts`, permission: 'academics.read' },
        { label: 'Copie de Session', href: `/${locale}/dashboard/academics/session-copy`, permission: 'academics.manage' },
        { label: 'Espace d\'affectations', href: `/${locale}/dashboard/academics/assignments`, permission: 'academics.read' },
        { label: 'Promotion & Réinscription', href: `/${locale}/dashboard/academics/promotions`, permission: 'academics.manage' },
        { label: 'Bilan de Rentrée', href: `/${locale}/dashboard/academics/readiness`, permission: 'academics.read' },
      ],
    },

    {
      label: 'Corps Enseignant',
      href: `/${locale}/dashboard/teachers/manage`,
      icon: UserCheck,
      permission: 'teachers.read',
      subItems: [
        { label: 'Gestion Enseignants', href: `/${locale}/dashboard/teachers/manage`, permission: 'teachers.read' },
        { label: 'Import Massif', href: `/${locale}/dashboard/teachers/bulk-import`, permission: 'teachers.create' },
      ],
    },
    {
      label: 'Présence',
      href: `/${locale}/dashboard/attendance`,
      icon: CalendarCheck,
      permission: 'attendance.read',
      subItems: [
        { label: 'Présence Mobile', href: `/${locale}/dashboard/attendance`, permission: 'attendance.read' },
        { label: 'Justificatifs', href: `/${locale}/dashboard/attendance/excuses`, permission: 'attendance.read' },
        { label: 'Signalements', href: `/${locale}/dashboard/attendance/flags`, permission: 'attendance.read' },
        { label: 'Audit & Alertes', href: `/${locale}/dashboard/attendance/audit`, permission: 'attendance.read' },
      ],
    },
    { label: 'Mes Devoirs & Exercices', href: `/${locale}/dashboard/homework`, icon: FileText, permission: 'academics.read' },
    {
      label: 'Finance & Invoicing',
      href: `/${locale}/dashboard/finance`,
      icon: CreditCard,
      permission: 'finance.read',
      subItems: [
        { label: 'Tableau de bord Finance', href: `/${locale}/dashboard/finance`, permission: 'finance.read' },
        { label: 'Guichet de Caisse', href: `/${locale}/dashboard/finance/collection-desk`, permission: 'finance.read' },
        { label: 'Créances Élèves', href: `/${locale}/dashboard/finance/receivables`, permission: 'finance.read' },
        { label: 'Factures', href: `/${locale}/dashboard/finance/invoices`, permission: 'finance.read' },
        { label: 'Enregistrer un paiement', href: `/${locale}/dashboard/finance/payments/new`, permission: 'finance.read' },
        { label: 'Dépenses & Journal', href: `/${locale}/dashboard/finance/office-accounting`, permission: 'finance.read' },
        { label: 'Structures tarifaires', href: `/${locale}/dashboard/finance/pricing`, permission: 'finance.read' },
        { label: 'Approbations', href: `/${locale}/dashboard/finance/approvals`, permission: 'finance.read' },
        { label: 'Rapports & Exports', href: `/${locale}/dashboard/finance/reports`, permission: 'finance.read' },
      ],
    },
    {
      label: 'SMS Communication',
      href: `/${locale}/dashboard/communication/reminders`,
      icon: MessageSquare,
      permission: 'communication.read',
      subItems: [
        { label: 'Envoyer des rappels', href: `/${locale}/dashboard/communication/reminders`, permission: 'communication.send' },
        { label: 'Modèles de messages', href: `/${locale}/dashboard/communication/templates`, permission: 'communication.read' },
        { label: 'Pipeline CRM', href: `/${locale}/dashboard/communication/crm`, permission: 'crm.manage' },
        { label: 'Diffusion', href: `/${locale}/dashboard/communication/broadcast`, permission: 'communication.send' },
      ],
    },
    { label: 'Bulletins Massar', href: `/${locale}/dashboard/documents/generator`, icon: FileText, permission: 'grading.read' },
    {
      label: 'Paramètres École',
      href: `/${locale}/dashboard/settings`,
      icon: Settings,
      permission: 'settings.read',
      subItems: [
        { label: 'Paramètres Généraux', href: `/${locale}/dashboard/settings`, permission: 'settings.organization.manage' },
        { label: 'Migration & Démarrage', href: `/${locale}/dashboard/settings/migration`, permission: 'settings.read' },
        { label: 'Politiques Académiques', href: `/${locale}/dashboard/settings/policies`, permission: 'settings.read' },
        { label: 'Utilisateurs & Rôles', href: `/${locale}/dashboard/settings/users`, permission: 'users.manage' },
        { label: 'Sécurité & Sessions', href: `/${locale}/dashboard/settings/security`, permission: 'settings.security.manage' },
        { label: 'Connexions Externes', href: `/${locale}/dashboard/settings/providers`, permission: 'settings.read' },
        { label: 'Liaisons Comptables', href: `/${locale}/dashboard/settings/accounting-defaults`, permission: 'finance.manage' },
        { label: 'Traductions & Champs', href: `/${locale}/dashboard/settings/translations`, permission: 'settings.localization.manage' },
        { label: 'Tâches & Audit', href: `/${locale}/dashboard/settings/jobs`, permission: 'audit.read' },
        { label: 'Modules & Licences', href: `/${locale}/dashboard/settings/entitlements`, permission: 'settings.read' },
        { label: 'Registre des paramètres', href: `/${locale}/dashboard/settings/values`, permission: 'settings.read' },
        { label: 'Matrice des permissions', href: `/${locale}/dashboard/settings/permissions`, permission: 'users.permissions.manage' },
        { label: 'Boîte notifications', href: `/${locale}/dashboard/settings/notifications`, permission: 'settings.read' },
        { label: 'Exports & téléchargements', href: `/${locale}/dashboard/settings/exports`, permission: 'settings.read' },
        { label: 'Succursales & Campus', href: `/${locale}/dashboard/settings/branches`, permission: 'settings.organization.manage' },
        { label: 'Réinitialisation Accès', href: `/${locale}/dashboard/settings/access-reset`, permission: 'users.manage' },
        { label: 'Statut CNDP F211', href: `/${locale}/dashboard/settings/cndp`, permission: 'settings.read' },
      ],
    },
    { label: 'Statut CNDP F211', href: `/${locale}/dashboard/settings/cndp`, icon: ShieldCheck, permission: 'settings.read' },
  ];

  // Capability-driven: an item is visible if its own permission is granted,
  // AND (for parents with subItems) at least one child is visible too -
  // otherwise a parent like "Élèves & Profils" would show as a dead link
  // wrapping zero visible sub-pages once granular per-subitem gating narrows
  // it down further than the parent's own permission alone would.
  const visibleSchoolNavItems = schoolNavItems
    .filter(item => canSee(item.permission))
    .map(item => ({
      ...item,
      subItems: item.subItems ? item.subItems.filter(sub => canSee(sub.permission)) : undefined,
    }))
    .filter(item => item.subItems === undefined || item.subItems.length > 0);

  const activeMenuLabel = visibleSchoolNavItems.find(item =>
    pathname === item.href
    || item.subItems?.some(sub =>
      pathname === sub.href || pathname.startsWith(`${sub.href}/`),
    ),
  )?.label;

  return (
    <aside className="
      sticky top-0 flex h-dvh max-h-dvh w-64 shrink-0 flex-col overflow-hidden
      border-r border-slate-200 bg-[#16212B] text-white
    "
    >
      {/* Brand Header */}
      <div className="
        flex shrink-0 items-center justify-between border-b border-slate-800 p-5
      "
      >
        <div className="flex items-center gap-3">
          <div className="
            flex size-9 items-center justify-center rounded-xl bg-[#0066FF]
            text-base font-extrabold text-white shadow-sm
          "
          >
            S
          </div>
          <div>
            <h1 className="
              flex items-center text-base font-extrabold tracking-tight
              text-white
            "
            >
              School
              <span className="text-[#0066FF]">OS</span>
            </h1>
            <p className="text-[11px] font-medium text-slate-400">Plateforme Multi-tenant</p>
          </div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-sidebar-scroll
      >

        {/* Section 1: Super Admin Suite (Super Admin Role Only) */}
        {isSuperAdmin && (
          <div className="space-y-1 border-b border-slate-800/80 p-3">
            <div
              onClick={() => toggleMenu('super-admin')}
              className="
                flex cursor-pointer items-center justify-between px-3 py-1.5
                text-[11px] font-extrabold tracking-wider text-slate-400
                uppercase transition-colors
                hover:text-white
              "
            >
              <span className="flex items-center gap-1.5 text-[#0066FF]">
                <Sparkles className="size-3.5" />
                Plateforme Super Admin
              </span>
              {openMenus['super-admin']
                ? (
                    <ChevronDown className="size-3.5" />
                  )
                : (
                    <ChevronRight className="size-3.5" />
                  )}
            </div>

            {openMenus['super-admin'] && (
              <div className="space-y-0.5 pt-1">
                {superAdminNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== `/${locale}/dashboard/super-admin` && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isSubOpen = openMenus[item.label];

                  return (
                    <div key={item.href}>
                      <div className="flex items-center justify-between">
                        <Link
                          href={item.href}
                          className={`
                            flex flex-1 items-center gap-3 rounded-lg px-3 py-2
                            text-xs font-semibold transition-all
                            ${
                    isActive
                      ? 'bg-[#0066FF] font-bold text-white shadow-xs'
                      : `
                        text-slate-300
                        hover:bg-slate-800/60 hover:text-white
                      `
                    }
                          `}
                        >
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                        {hasSubItems && (
                          <button
                            onClick={() => toggleMenu(item.label)}
                            className="
                              p-2 text-slate-400
                              hover:text-white
                            "
                          >
                            {isSubOpen
                              ? <ChevronDown className="size-3" />
                              : (
                                  <ChevronRight className="size-3" />
                                )}
                          </button>
                        )}
                      </div>

                      {/* Submenu Items */}
                      {hasSubItems && isSubOpen && (
                        <div className="
                          my-1 ml-7 space-y-1 border-l border-slate-700/60 pl-2
                        "
                        >
                          {item.subItems?.map((sub) => {
                            const isSubActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={`
                                  block rounded-md px-2.5 py-1.5 text-[11px]
                                  font-medium transition-all
                                  ${
                              isSubActive
                                ? 'bg-[#0066FF]/10 font-bold text-[#0066FF]'
                                : `
                                  text-slate-400
                                  hover:bg-slate-800/40 hover:text-white
                                `
                              }
                                `}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Section 2: School OS Operational Modules */}
        <div className="space-y-1 p-3">
          <div
            onClick={() => toggleMenu('school-modules')}
            className="
              flex cursor-pointer items-center justify-between px-3 py-1.5
              text-[11px] font-extrabold tracking-wider text-slate-400 uppercase
              transition-colors
              hover:text-white
            "
          >
            <span>Modules Établissement</span>
            {openMenus['school-modules']
              ? (
                  <ChevronDown className="size-3.5" />
                )
              : (
                  <ChevronRight className="size-3.5" />
                )}
          </div>

          {openMenus['school-modules'] && (
            <div className="space-y-0.5 pt-1">
              {visibleSchoolNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isSubOpen = openMenus[item.label]
                  || activeMenuLabel === item.label;

                return (
                  <div key={item.href}>
                    <div className="flex items-center justify-between">
                      <Link
                        href={item.href}
                        className={`
                          flex flex-1 items-center gap-3 rounded-lg px-3 py-2
                          text-xs font-semibold transition-all
                          ${
                  isActive
                    ? 'bg-[#2487B8] font-bold text-white shadow-xs'
                    : `
                      text-slate-300
                      hover:bg-slate-800/60 hover:text-white
                    `
                  }
                        `}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                      {hasSubItems && (
                        <button
                          onClick={() => toggleMenu(item.label)}
                          className="
                            p-2 text-slate-400
                            hover:text-white
                          "
                        >
                          {isSubOpen
                            ? <ChevronDown className="size-3" />
                            : (
                                <ChevronRight className="size-3" />
                              )}
                        </button>
                      )}
                    </div>

                    {/* Submenu Items */}
                    {hasSubItems && isSubOpen && (
                      <div className="
                        my-1 ml-7 space-y-1 border-l border-slate-700/60 pl-2
                      "
                      >
                        {item.subItems?.map((sub) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={`
                                block rounded-md px-2.5 py-1.5 text-[11px]
                                font-medium transition-all
                                ${
                            isSubActive
                              ? 'bg-[#2487B8]/10 font-bold text-[#2487B8]'
                              : `
                                text-slate-400
                                hover:bg-slate-800/40 hover:text-white
                              `
                            }
                              `}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User Profile & Role Footer */}
      <div className="
        shrink-0 space-y-3 border-t border-slate-800 bg-[#111A23] p-4
        shadow-[0_-12px_28px_rgba(0,0,0,0.16)]
      "
      >
        <div className="
          flex items-center justify-between text-xs text-slate-300
        "
        >
          <span>Role Actif:</span>
          <span className="
            rounded-sm border border-[#2487B8]/40 bg-[#2487B8]/20 px-2 py-0.5
            text-[11px] font-bold text-[#2487B8]
          "
          >
            {roleLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            window.location.href = `/${locale}/login`;
          }}
          className="
            flex w-full cursor-pointer items-center justify-center gap-2
            rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5
            text-xs font-semibold text-red-400 transition-colors
            hover:bg-red-500/20
          "
        >
          <LogOut className="size-3.5" />
          {' '}
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
