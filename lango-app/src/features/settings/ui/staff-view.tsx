'use client';

import { AlertTriangle, Briefcase, Calculator, GraduationCap, MoreVertical, Search, Trash2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StaffMember = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  employeeId: string | null;
  specialization: string | null;
};

// /api/users returns the legacy French UI labels (models/userMapping.ts). Map
// them back to role/status codes so the screen can translate them. Kept local:
// userMapping imports the DB schema, which must not reach the client bundle.
const ROLE_CODE: Record<string, string> = {
  'Admin': 'school_admin',
  'Enseignant': 'teacher',
  'Comptable': 'accountant',
  'Tuteur': 'parent',
  'Élève': 'student',
  'Ancien(ne) élève': 'alumni',
  'Super Admin': 'super_admin',
  'Réceptionniste': 'receptionist',
  'Gardien': 'guard',
  'Bibliothécaire': 'librarian',
};
const STATUS_CODE: Record<string, string> = { 'Actif': 'active', 'Inactif': 'inactive', 'Archivé': 'archived', 'En attente': 'pending' };
const FILTER_ROLES = ['teacher', 'school_admin', 'accountant', 'receptionist', 'librarian', 'guard'] as const;

// "staff" = /api/users' non-student roster, minus guardians, students and
// alumni: those belong to the portals, not school personnel.
const NON_STAFF = new Set(['parent', 'student', 'alumni']);

export function StaffManagementView({ locale }: { locale: string }) {
  const t = useTranslations('StaffSettings');
  const tRoles = useTranslations('Roles');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const roleOf = (s: StaffMember) => ROLE_CODE[s.role] ?? s.role;
  const roleLabel = (code: string) => (tRoles.has(code) ? tRoles(code) : code);
  const statusLabel = (raw: string) => {
    const code = STATUS_CODE[raw] ?? raw;
    return t.has(`status.${code}`) ? t(`status.${code}` as 'status.active') : raw;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows: StaffMember[] = [];
      let page = 1;
      let total = 0;
      do {
        const res = await fetch(`/api/users?page=${page}&pageSize=100`);
        const json = await res.json();
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          throw new Error('load failed');
        }
        const batch = json.data as StaffMember[];
        if (batch.length === 0 && rows.length < Number(json.total)) {
          throw new Error('incomplete roster');
        }
        rows.push(...batch);
        total = Number(json.total);
        page += 1;
      } while (rows.length < total);
      setStaff(rows.filter(u => !NON_STAFF.has(ROLE_CODE[u.role] ?? u.role)));
      setError(null);
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // DELETE /api/users removes the login for good; it used to fire on one click
  // with no confirmation and no error if it failed.
  async function handleDelete(member: StaffMember) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('confirmDelete', { name: member.fullName }))) {
      return;
    }
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(member.id)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message ?? json?.message ?? t('deleteError'));
        return;
      }
      await load();
    } catch {
      setError(t('deleteError'));
    }
  }

  const filtered = staff.filter((s) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || s.fullName.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || s.phone.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'all' || roleOf(s) === roleFilter;
    return matchesSearch && matchesRole;
  });

  const teacherCount = staff.filter(s => roleOf(s) === 'teacher').length;
  const adminCount = staff.filter(s => roleOf(s) === 'school_admin').length;
  const accountantCount = staff.filter(s => roleOf(s) === 'accountant').length;

  const badgeCls = (code: string) =>
    code === 'teacher' ? 'bg-[#DCEBF4] text-[#1B6C93]' : code === 'school_admin' ? 'bg-sky-100 text-sky-800' : code === 'accountant' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700';

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('subtitle')}</p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="
            flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50
            p-3.5 text-xs font-semibold text-rose-700
          "
        >
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="
        grid grid-cols-1 gap-4
        sm:grid-cols-2
        lg:grid-cols-4
      "
      >
        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statTotal')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{staff.length}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-full bg-[#DCEBF4]
            text-[#1B6C93]
          "
          >
            <Users className="size-5" />
          </div>
        </Card>
        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statTeachers')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{teacherCount}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-full bg-[#DCEBF4]
            text-[#1B6C93]
          "
          >
            <GraduationCap className="size-5" />
          </div>
        </Card>
        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statAdmins')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{adminCount}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-full bg-[#FCF0DC]
            text-[#E8A33D]
          "
          >
            <Briefcase className="size-5" />
          </div>
        </Card>
        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statAccountants')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{accountantCount}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-full bg-purple-100
            text-purple-700
          "
          >
            <Calculator className="size-5" />
          </div>
        </Card>
      </div>

      <div className="
        flex flex-wrap items-center justify-between gap-3 rounded-2xl border
        border-slate-200/80 bg-white p-4 shadow-2xs
      "
      >
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="
              absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2
              text-slate-400
            "
            />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="h-9 rounded-full border-none bg-slate-50 ps-10 text-xs"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-[180px] rounded-full bg-white" aria-label={t('colRole')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allRoles')}</SelectItem>
              {FILTER_ROLES.map(r => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="
        overflow-hidden rounded-2xl border border-slate-200/80 bg-white
        shadow-2xs
      "
      >
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="
              border-b border-slate-200/80 bg-[#F6F9FC] font-semibold
              text-slate-500
            "
            >
              <tr>
                <th className="px-4 py-3 text-start">{t('colMember')}</th>
                <th className="px-4 py-3 text-start">{t('colRole')}</th>
                <th className="px-4 py-3 text-start">{t('colSpecialization')}</th>
                <th className="px-4 py-3 text-start">{t('colPhone')}</th>
                <th className="px-4 py-3 text-start">{t('colEmail')}</th>
                <th className="px-4 py-3 text-start">{t('colStatus')}</th>
                <th className="px-4 py-3 text-center">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((st) => {
                const code = roleOf(st);
                return (
                  <tr
                    key={st.id}
                    className="
                      transition-colors
                      hover:bg-slate-50/80
                    "
                  >
                    <td className="
                      px-4 py-3.5 font-bold whitespace-nowrap text-[#16212B]
                    "
                    >
                      {/* Only teachers have a profile page; other roles used to land on it too. */}
                      {code === 'teacher'
                        ? (
                            <Link
                              href={`/${locale}/dashboard/teachers/${st.id}`}
                              className="hover:text-[#2487B8] hover:underline"
                            >
                              {st.fullName}
                            </Link>
                          )
                        : st.fullName}
                      <p className="font-mono text-[10px] text-slate-400">{st.employeeId ?? st.id}</p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Badge className={badgeCls(code)}>{roleLabel(code)}</Badge>
                    </td>
                    <td className="
                      px-4 py-3.5 font-bold whitespace-nowrap text-slate-800
                    "
                    >
                      {st.specialization ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {st.phone
                        ? (
                            <a
                              href={`tel:${st.phone.replace(/\s+/g, '')}`}
                              dir="ltr"
                              className="
                                font-mono whitespace-nowrap text-slate-600
                                hover:text-[#2487B8] hover:underline
                              "
                            >
                              {st.phone}
                            </a>
                          )
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <a
                        href={`mailto:${st.email}`}
                        className="
                          whitespace-nowrap text-slate-600
                          hover:text-[#2487B8] hover:underline
                        "
                      >
                        {st.email}
                      </a>
                    </td>
                    <td className="
                      px-4 py-3.5 font-bold whitespace-nowrap text-[#2487B8]
                    "
                    >
                      {statusLabel(st.status)}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t('actionsFor', { name: st.fullName })}
                            className="
                              rounded-lg p-1.5 text-slate-400
                              hover:bg-slate-100
                            "
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => void handleDelete(st)}
                            className="
                              text-rose-600
                              focus:text-rose-600
                            "
                          >
                            <Trash2 className="me-2 size-3.5" />
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">{t('empty')}</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">{t('loading')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
