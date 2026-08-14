// users-roles-client.tsx
// CLIENT ISLAND — owns search, filters, tab switching, invite modals, and role matrix mutation calls
'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Users, UserPlus, Shield, Key, Search, Plus, Filter, Edit, CheckCircle2,
  AlertTriangle, Lock, Eye, Mail, Building2, ChevronRight, MoreVertical,
  RefreshCw, Check, X, ShieldAlert, ArrowUpRight, ArrowRight
} from 'lucide-react';
import { ACCESS_SCOPES, MATRIX_MODULES, ROLE_CONFIG } from '@/features/settings/data/access-scopes-config';

export type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string | null;
  tfa: boolean;
  schoolName: string;
  accessScope: string;
};

export type AuditEvent = {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  timestamp: string;
};

// /api/users returns role/status as French UI labels; the table expects the raw
// role enum (ROLE_CONFIG keys). Reverse map so a refetch stays consistent.
const ROLE_LABEL_TO_ENUM: Record<string, string> = {
  'Super Admin': 'super_admin',
  'Admin': 'school_admin',
  'Enseignant': 'teacher',
  'Comptable': 'accountant',
  'Tuteur': 'parent',
  'Élève': 'student',
  'Ancien(ne) élève': 'alumni',
  'Réceptionniste': 'receptionist',
  'Gardien': 'guard',
  'Bibliothécaire': 'librarian',
};

function accessScopeForRole(role: string): string {
  if (role === 'super_admin' || role === 'school_admin' || role === 'accountant') return 'Toutes les classes';
  if (role === 'teacher') return 'Classes assignées';
  return 'Établissement';
}

type ApiUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string | null;
};

type Props = {
  initialUsers: UserItem[];
  initialMatrix: Record<string, Record<string, boolean>>;
  initialAuditEvents: AuditEvent[];
};

export function UsersRolesClient({ initialUsers, initialMatrix, initialAuditEvents }: Props) {
  const [activeTab, setActiveTab] = useState<'users' | 'matrix'>('users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(initialMatrix);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [auditEvents] = useState<AuditEvent[]>(initialAuditEvents);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('teacher');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');

  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>('school_admin');
  const [isPending, startTransition] = useTransition();

  // Filtered Users List
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                          u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Calculate Stat Summary Counts
  const activeCount = users.filter(u => u.status === 'Actif' || u.status === 'active').length;
  // The DB has no 'pending' status; "pending activation" honestly means a created
  // account that has never logged in.
  const pendingCount = users.filter(u => !u.lastLogin).length;
  const noTfaSensitiveCount = users.filter(u => !u.tfa && (u.role === 'school_admin' || u.role === 'accountant' || u.role === 'super_admin')).length;

  // Re-fetch the staff list after a successful invite so the table reflects the DB.
  async function refreshUsers() {
    try {
      const res = await fetch('/api/users?pageSize=200');
      const json = await res.json();
      if (!res.ok || !json.success) return;

      const fetched: UserItem[] = (json.data ?? []).map((u: ApiUser) => ({
        id: u.id,
        name: u.fullName || 'Utilisateur',
        email: u.email,
        role: ROLE_LABEL_TO_ENUM[u.role] ?? u.role,
        status: u.status,
        lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : null,
        tfa: false,
        schoolName: 'Établissement',
        accessScope: accessScopeForRole(ROLE_LABEL_TO_ENUM[u.role] ?? u.role),
      }));

      // Merge by id, preserving server-provided campus/scope/2FA for rows the API
      // does not carry (e.g. newly invited users get sensible defaults).
      setUsers(prev => {
        const merged = new Map(prev.map(u => [u.id, u]));
        for (const f of fetched) {
          const existing = merged.get(f.id);
          merged.set(f.id, {
            ...(existing ?? f),
            id: f.id,
            name: f.name,
            email: f.email,
            role: f.role,
            status: f.status,
            lastLogin: f.lastLogin,
          });
        }
        return Array.from(merged.values());
      });
    } catch (err) {
      console.error('Failed to refresh users after invite:', err);
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteStatus('idle');
    setInviteMessage('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: inviteEmail.split('@')[0] || 'Nouvel utilisateur',
          email: inviteEmail,
          phone: invitePhone || undefined,
          role: inviteRole,
          userStatus: 'active',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Erreur de création du compte');

      // The server returns the true invitation state; we mirror it instead of
      // claiming an SMS was sent. A user row alone is not a delivered invite.
      const delivery = json.invitation?.deliveryStatus;
      setInviteStatus('success');
      setInviteMessage(
        delivery === 'queued'
          ? 'Compte créé — lien d\'activation généré, SMS mis en file d\'attente.'
          : 'Compte créé — aucun numéro de téléphone fourni, aucun lien d\'activation généré. Ajoutez un téléphone puis régénérez l\'accès.',
      );
      void refreshUsers();
      setTimeout(() => {
        setInviteModalOpen(false);
        setInviteStatus('idle');
        setInviteMessage('');
        setInviteEmail('');
        setInvitePhone('');
      }, 2500);
    } catch {
      setInviteStatus('error');
    }
  }

  async function togglePermission(role: string, permKey: string, currentVal: boolean) {
    const newGranted = !currentVal;
    const previousVal = currentVal;
    // Optimistic update; rolled back below if the server rejects it.
    setMatrix(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permKey]: newGranted,
      },
    }));

    startTransition(async () => {
      let serverMessage: string | null = null;
      try {
        const res = await fetch('/api/settings/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            permission: permKey,
            granted: newGranted,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          serverMessage = body?.error?.message ?? 'Échec de la mise à jour de la permission.';
        }
      } catch {
        serverMessage = 'Erreur réseau lors de la mise à jour de la permission.';
      }

      if (serverMessage) {
        // Restore the previous value and surface the real server error.
        setMatrix(prev => ({
          ...prev,
          [role]: { ...prev[role], [permKey]: previousVal },
        }));
        setPermissionError(serverMessage);
      } else {
        setPermissionError(null);
      }
    });
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Utilisateurs, Rôles &amp; Périmètres d'accès</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Gestion centralisée des comptes, des règles d'habilitation et du périmètre de sécurité.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('matrix')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#4B6BFB]
              bg-[#F0F4FF] border border-[#C7D2FE] rounded-xl hover:bg-[#E0E8FF] transition-colors"
          >
            <Shield className="w-4 h-4 text-[#4B6BFB]" />
            Matrice des rôles
          </button>
          <button
            id="invite-user-btn"
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white
              bg-[#4B6BFB] rounded-xl hover:bg-[#3B5BDB] transition-all shadow-sm shadow-[#4B6BFB]/20"
          >
            <UserPlus className="w-4 h-4" />
            Inviter un utilisateur
          </button>
        </div>
      </div>

      {/* ── 4 Stat Cards Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Utilisateurs actifs</p>
            <p className="text-2xl font-bold text-[#111827]">{activeCount}</p>
            <p className="text-[11px] font-semibold text-emerald-600">Comptes opérationnels</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Rôles configurés</p>
            <p className="text-2xl font-bold text-[#111827]">{Object.keys(ROLE_CONFIG).length}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">Profils d'habilitation</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Activations en attente</p>
            <p className="text-2xl font-bold text-[#111827]">{pendingCount}</p>
            <p className="text-[11px] font-semibold text-amber-600">Comptes jamais connectés</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Accès sensibles sans 2FA</p>
            <p className="text-2xl font-bold text-[#111827]">{noTfaSensitiveCount}</p>
            <p className="text-[11px] font-semibold text-rose-600">Comptes admin &amp; finance</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Security Warning Banner ── */}
      {noTfaSensitiveCount > 0 && (
        <div className="flex items-center justify-between p-4 bg-amber-50/80 border border-amber-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-900">
                {noTfaSensitiveCount} compte(s) privilégié(s) (Admin/Finance) n'ont pas activé la 2FA
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Il est recommandé d'exiger l'authentification à deux facteurs pour protéger les données financières et sensibles.
              </p>
            </div>
          </div>
          <Link
            href="/fr/dashboard/settings/security"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800
              bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors whitespace-nowrap"
          >
            Renforcer la sécurité
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'users'
              ? 'bg-[#4B6BFB] text-white shadow-sm'
              : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'
          }`}
        >
          <Users className="w-4 h-4" />
          Utilisateurs &amp; Périmètres ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'matrix'
              ? 'bg-[#4B6BFB] text-white shadow-sm'
              : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'
          }`}
        >
          <Shield className="w-4 h-4" />
          Matrice des Rôles &amp; Permissions
        </button>
      </div>

      {/* ── TAB 1: Utilisateurs & Périmètres ── */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-6">

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl
                  text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#4B6BFB]/20"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#374151] focus:outline-none"
              >
                <option value="ALL">Tous les rôles</option>
                {Object.entries(ROLE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#374151] focus:outline-none"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="Actif">Actif</option>
                <option value="Inactif">Inactif</option>
                <option value="Archivé">Archivé</option>
              </select>
            </div>
          </div>

          {/* Main Users Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-3 px-4">Utilisateur</th>
                    <th className="py-3 px-4">Rôle</th>
                    <th className="py-3 px-4">Périmètre d'accès</th>
                    <th className="py-3 px-4">Établissement / Campus</th>
                    <th className="py-3 px-4">Dernière connexion</th>
                    <th className="py-3 px-4 text-center">2FA</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] font-medium text-[#374151]">
                  {filteredUsers.map(u => {
                    const roleCfg = ROLE_CONFIG[u.role] || { label: u.role, badgeColor: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={u.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#111827]">{u.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] font-mono">{u.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${roleCfg.badgeColor}`}>
                            {roleCfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F0F4FF] text-[#4B6BFB]">
                            {u.accessScope}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#6B7280]">{u.schoolName}</td>
                        <td className="py-3 px-4 text-[#9CA3AF] text-[11px]">{u.lastLogin || 'Jamais connecté'}</td>
                        <td className="py-3 px-4 text-center">
                          {u.tfa ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-[#D1D5DB]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            u.status === 'Actif' || u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : u.status === 'Inactif' || u.status === 'En attente' || u.status === 'pending'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button className="p-1 rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF]">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reference Cards: Périmètres d'Accès */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[#111827]">Guide des Périmètres d'Accès</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ACCESS_SCOPES.map(scope => (
                <div key={scope.id} className="bg-white p-4 rounded-2xl border border-[#E5E7EB] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${scope.color}`}>
                        {scope.badge}
                      </span>
                      <span className="text-[10px] font-mono text-[#9CA3AF]">{scope.code}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#111827]">{scope.title}</h3>
                    <p className="text-xs text-[#6B7280] mt-1">{scope.description}</p>
                  </div>
                  <div className="pt-2 border-t border-[#F3F4F6] text-[10px] text-[#9CA3AF]">
                    Rôles types : {scope.applicableRoles.map(r => ROLE_CONFIG[r]?.label || r).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed & Pending Invites Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Pending Invites Card */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-[#111827]">Activations en attente</h3>
                </div>
                <span className="text-xs text-[#9CA3AF]">{pendingCount} jamais connectés</span>
              </div>
              <div className="divide-y divide-[#F3F4F6]">
                {users.filter(u => !u.lastLogin).slice(0, 4).map(inv => (
                  <div key={inv.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">{inv.email}</p>
                      <p className="text-[11px] text-[#6B7280]">Rôle : {ROLE_CONFIG[inv.role]?.label || inv.role}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-[#9CA3AF]">Jamais connecté</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log Feed */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#4B6BFB]" />
                  <h3 className="text-sm font-semibold text-[#111827]">Journal d'activité récent</h3>
                </div>
                <Link href="/fr/dashboard/settings/audit-logs" className="text-xs text-[#4B6BFB] font-medium hover:underline">
                  Voir tout
                </Link>
              </div>
              <div className="space-y-3">
                {auditEvents.slice(0, 4).map(evt => (
                  <div key={evt.id} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-[#4B6BFB] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-[#111827] font-medium">
                        <span className="font-semibold">{evt.actorName}</span> a effectué une action{' '}
                        <span className="font-mono bg-[#F9FAFB] px-1 rounded text-[#4B6BFB]">{evt.action}</span> sur {evt.entityType}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5">{evt.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ── TAB 2: Matrice des Rôles & Permissions ── */}
      {activeTab === 'matrix' && (
        <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] space-y-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F4F6] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">Matrice globale des Permissions par Rôle</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Cliquez sur une case pour accorder ou révoquer dynamiquement une capacité pour un rôle donné.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280] font-medium">Rôle sélectionné :</span>
              <select
                value={selectedRoleForMatrix}
                onChange={e => setSelectedRoleForMatrix(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl font-semibold text-[#111827]"
              >
                {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'super_admin').map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {permissionError && (
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl mb-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {permissionError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                <tr>
                  <th className="py-3 px-4">Module / Capacité</th>
                  {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'super_admin').map(([roleKey, roleObj]) => (
                    <th key={roleKey} className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${roleObj.badgeColor}`}>
                        {roleObj.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] font-medium">
                {MATRIX_MODULES.map(mod => (
                  <React.Fragment key={mod.key}>
                    <tr className="bg-[#F9FAFB]/50">
                      <td colSpan={1 + Object.keys(ROLE_CONFIG).length - 1} className="py-2 px-4 text-xs font-bold text-[#111827] uppercase tracking-wider">
                        {mod.label}
                      </td>
                    </tr>
                    {mod.perms.map(permKey => (
                      <tr key={permKey} className="hover:bg-[#F9FAFB]">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[#374151] pl-8">
                          {permKey}
                        </td>
                        {Object.keys(ROLE_CONFIG).filter(k => k !== 'super_admin').map(roleKey => {
                          const isGranted = matrix[roleKey]?.[permKey] ?? false;
                          return (
                            <td key={roleKey} className="py-2.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => togglePermission(roleKey, permKey, isGranted)}
                                className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-all ${
                                  isGranted
                                    ? 'bg-[#4B6BFB] text-white shadow-xs'
                                    : 'bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#E5E7EB]'
                                }`}
                              >
                                {isGranted ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Inviter un Utilisateur ── */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111827]">Inviter un nouvel utilisateur</h3>
              <button onClick={() => setInviteModalOpen(false)} className="text-[#9CA3AF] hover:text-[#111827]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Adresse Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="nom@etablissement.ma"
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#4B6BFB]/20 focus:border-[#4B6BFB] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Téléphone (pour le lien d'activation)</label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={e => setInvitePhone(e.target.value)}
                  placeholder="06 61 22 33 44"
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
                />
                <p className="text-[10px] text-[#6B7280]">
                  Sans téléphone, le compte est créé sans lien d'activation (aucun SMS ne peut être envoyé).
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Rôle attribué *</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
                >
                  {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'super_admin').map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {inviteStatus === 'success' && (
                <p className="text-xs text-emerald-600 font-medium">{inviteMessage}</p>
              )}
              {inviteStatus === 'error' && (
                <p className="text-xs text-rose-600 font-medium">Erreur lors de la création du compte.</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F9FAFB] rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-xl shadow-xs"
                >
                  Envoyer l'invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
