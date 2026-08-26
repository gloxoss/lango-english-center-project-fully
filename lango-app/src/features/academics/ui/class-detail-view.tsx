'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, AlertCircle } from 'lucide-react';

type RosterStudent = {
  id: string;
  name: string;
  matricule: string | null;
  sectionName: string;
  attendanceRate: number | null;
  balanceDue: number | null;
  average: number | null;
};

export function ClassDetail360View({ id, locale }: { id: string; locale: string }) {
  const [className, setClassName] = useState('');
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/academics/classes/roster?id=${id}`)
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setClassName(json.data.className);
          setStudents(json.data.students);
        } else {
          setError(json.message || 'Classe introuvable.');
        }
      })
      .catch((err) => {
        console.error('Failed loading class roster', err);
        setError('Connexion impossible.');
      });
  }, [id]);

  const filtered = students.filter(s => s.name.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/dashboard/academics/classes`}>
          <button className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#2487B8]">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
          {className || 'Classe'}
        </h1>
        <Badge className="bg-[#DCEBF4] text-[#1B6C93] text-[10px]">{students.length} élève(s)</Badge>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher un élève..."
            className="pl-10 h-9 text-xs bg-slate-50 border-none rounded-full"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Élève</th>
                <th className="py-3 px-4">Matricule</th>
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4">Présence (30 j)</th>
                <th className="py-3 px-4">Solde dû</th>
                <th className="py-3 px-4">Moyenne générale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map(st => (
                <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-[#16212B]">
                    <Link href={`/${locale}/dashboard/students/${st.id}`} className="hover:text-[#2487B8] hover:underline">
                      {st.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">{st.matricule ?? '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{st.sectionName}</td>
                  <td className="py-3 px-4 font-bold text-[#2487B8]">{st.attendanceRate !== null ? `${st.attendanceRate}%` : '—'}</td>
                  <td className="py-3 px-4">
                    {st.balanceDue === null
                      ? '—'
                      : st.balanceDue > 0
                        ? <Badge className="bg-[#FCE4E2] text-[#E5544B]">{st.balanceDue.toLocaleString('fr-FR')} MAD</Badge>
                        : <Badge className="bg-[#DCEBF4] text-[#1B6C93]">À jour</Badge>}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-[#16212B]">{st.average !== null ? `${st.average} /20` : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Aucun élève trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
