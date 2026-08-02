'use client';

import {
  BarChart3,
  Building2,
  CalendarCheck,
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
import React, { useState } from 'react';
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
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  subItems?: SubMenuItem[];
};

export function Sidebar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role || 'school_admin';
  const isSuperAdmin = userRole === 'super_admin';
  const roleLabel = ROLE_LABELS[userRole] ?? userRole;

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
    { label: 'Analytics & Croissance', href: `/${locale}/dashboard/analytics`, icon: BarChart3 },
    {
      label: 'Élèves & Profils',
      href: `/${locale}/dashboard/students`,
      icon: Users,
      subItems: [
        { label: 'Répertoire Élèves', href: `/${locale}/dashboard/students` },
        { label: 'Demandes Admission', href: `/${locale}/dashboard/students/admissions` },
        { label: '+ Inscrire un élève', href: `/${locale}/dashboard/students/add` },
        { label: 'Parents & Tuteurs', href: `/${locale}/dashboard/students/parents` },
        { label: 'Importer Élèves', href: `/${locale}/dashboard/students/import` },
        { label: 'Matricules & N°', href: `/${locale}/dashboard/students/matricules` },
        { label: 'Photos Élèves', href: `/${locale}/dashboard/students/photos` },
        { label: 'Transferts', href: `/${locale}/dashboard/students/transfers` },
        { label: 'Promotions', href: `/${locale}/dashboard/students/promotions` },
      ],
    },
    {
      label: 'Matières & Classes',
      href: `/${locale}/dashboard/academics/classes`,
      icon: GraduationCap,
      subItems: [
        { label: 'Classes', href: `/${locale}/dashboard/academics/classes` },
        { label: 'Mediums', href: `/${locale}/dashboard/academics/mediums` },
        { label: 'Sections', href: `/${locale}/dashboard/academics/sections` },
        { label: 'Matières', href: `/${locale}/dashboard/academics/subjects` },
        { label: 'Semestres', href: `/${locale}/dashboard/academics/semesters` },
        { label: 'Filières', href: `/${locale}/dashboard/academics/streams` },
        { label: 'Shifts', href: `/${locale}/dashboard/academics/shifts` },
        { label: 'Matières Optionnelles', href: `/${locale}/dashboard/academics/optional-subjects` },
      ],
    },
    {
      label: 'Corps Enseignant',
      href: `/${locale}/dashboard/teachers/manage`,
      icon: UserCheck,
      subItems: [
        { label: 'Gestion Enseignants', href: `/${locale}/dashboard/teachers/manage` },
        { label: 'Import Massif', href: `/${locale}/dashboard/teachers/bulk-import` },
      ],
    },
    {
      label: 'Présence',
      href: `/${locale}/dashboard/attendance`,
      icon: CalendarCheck,
      subItems: [
        { label: 'Présence Mobile', href: `/${locale}/dashboard/attendance` },
        { label: 'Justificatifs', href: `/${locale}/dashboard/attendance/excuses` },
        { label: 'Signalements', href: `/${locale}/dashboard/attendance/flags` },
        { label: 'Audit & Alertes', href: `/${locale}/dashboard/attendance/audit` },
      ],
    },
    { label: 'Mes Devoirs & Exercices', href: `/${locale}/dashboard/homework`, icon: FileText },
    {
      label: 'Finance & Invoicing',
      href: `/${locale}/dashboard/finance/invoices`,
      icon: CreditCard,
      subItems: [
        { label: 'Factures', href: `/${locale}/dashboard/finance/invoices` },
        { label: 'Enregistrer un paiement', href: `/${locale}/dashboard/finance/payments/new` },
        { label: 'Dépenses', href: `/${locale}/dashboard/finance/expenses` },
        { label: 'Structures tarifaires', href: `/${locale}/dashboard/finance/pricing` },
      ],
    },
    {
      label: 'SMS Communication',
      href: `/${locale}/dashboard/communication/reminders`,
      icon: MessageSquare,
      subItems: [
        { label: 'Envoyer des rappels', href: `/${locale}/dashboard/communication/reminders` },
        { label: 'Modèles de messages', href: `/${locale}/dashboard/communication/templates` },
      ],
    },
    { label: 'Bulletins Massar', href: `/${locale}/dashboard/documents/generator`, icon: FileText },
    {
      label: 'Paramètres École',
      href: `/${locale}/dashboard/settings`,
      icon: Settings,
      subItems: [
        { label: 'Paramètres Généraux', href: `/${locale}/dashboard/settings` },
        { label: 'Succursales & Campus', href: `/${locale}/dashboard/settings/branches` },
        { label: 'Gestion Utilisateurs', href: `/${locale}/dashboard/settings/users` },
        { label: 'Réinitialisation Accès', href: `/${locale}/dashboard/settings/access-reset` },
        { label: 'Statut CNDP F211', href: `/${locale}/dashboard/settings/cndp` },
      ],
    },
    { label: 'Statut CNDP F211', href: `/${locale}/dashboard/settings/cndp`, icon: ShieldCheck },
  ];

  const activeMenuLabel = schoolNavItems.find(item =>
    pathname === item.href
    || item.subItems?.some(sub =>
      pathname === sub.href || pathname.startsWith(`${sub.href}/`),
    ),
  )?.label;

  return (
    <aside className="
      flex min-h-screen w-64 shrink-0 flex-col justify-between border-r
      border-slate-200 bg-[#16212B] text-white
    "
    >
      <div className="max-h-screen overflow-y-auto">
        {/* Brand Header */}
        <div className="
          flex items-center justify-between border-b border-slate-800 p-5
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
              {schoolNavItems.map((item) => {
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
      <div className="space-y-3 border-t border-slate-800 bg-[#111A23] p-4">
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
