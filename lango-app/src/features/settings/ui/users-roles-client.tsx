// users-roles-client.tsx
// CLIENT ISLAND — owns search, filters, tab switching, invite modals, and role matrix mutation calls
'use client';

import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit,
  Mail,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import React, { useEffect, useRef, useState, useTransition } from 'react';
import { ACCESS_SCOPES, MATRIX_MODULES, ROLE_CONFIG } from '@/features/settings/data/access-scopes-config';

export type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string | null;
  status: string;
  lastLogin: string | null;
  tfa: boolean;
  schoolName: string;
  accessScope: string;
};

export type InvitationItem = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expiresAt: string;
  createdAt: string;
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

// Scope ids, translated at render time (UsersRoles.scopes.*).
function accessScopeForRole(role: string): string {
  if (role === 'super_admin' || role === 'school_admin' || role === 'accountant') {
    return 'all_classes';
  }
  if (role === 'teacher') {
    return 'assigned_classes';
  }
  return 'school';
}

// /api/users and older rows carry French status labels; normalise to the enum.
const STATUS_LABEL_TO_ENUM: Record<string, string> = { 'Actif': 'active', 'Inactif': 'inactive', 'Archivé': 'archived', 'En attente': 'pending' };
const SCOPE_IDS = new Set(['all_classes', 'assigned_classes', 'finance_only', 'campus_main', 'school']);
const EDITABLE_ROLES = new Set(['school_admin', 'teacher', 'accountant', 'receptionist', 'librarian', 'guard']);

type ApiUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  branchId: string | null;
  status: string;
  lastLogin: string | null;
  tfaVerified: boolean;
};

type Props = {
  initialUsers: UserItem[];
  initialTotal: number;
  tenantName: string;
  branches: { id: string; name: string }[];
  currentUserId: string;
  branchRestricted: boolean;
  initialMatrix: Record<string, Record<string, boolean>>;
  initialAuditEvents: AuditEvent[];
};

export function UsersRolesClient({ initialUsers, initialTotal, tenantName, branches, currentUserId, branchRestricted, initialMatrix, initialAuditEvents }: Props) {
  const t = useTranslations('UsersRoles');
  const tRoles = useTranslations('Roles');
  const tPermissions = useTranslations('PermissionMatrix');
  const locale = useLocale();
  const dateLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const roleLabel = (key: string) => (tRoles.has(key) ? tRoles(key) : ROLE_CONFIG[key]?.label ?? key);
  const statusKey = (status: string) => STATUS_LABEL_TO_ENUM[status] ?? status;
  const statusLabel = (status: string) => (t.has(`status.${statusKey(status)}`) ? t(`status.${statusKey(status)}` as 'status.active') : status);
  const scopeLabel = (scope: string) => (SCOPE_IDS.has(scope) ? t(`scopes.${scope}.title` as 'scopes.school.title') : scope);
  const [activeTab, setActiveTab] = useState<'users' | 'invitations' | 'matrix'>('users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [totalUsers, setTotalUsers] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const firstFilterRef = useRef(true);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editBranchId, setEditBranchId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(initialMatrix);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [auditEvents] = useState<AuditEvent[]>(initialAuditEvents);

  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('teacher');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);

  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>('school_admin');
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (activeTab === 'invitations') {
      void fetchInvitations();
    }
  }, [activeTab]);

  useEffect(() => {
    if (firstFilterRef.current) {
      firstFilterRef.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (roleFilter !== 'ALL') {
        params.set('role', roleFilter);
      }
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      setLoadingUsers(true);
      setUsersError(null);
      try {
        const response = await fetch(`/api/users?${params}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error?.message ?? t('usersLoadError'));
        }
        setUsers(() => {
          return (result.data as ApiUser[]).map((row) => {
            const role = ROLE_LABEL_TO_ENUM[row.role] ?? row.role;
            const branchName = branches.find(branch => branch.id === row.branchId)?.name;
            return {
              id: row.id,
              name: row.fullName || row.email,
              email: row.email,
              role,
              branchId: row.branchId,
              status: statusKey(row.status),
              lastLogin: row.lastLogin ? new Date(row.lastLogin).toLocaleDateString(dateLocale) : null,
              tfa: row.tfaVerified,
              schoolName: branchName ?? tenantName,
              accessScope: branchName ?? accessScopeForRole(role),
            };
          });
        });
        setTotalUsers(result.total ?? 0);
      } catch (error) {
        if (!controller.signal.aborted) {
          setUsersError(error instanceof Error ? error.message : t('usersLoadError'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingUsers(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, roleFilter, statusFilter, page, branches, dateLocale, tenantName, t]);

  async function fetchInvitations() {
    try {
      setLoadingInvitations(true);
      const res = await fetch('/api/settings/invitations');
      const json = await res.json();
      if (res.ok && json.success) {
        setInvitations(json.data ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    } finally {
      setLoadingInvitations(false);
    }
  }

  async function handleRevokeInvitation(id: string) {
    try {
      const res = await fetch(`/api/settings/invitations/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        setInvitations(prev =>
          prev.map(inv => (inv.id === id ? { ...inv, status: 'revoked' } : inv)),
        );
      }
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
    }
  }

  function handleCopyInviteLink(token: string) {
    const url = `${window.location.origin}/invitations/${token}`;
    void navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(setCopiedToken, 2500, null);
  }

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase())
      || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || statusKey(u.status) === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Filtered Invitations List
  const filteredInvitations = invitations.filter((inv) => {
    const matchesSearch = inv.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || inv.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Calculate Stat Summary Counts
  const activeCount = users.filter(u => statusKey(u.status) === 'active').length;
  const pendingCount = users.filter(u => !u.lastLogin).length;
  const pendingInvitesCount = invitations.filter(i => i.status === 'pending').length;
  const noTfaSensitiveCount = users.filter(u => !u.tfa && (u.role === 'school_admin' || u.role === 'accountant' || u.role === 'super_admin')).length;

  function openEdit(userItem: UserItem) {
    setEditingUser(userItem);
    setEditName(userItem.name);
    setEditEmail(userItem.email);
    setEditRole(userItem.role);
    setEditStatus(statusKey(userItem.status));
    setEditBranchId(userItem.branchId ?? '');
    setEditError(null);
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser || savingUser) {
      return;
    }
    if (editingUser.id === currentUserId && editStatus !== 'active') {
      setEditError(t('selfDisableForbidden'));
      return;
    }
    // eslint-disable-next-line no-alert
    if (statusKey(editingUser.status) === 'active' && editStatus !== 'active' && !window.confirm(t('confirmDisable', { name: editingUser.name }))) {
      return;
    }
    setSavingUser(true);
    setEditError(null);
    try {
      const body = {
        id: editingUser.id,
        fullName: editName.trim(),
        email: editEmail.trim(),
        ...(EDITABLE_ROLES.has(editingUser.role) ? { role: editRole } : {}),
        status: editStatus,
        branchId: editBranchId || null,
      };
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? t('updateFailed'));
      }
      const nextRole = ROLE_LABEL_TO_ENUM[result.data.role] ?? result.data.role;
      const branchName = branches.find(branch => branch.id === result.data.branchId)?.name;
      setUsers(previous => previous.map(userItem => userItem.id === editingUser.id
        ? {
            ...userItem,
            name: result.data.fullName,
            email: result.data.email,
            role: nextRole,
            status: statusKey(result.data.status),
            branchId: result.data.branchId,
            schoolName: branchName ?? tenantName,
            accessScope: branchName ?? accessScopeForRole(nextRole),
          }
        : userItem));
      setEditingUser(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('updateFailed'));
    } finally {
      setSavingUser(false);
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) {
      return;
    }
    setInviteStatus('idle');
    setInviteMessage('');
    setGeneratedInviteUrl(null);
    try {
      const res = await fetch('/api/settings/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || t('inviteCreateError'));
      }

      const fullUrl = `${window.location.origin}/invitations/${json.data.token}`;
      setGeneratedInviteUrl(fullUrl);
      setInviteStatus('success');
      setInviteMessage(json.message || t('inviteCreated'));
      void fetchInvitations();
    } catch (err: any) {
      setInviteStatus('error');
      setInviteMessage(err?.message || t('inviteSendError'));
    }
  }

  async function togglePermission(role: string, permKey: string, currentVal: boolean) {
    // eslint-disable-next-line no-alert
    if (currentVal && !window.confirm(tPermissions('confirmRevoke', { role: roleLabel(role), permission: permKey }))) {
      return;
    }
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
            roleId: role,
            permissionId: permKey,
            granted: newGranted,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          serverMessage = body?.error?.message ?? t('permissionUpdateFailed');
        }
      } catch {
        serverMessage = t('permissionNetworkError');
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
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-20">

      {/* ── Top Header ── */}
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-xl font-bold text-[#111827]">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!branchRestricted && (
            <button
              onClick={() => setActiveTab('matrix')}
              className="
                flex items-center gap-2 rounded-xl border border-[#C7D2FE]
                bg-[#F0F4FF] px-3.5 py-2 text-xs font-semibold text-[#4B6BFB]
                transition-colors
                hover:bg-[#E0E8FF]
              "
            >
              <Shield className="size-4 text-[#4B6BFB]" />
              {t('roleMatrixButton')}
            </button>
          )}
          {!branchRestricted && (
            <button
              id="invite-user-btn"
              onClick={() => setInviteModalOpen(true)}
              className="
                flex items-center gap-2 rounded-xl bg-[#4B6BFB] px-4 py-2
                text-xs font-semibold text-white shadow-sm shadow-[#4B6BFB]/20
                transition-all
                hover:bg-[#3B5BDB]
              "
            >
              <UserPlus className="size-4" />
              {t('inviteUser')}
            </button>
          )}
        </div>
      </div>

      {/* ── 4 Stat Cards Band ── */}
      <div className="
        grid grid-cols-1 gap-4
        sm:grid-cols-2
        lg:grid-cols-4
      "
      >
        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statActiveUsers')}</p>
            <p className="text-2xl font-bold text-[#111827]">{activeCount}</p>
            <p className="text-[11px] font-semibold text-emerald-600">{t('statActiveUsersHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-[#F0F4FF]
            text-[#4B6BFB]
          "
          >
            <Users className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statRoles')}</p>
            <p className="text-2xl font-bold text-[#111827]">{Object.keys(ROLE_CONFIG).length}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">{t('statRolesHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-[#F0F4FF]
            text-[#4B6BFB]
          "
          >
            <Shield className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statPending')}</p>
            <p className="text-2xl font-bold text-[#111827]">{pendingCount}</p>
            <p className="text-[11px] font-semibold text-amber-600">{t('statPendingHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-amber-50
            text-amber-600
          "
          >
            <Mail className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statNoTfa')}</p>
            <p className="text-2xl font-bold text-[#111827]">{noTfaSensitiveCount}</p>
            <p className="text-[11px] font-semibold text-rose-600">{t('statNoTfaHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-rose-50
            text-rose-600
          "
          >
            <ShieldAlert className="size-5" />
          </div>
        </div>
      </div>

      {/* ── Security Warning Banner ── */}
      {noTfaSensitiveCount > 0 && (
        <div className="
          flex items-center justify-between rounded-2xl border border-amber-200
          bg-amber-50/80 p-4
        "
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-semibold text-amber-900">
                {t('noTfaWarning', { count: noTfaSensitiveCount })}
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                {t('noTfaAdvice')}
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}/dashboard/settings/security`}
            className="
              flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5
              text-xs font-semibold whitespace-nowrap text-amber-800
              transition-colors
              hover:bg-amber-200
            "
          >
            {t('strengthenSecurity')}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`
            flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold
            transition-all
            ${
    activeTab === 'users'
      ? 'bg-[#4B6BFB] text-white shadow-sm'
      : `
        text-[#6B7280]
        hover:bg-[#F9FAFB] hover:text-[#111827]
      `
    }
          `}
        >
          <Users className="size-4" />
          {t('tabUsers', { count: totalUsers })}
        </button>
        {!branchRestricted && (
          <>
            <button
              onClick={() => setActiveTab('invitations')}
              className={`
                flex items-center gap-2 rounded-xl px-4 py-2 text-xs
                font-semibold transition-all
                ${
          activeTab === 'invitations'
            ? 'bg-[#4B6BFB] text-white shadow-sm'
            : `
              text-[#6B7280]
              hover:bg-[#F9FAFB] hover:text-[#111827]
            `
          }
              `}
            >
              <Mail className="size-4" />
              {t('tabInvitations')}
              {' '}
              {pendingInvitesCount > 0 && (
                <span className="
                  rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold
                  text-amber-800
                "
                >
                  {pendingInvitesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`
                flex items-center gap-2 rounded-xl px-4 py-2 text-xs
                font-semibold transition-all
                ${
          activeTab === 'matrix'
            ? 'bg-[#4B6BFB] text-white shadow-sm'
            : `
              text-[#6B7280]
              hover:bg-[#F9FAFB] hover:text-[#111827]
            `
          }
              `}
            >
              <Shield className="size-4" />
              {t('tabMatrix')}
            </button>
          </>
        )}
      </div>

      {/* ── TAB 1: Utilisateurs & Périmètres ── */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-6">

          {/* Search & Filter Bar */}
          <div className="
            flex flex-col items-center justify-between gap-3 rounded-2xl border
            border-[#E5E7EB] bg-white p-4
            sm:flex-row
          "
          >
            <div className="
              relative w-full
              sm:w-80
            "
            >
              <Search className="
                absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9CA3AF]
              "
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('searchNameEmail')}
                className="
                  w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-2
                  pr-3 pl-9 text-xs text-[#111827]
                  placeholder:text-[#9CA3AF]
                  focus:ring-2 focus:ring-[#4B6BFB]/20 focus:outline-none
                "
              />
            </div>

            <div className="
              flex w-full items-center gap-3
              sm:w-auto
            "
            >
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="
                  rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs
                  text-[#374151]
                  focus:outline-none
                "
              >
                <option value="ALL">{t('allRoles')}</option>
                {Object.entries(ROLE_CONFIG).map(([k]) => (
                  <option key={k} value={k}>{roleLabel(k)}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="
                  rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs
                  text-[#374151]
                  focus:outline-none
                "
              >
                <option value="ALL">{t('allStatuses')}</option>
                <option value="active">{t('status.active')}</option>
                <option value="inactive">{t('status.inactive')}</option>
                <option value="archived">{t('status.archived')}</option>
              </select>
            </div>
          </div>

          {/* Main Users Table */}
          <div className="
            overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white
            shadow-2xs
          "
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="
                  border-b border-[#E5E7EB] bg-[#F9FAFB] font-semibold
                  text-[#6B7280]
                "
                >
                  <tr>
                    <th className="px-4 py-3">{t('colUser')}</th>
                    <th className="px-4 py-3">{t('colRole')}</th>
                    <th className="px-4 py-3">{t('colScope')}</th>
                    <th className="px-4 py-3">{t('colCampus')}</th>
                    <th className="px-4 py-3">{t('colLastLogin')}</th>
                    <th className="px-4 py-3 text-center">2FA</th>
                    <th className="px-4 py-3">{t('colStatus')}</th>
                    <th className="px-4 py-3 text-center">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="
                  divide-y divide-[#F3F4F6] font-medium text-[#374151]
                "
                >
                  {filteredUsers.map((u) => {
                    const roleCfg = ROLE_CONFIG[u.role] || { label: u.role, badgeColor: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr
                        key={u.id}
                        className="
                          transition-colors
                          hover:bg-[#F9FAFB]
                        "
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#111827]">{u.name}</p>
                          <p className="font-mono text-[11px] text-[#9CA3AF]">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`
                            inline-flex items-center rounded-full px-2.5 py-0.5
                            text-[11px] font-semibold
                            ${roleCfg.badgeColor}
                          `}
                          >
                            {roleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="
                            inline-flex items-center rounded-md bg-[#F0F4FF]
                            px-2 py-0.5 text-[11px] font-medium text-[#4B6BFB]
                          "
                          >
                            {scopeLabel(u.accessScope)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#6B7280]">{u.schoolName || t('school')}</td>
                        <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">{u.lastLogin || t('neverLoggedIn')}</td>
                        <td className="px-4 py-3 text-center">
                          {u.tfa
                            ? (
                                <CheckCircle2 className="
                                  mx-auto size-4 text-emerald-600
                                "
                                />
                              )
                            : (
                                <span className="text-[#D1D5DB]">—</span>
                              )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`
                            inline-flex items-center rounded-full px-2 py-0.5
                            text-[11px] font-semibold
                            ${
                      statusKey(u.status) === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : statusKey(u.status) === 'inactive' || statusKey(u.status) === 'pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }
                          `}
                          >
                            {statusLabel(u.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            aria-label={t('editUser', { name: u.name })}
                            className="
                              rounded-lg p-1 text-[#6B7280]
                              hover:bg-[#F3F4F6]
                            "
                          >
                            <Edit className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-sm text-[#6B7280]"
                      >
                        {loadingUsers ? t('loadingUsers') : t('noUsers')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {usersError && (
              <p
                role="alert"
                className="px-4 py-2 text-xs text-red-700"
              >
                {usersError}
              </p>
            )}
            <div className="
              flex flex-wrap items-center justify-between gap-3 border-t
              border-[#E5E7EB] px-4 py-3 text-xs text-[#6B7280]
            "
            >
              <span>{t('shownUsers', { shown: filteredUsers.length, total: totalUsers })}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loadingUsers}
                  onClick={() => setPage(value => value - 1)}
                  className="
                    rounded-lg border px-3 py-1
                    disabled:opacity-40
                  "
                >
                  {t('previousPage')}
                </button>
                <span>{t('pageOf', { page, pages: Math.max(1, Math.ceil(totalUsers / 50)) })}</span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(totalUsers / 50) || loadingUsers}
                  onClick={() => setPage(value => value + 1)}
                  className="
                    rounded-lg border px-3 py-1
                    disabled:opacity-40
                  "
                >
                  {t('nextPage')}
                </button>
              </div>
            </div>
          </div>

          {/* Reference Cards: Périmètres d'Accès */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[#111827]">{t('scopesGuide')}</h2>
            <div className="
              grid grid-cols-1 gap-4
              sm:grid-cols-2
              lg:grid-cols-4
            "
            >
              {ACCESS_SCOPES.map(scope => (
                <div
                  key={scope.id}
                  className="
                    flex flex-col justify-between space-y-3 rounded-2xl border
                    border-[#E5E7EB] bg-white p-4
                  "
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`
                        rounded-md border px-2 py-0.5 text-[10px] font-bold
                        ${scope.color}
                      `}
                      >
                        {t(`scopes.${scope.id}.badge` as 'scopes.school.badge')}
                      </span>
                      <span className="font-mono text-[10px] text-[#9CA3AF]">{scope.code}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#111827]">{t(`scopes.${scope.id}.title` as 'scopes.school.title')}</h3>
                    <p className="mt-1 text-xs text-[#6B7280]">{t(`scopes.${scope.id}.description` as 'scopes.school.description')}</p>
                  </div>
                  <div className="
                    border-t border-[#F3F4F6] pt-2 text-[10px] text-[#9CA3AF]
                  "
                  >
                    {t('typicalRoles', { roles: scope.applicableRoles.map(r => roleLabel(r)).join(', ') })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed & Pending Invites Grid */}
          <div className="
            grid grid-cols-1 gap-6
            lg:grid-cols-2
          "
          >

            {/* Pending Invites Card */}
            <div className="
              space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-5
            "
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-[#111827]">{t('statPending')}</h3>
                </div>
                <span className="text-xs text-[#9CA3AF]">{t('neverLoggedInCount', { count: pendingCount })}</span>
              </div>
              <div className="divide-y divide-[#F3F4F6]">
                {users.filter(u => !u.lastLogin).slice(0, 4).map(inv => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">{inv.email}</p>
                      <p className="text-[11px] text-[#6B7280]">{t('roleLine', { role: roleLabel(inv.role) })}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-[#9CA3AF]">{t('neverLoggedIn')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log Feed */}
            <div className="
              space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-5
            "
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-[#4B6BFB]" />
                  <h3 className="text-sm font-semibold text-[#111827]">{t('recentActivity')}</h3>
                </div>
                <Link
                  href={`/${locale}/dashboard/settings/audit-logs`}
                  className="
                    text-xs font-medium text-[#4B6BFB]
                    hover:underline
                  "
                >
                  {t('seeAll')}
                </Link>
              </div>
              <div className="space-y-3">
                {auditEvents.slice(0, 4).map(evt => (
                  <div key={evt.id} className="flex items-start gap-3 text-xs">
                    <div className="
                      mt-1.5 size-2 shrink-0 rounded-full bg-[#4B6BFB]
                    "
                    />
                    <div>
                      <p className="font-medium text-[#111827]">
                        <span className="font-semibold">{evt.actorName || t('system')}</span>
                        {' '}
                        {t('didAction')}
                        {' '}
                        <span className="
                          rounded-sm bg-[#F9FAFB] px-1 font-mono text-[#4B6BFB]
                        "
                        >
                          {evt.action}
                        </span>
                        {' '}
                        {t('onEntity', { entity: evt.entityType })}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{evt.timestamp || t('recently')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ── TAB 2: Invitations d'Équipe ── */}
      {activeTab === 'invitations' && (
        <div className="flex flex-col gap-6">
          <div className="
            flex flex-col items-center justify-between gap-3 rounded-2xl border
            border-[#E5E7EB] bg-white p-4 shadow-2xs
            sm:flex-row
          "
          >
            <div className="
              relative w-full
              sm:w-80
            "
            >
              <Search className="
                absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9CA3AF]
              "
              />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchEmail')}
                className="
                  w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-2
                  pr-3 pl-9 text-xs text-[#111827]
                  placeholder:text-[#9CA3AF]
                  focus:ring-2 focus:ring-[#4B6BFB]/20 focus:outline-none
                "
              />
            </div>

            <div className="
              flex w-full items-center gap-3
              sm:w-auto
            "
            >
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="
                  rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs
                  text-[#374151]
                  focus:outline-none
                "
              >
                <option value="ALL">{t('allRoles')}</option>
                {Object.entries(ROLE_CONFIG).map(([k]) => (
                  <option key={k} value={k}>{roleLabel(k)}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="
                  rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs
                  text-[#374151]
                  focus:outline-none
                "
              >
                <option value="ALL">Tous les statuts</option>
                <option value="pending">{t('invite.pending')}</option>
                <option value="accepted">{t('invite.accepted')}</option>
                <option value="revoked">{t('invite.revoked')}</option>
                <option value="expired">{t('invite.expired')}</option>
              </select>

              <button
                onClick={() => void fetchInvitations()}
                className="
                  rounded-xl border border-[#E5E7EB] p-2 text-[#6B7280]
                  hover:bg-[#F9FAFB] hover:text-[#111827]
                "
                title={t('refreshList')}
              >
                <RefreshCw className={`
                  size-4
                  ${loadingInvitations
          ? `animate-spin`
          : ''}
                `}
                />
              </button>
            </div>
          </div>

          <div className="
            overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white
            shadow-2xs
          "
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="
                  border-b border-[#E5E7EB] bg-[#F9FAFB] font-semibold
                  text-[#6B7280]
                "
                >
                  <tr>
                    <th className="px-4 py-3">{t('colInvitedEmail')}</th>
                    <th className="px-4 py-3">{t('colAssignedRole')}</th>
                    <th className="px-4 py-3">{t('colStatus')}</th>
                    <th className="px-4 py-3">{t('colExpiry')}</th>
                    <th className="px-4 py-3">{t('colInviteLink')}</th>
                    <th className="px-4 py-3 text-right">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {loadingInvitations
                    ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-slate-400"
                          >
                            {t('loadingInvitations')}
                          </td>
                        </tr>
                      )
                    : filteredInvitations.length === 0
                      ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-8 text-center text-slate-400"
                            >
                              {t('noInvitations')}
                            </td>
                          </tr>
                        )
                      : (
                          filteredInvitations.map((inv) => {
                            const isExpired = new Date(inv.expiresAt).getTime() < Date.now();
                            const effectiveStatus = inv.status === 'pending' && isExpired ? 'expired' : inv.status;

                            let statusBadge = (
                              <span className="
                                inline-flex items-center rounded-full border
                                border-amber-200 bg-amber-50 px-2 py-0.5
                                text-[10px] font-bold text-amber-700
                              "
                              >
                                <Clock className="mr-1 size-3" />
                                {' '}
                                {t('invite.pending')}
                              </span>
                            );
                            if (effectiveStatus === 'accepted') {
                              statusBadge = (
                                <span className="
                                  inline-flex items-center rounded-full border
                                  border-emerald-200 bg-emerald-50 px-2 py-0.5
                                  text-[10px] font-bold text-emerald-700
                                "
                                >
                                  <CheckCircle2 className="mr-1 size-3" />
                                  {' '}
                                  {t('invite.accepted')}
                                </span>
                              );
                            } else if (effectiveStatus === 'revoked') {
                              statusBadge = (
                                <span className="
                                  inline-flex items-center rounded-full border
                                  border-slate-200 bg-slate-100 px-2 py-0.5
                                  text-[10px] font-bold text-slate-700
                                "
                                >
                                  <X className="mr-1 size-3" />
                                  {' '}
                                  {t('invite.revoked')}
                                </span>
                              );
                            } else if (effectiveStatus === 'expired') {
                              statusBadge = (
                                <span className="
                                  inline-flex items-center rounded-full border
                                  border-rose-200 bg-rose-50 px-2 py-0.5
                                  text-[10px] font-bold text-rose-700
                                "
                                >
                                  <AlertTriangle className="mr-1 size-3" />
                                  {' '}
                                  {t('invite.expired')}
                                </span>
                              );
                            }

                            return (
                              <tr key={inv.id} className="hover:bg-[#F9FAFB]">
                                <td className="
                                  px-4 py-3 font-semibold text-[#111827]
                                "
                                >
                                  <div className="flex items-center gap-2">
                                    <Mail className="size-3.5 text-slate-400" />
                                    <span>{inv.email}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="
                                    inline-flex items-center rounded-full
                                    bg-[#E4EDFD] px-2 py-0.5 text-[10px]
                                    font-bold text-[#2487B8]
                                  "
                                  >
                                    {roleLabel(inv.role)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">{statusBadge}</td>
                                <td className="
                                  px-4 py-3 text-[11px] text-[#6B7280]
                                "
                                >
                                  {new Date(inv.expiresAt).toLocaleDateString(dateLocale, {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="px-4 py-3">
                                  {effectiveStatus === 'pending'
                                    ? (
                                        <button
                                          type="button"
                                          onClick={() => handleCopyInviteLink(inv.token)}
                                          className="
                                            inline-flex cursor-pointer
                                            items-center gap-1 rounded-lg border
                                            border-blue-100 bg-blue-50 px-2.5
                                            py-1 text-[11px] font-semibold
                                            text-[#0066FF] transition-colors
                                            hover:text-[#0052CC]
                                          "
                                        >
                                          {copiedToken === inv.token
                                            ? (
                                                <>
                                                  <Check className="
                                                    size-3 text-emerald-600
                                                  "
                                                  />
                                                  <span className="
                                                    font-bold text-emerald-700
                                                  "
                                                  >
                                                    {t('copied')}
                                                  </span>
                                                </>
                                              )
                                            : (
                                                <>
                                                  <Copy className="size-3" />
                                                  <span>{t('copyLink')}</span>
                                                </>
                                              )}
                                        </button>
                                      )
                                    : (
                                        <span className="
                                          text-[11px] text-slate-400
                                        "
                                        >
                                          —
                                        </span>
                                      )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {effectiveStatus === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => void handleRevokeInvitation(inv.id)}
                                      className="
                                        inline-flex items-center gap-1
                                        rounded-sm p-1 text-[11px] font-bold
                                        text-rose-600 transition-colors
                                        hover:bg-rose-50 hover:text-rose-800
                                      "
                                    >
                                      <Trash2 className="size-3" />
                                      <span>{t('revoke')}</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Matrice des Rôles & Permissions ── */}
      {activeTab === 'matrix' && (
        <div className="
          space-y-6 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xs
        "
        >
          <div className="
            flex flex-col justify-between gap-4 border-b border-[#F3F4F6] pb-4
            sm:flex-row sm:items-center
          "
          >
            <div>
              <h2 className="text-base font-bold text-[#111827]">{t('matrixTitle')}</h2>
              <p className="mt-0.5 text-xs text-[#6B7280]">
                {t('matrixHint')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#6B7280]">{t('selectedRole')}</span>
              <select
                value={selectedRoleForMatrix}
                onChange={e => setSelectedRoleForMatrix(e.target.value)}
                className="
                  rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5
                  text-xs font-semibold text-[#111827]
                "
              >
                {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'super_admin').map(([k]) => (
                  <option key={k} value={k}>{roleLabel(k)}</option>
                ))}
              </select>
            </div>
          </div>

          {permissionError && (
            <div className="
              mb-3 flex items-center gap-2 rounded-xl border border-rose-200
              bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700
            "
            >
              <AlertTriangle className="size-4 shrink-0" />
              {permissionError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="
                border-b border-[#E5E7EB] bg-[#F9FAFB] font-semibold
                text-[#6B7280]
              "
              >
                <tr>
                  <th className="px-4 py-3">{t('colModuleCapability')}</th>
                  {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'super_admin').map(([roleKey, roleObj]) => (
                    <th key={roleKey} className="px-4 py-3 text-center">
                      <span className={`
                        inline-flex items-center rounded-full px-2 py-0.5
                        text-[10px] font-bold
                        ${roleObj.badgeColor}
                      `}
                      >
                        {roleLabel(roleKey)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] font-medium">
                {MATRIX_MODULES.map(mod => (
                  <React.Fragment key={mod.key}>
                    <tr className="bg-[#F9FAFB]/50">
                      <td
                        colSpan={1 + Object.keys(ROLE_CONFIG).length - 1}
                        className="
                          px-4 py-2 text-xs font-bold tracking-wider
                          text-[#111827] uppercase
                        "
                      >
                        {t.has(`modules.${mod.key}`) ? t(`modules.${mod.key}` as 'modules.dashboard') : mod.label}
                      </td>
                    </tr>
                    {mod.perms.map(permKey => (
                      <tr key={permKey} className="hover:bg-[#F9FAFB]">
                        <td className="
                          px-4 py-2.5 pl-8 font-mono text-[11px] text-[#374151]
                        "
                        >
                          {permKey}
                        </td>
                        {Object.keys(ROLE_CONFIG).filter(k => k !== 'super_admin').map((roleKey) => {
                          const isGranted = matrix[roleKey]?.[permKey] ?? false;
                          return (
                            <td
                              key={roleKey}
                              className="px-4 py-2.5 text-center"
                            >
                              <button
                                type="button"
                                onClick={() => togglePermission(roleKey, permKey, isGranted)}
                                className={`
                                  inline-flex size-6 items-center justify-center
                                  rounded-md transition-all
                                  ${
                            isGranted
                              ? 'bg-[#4B6BFB] text-white shadow-xs'
                              : `
                                bg-[#F3F4F6] text-[#9CA3AF]
                                hover:bg-[#E5E7EB]
                              `
                            }
                                `}
                              >
                                {isGranted
                                  ? <Check className="size-3.5" />
                                  : (
                                      <X className="size-3.5" />
                                    )}
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
      {editingUser && (
        <div
          className="
            fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4
          "
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
        >
          <form
            onSubmit={saveUser}
            className="
              w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl
            "
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="edit-user-title"
                className="text-lg font-bold text-[#111827]"
              >
                {t('editUserTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label={t('close')}
                className="
                  rounded-lg p-1 text-[#6B7280]
                  hover:bg-gray-100
                "
              >
                <X className="size-5" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-[#374151]">
              {t('editName')}
              <input
                required
                minLength={2}
                maxLength={255}
                value={editName}
                onChange={event => setEditName(event.target.value)}
                className="
                  mt-1 w-full rounded-lg border border-gray-300 px-3 py-2
                  text-sm
                "
              />
            </label>
            <label className="block text-xs font-semibold text-[#374151]">
              {t('editEmail')}
              <input
                required
                type="email"
                maxLength={255}
                value={editEmail}
                onChange={event => setEditEmail(event.target.value)}
                className="
                  mt-1 w-full rounded-lg border border-gray-300 px-3 py-2
                  text-sm
                "
              />
            </label>
            <label className="block text-xs font-semibold text-[#374151]">
              {t('editRole')}
              <select
                disabled={!EDITABLE_ROLES.has(editingUser.role) || editingUser.id === currentUserId}
                value={editRole}
                onChange={event => setEditRole(event.target.value)}
                className="
                  mt-1 w-full rounded-lg border border-gray-300 px-3 py-2
                  text-sm
                  disabled:bg-gray-100
                "
              >
                {EDITABLE_ROLES.has(editingUser.role) ? [...EDITABLE_ROLES].map(role => <option key={role} value={role}>{roleLabel(role)}</option>) : <option value={editingUser.role}>{roleLabel(editingUser.role)}</option>}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#374151]">
              {t('editStatus')}
              <select
                value={editStatus}
                onChange={event => setEditStatus(event.target.value)}
                className="
                  mt-1 w-full rounded-lg border border-gray-300 px-3 py-2
                  text-sm
                "
              >
                <option value="active">{t('status.active')}</option>
                <option value="inactive" disabled={editingUser.id === currentUserId}>{t('status.inactive')}</option>
                {editStatus === 'archived' && <option value="archived" disabled>{t('status.archived')}</option>}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#374151]">
              {t('editBranch')}
              <select
                disabled={editingUser.id === currentUserId}
                value={editBranchId}
                onChange={event => setEditBranchId(event.target.value)}
                className="
                  mt-1 w-full rounded-lg border border-gray-300 px-3 py-2
                  text-sm
                  disabled:bg-gray-100
                "
              >
                {!branchRestricted && <option value="">{t('tenantWide')}</option>}
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            {editError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-2 text-xs text-red-700"
              >
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-700"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={savingUser}
                className="
                  rounded-lg bg-[#2487B8] px-4 py-2 text-sm font-semibold
                  text-white
                  disabled:opacity-50
                "
              >
                {savingUser ? t('savingUser') : t('saveUser')}
              </button>
            </div>
          </form>
        </div>
      )}

      {inviteModalOpen && (
        <div className="
          fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4
          backdrop-blur-xs
        "
        >
          <div className="
            w-full max-w-md space-y-4 rounded-2xl border border-[#E5E7EB]
            bg-white p-6 shadow-xl
          "
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111827]">{t('inviteModalTitle')}</h3>
              <button
                onClick={() => {
                  setInviteModalOpen(false);
                  setGeneratedInviteUrl(null);
                  setInviteStatus('idle');
                  setInviteMessage('');
                }}
                className="
                  text-[#9CA3AF]
                  hover:text-[#111827]
                "
              >
                <X className="size-5" />
              </button>
            </div>

            {generatedInviteUrl
              ? (
                  <div className="space-y-4 py-2">
                    <div className="
                      space-y-2 rounded-2xl border border-emerald-200
                      bg-emerald-50 p-4
                    "
                    >
                      <div className="
                        flex items-center gap-2 text-xs font-bold
                        text-emerald-800
                      "
                      >
                        <CheckCircle2 className="
                          size-4 shrink-0 text-emerald-600
                        "
                        />
                        <span>{t('inviteCreated')}</span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        {t('inviteLinkHint')}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#374151]">{t('activationLink')}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatedInviteUrl}
                          className="
                            w-full rounded-xl border border-slate-200
                            bg-slate-50 px-3 py-2 font-mono text-xs
                            text-[#111827] outline-none
                          "
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(generatedInviteUrl);
                            setInviteMessage(t('linkCopied'));
                          }}
                          className="
                            flex shrink-0 cursor-pointer items-center gap-1.5
                            rounded-xl bg-[#0066FF] px-3 py-2 text-xs font-bold
                            text-white shadow-xs
                            hover:bg-[#0052CC]
                          "
                        >
                          <Copy className="size-3.5" />
                          <span>{t('copy')}</span>
                        </button>
                      </div>
                      {inviteMessage && (
                        <p className="
                          text-[11px] font-semibold text-emerald-600
                        "
                        >
                          {inviteMessage}
                        </p>
                      )}
                    </div>

                    <div className="
                      flex items-center justify-end gap-2 border-t
                      border-slate-100 pt-2
                    "
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setGeneratedInviteUrl(null);
                          setInviteStatus('idle');
                          setInviteMessage('');
                          setInviteEmail('');
                        }}
                        className="
                          rounded-xl px-4 py-2 text-xs font-semibold
                          text-[#0066FF]
                          hover:bg-blue-50
                        "
                      >
                        {t('inviteAnother')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInviteModalOpen(false);
                          setGeneratedInviteUrl(null);
                          setInviteStatus('idle');
                          setInviteMessage('');
                          setInviteEmail('');
                        }}
                        className="
                          rounded-xl bg-[#16212B] px-4 py-2 text-xs
                          font-semibold text-white shadow-xs
                          hover:bg-slate-800
                        "
                      >
                        {t('close')}
                      </button>
                    </div>
                  </div>
                )
              : (
                  <form onSubmit={handleSendInvite} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[#374151]">{t('workEmail')}</label>
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder={t('emailPlaceholder')}
                        className="
                          rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                          text-xs text-[#111827] outline-none
                          focus:border-[#4B6BFB] focus:ring-2
                          focus:ring-[#4B6BFB]/20
                        "
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[#374151]">{t('assignedRoleRequired')}</label>
                      <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value)}
                        className="
                          rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                          text-xs text-[#111827] outline-none
                        "
                      >
                        {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'super_admin').map(([k]) => (
                          <option key={k} value={k}>{roleLabel(k)}</option>
                        ))}
                      </select>
                    </div>

                    {inviteStatus === 'error' && (
                      <p className="text-xs font-medium text-rose-600">{inviteMessage}</p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setInviteModalOpen(false)}
                        className="
                          rounded-xl px-4 py-2 text-xs font-semibold
                          text-[#6B7280]
                          hover:bg-[#F9FAFB]
                        "
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="submit"
                        className="
                          flex cursor-pointer items-center gap-1.5 rounded-xl
                          bg-[#0066FF] px-4 py-2 text-xs font-semibold
                          text-white shadow-xs
                          hover:bg-[#0052CC]
                        "
                      >
                        <Send className="size-3.5" />
                        <span>{t('generateInvite')}</span>
                      </button>
                    </div>
                  </form>
                )}
          </div>
        </div>
      )}

    </div>
  );
}
