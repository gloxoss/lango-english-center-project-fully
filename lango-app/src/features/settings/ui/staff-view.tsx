'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Users, GraduationCap, Briefcase, Calculator, Search, MoreVertical } from 'lucide-react';

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

// ponytail: "staff" = /api/users' non-student roster, minus guardians
// ('Tuteur') - that role belongs to the parent portal, not school personnel.
export function StaffManagementView({ locale }: { locale: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Tous');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/users?pageSize=200');
        const json = await res.json();
        if (json.success) {
          setStaff((json.data as StaffMember[]).filter(u => u.role !== 'Tuteur'));
        }
      } catch (err) {
        console.error('Failed to load staff', err);
      }
    }
    load();
  }, []);

  const filtered = staff.filter((s) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || s.fullName.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || s.phone.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'Tous' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const teacherCount = staff.filter(s => s.role === 'Enseignant').length;
  const adminCount = staff.filter(s => s.role === 'Admin').length;
  const accountantCount = staff.filter(s => s.role === 'Comptable').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Personnel</h1>
          <p className="text-xs text-slate-500 mt-1">Enseignants, personnel administratif et comptable de l'établissement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Total du personnel</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{staff.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Enseignants</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{teacherCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Personnel administratif</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{adminCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Comptables</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{accountantCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher un membre (nom, email, téléphone)..."
              className="pl-10 h-9 text-xs bg-slate-50 border-none rounded-full"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] rounded-full h-9 bg-white">
              <SelectValue placeholder="Rôle: Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tous">Rôle: Tous</SelectItem>
              <SelectItem value="Enseignant">Enseignant</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Comptable">Comptable</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Membre</th>
                <th className="py-3 px-4">Rôle</th>
                <th className="py-3 px-4">Spécialisation</th>
                <th className="py-3 px-4">Téléphone</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map(st => (
                <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#16212B] whitespace-nowrap">
                    <Link href={`/${locale}/dashboard/teachers/${st.id}`} className="hover:text-[#2487B8] hover:underline">
                      {st.fullName}
                    </Link>
                    <p className="text-[10px] text-slate-400 font-mono">{st.employeeId ?? st.id}</p>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <Badge className={st.role === 'Enseignant' ? 'bg-[#DCEBF4] text-[#1B6C93]' : st.role === 'Admin' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'}>
                      {st.role}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">{st.specialization ?? '—'}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <a href={`tel:${st.phone.replace(/\s+/g, '')}`} className="font-mono text-slate-600 hover:text-[#2487B8] hover:underline whitespace-nowrap">
                      {st.phone}
                    </a>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <a href={`mailto:${st.email}`} className="text-slate-600 hover:text-[#2487B8] hover:underline whitespace-nowrap">
                      {st.email}
                    </a>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#2487B8] whitespace-nowrap">{st.status}</td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Aucun membre du personnel trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
