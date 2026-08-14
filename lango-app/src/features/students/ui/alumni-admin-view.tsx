'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, GraduationCap, Users } from 'lucide-react';

type AlumniRow = { id: string; name: string; email: string | null; alumniTransitionedAt: string | null; cohortName: string | null; directoryOptIn: boolean };

// Real staff-side alumni admin overview (future-implementation/alumni-portal),
// replacing the removed fake mock-data portals/alumni page.
export function AlumniAdminView({ locale }: { locale?: string } = {}) {
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/students/alumni?pageSize=100&search=${encodeURIComponent(search)}`)
      .then(r => r.json())
      .then(j => j?.success && setRows(j.data))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Anciens élèves</h1>
          <p className="text-xs text-slate-500 mt-1">{rows.length} ancien(ne)(s) élève(s) réel(le)s pour cet établissement.</p>
        </div>
        <Link href={`/${locale || 'fr'}/dashboard/students/alumni-transition`}>
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" />
            Transition en masse
          </Button>
        </Link>
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher un(e) ancien(ne) élève..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </Card>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-4">Nom</th>
              <th className="py-3.5 px-4">Promotion</th>
              <th className="py-3.5 px-4">Transition</th>
              <th className="py-3.5 px-4">Annuaire</th>
              <th className="py-3.5 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400">Aucun ancien élève pour le moment.</p>
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3 px-4 font-bold text-[#16212B]">{r.name}</td>
                <td className="py-3 px-4 text-slate-600">{r.cohortName ?? '—'}</td>
                <td className="py-3 px-4 text-slate-400">{r.alumniTransitionedAt?.slice(0, 10) ?? '—'}</td>
                <td className="py-3 px-4">
                  <Badge className={r.directoryOptIn ? 'bg-[#DDF5EC] text-[#17A673] border-none text-[10px]' : 'bg-slate-100 text-slate-500 border-none text-[10px]'}>
                    {r.directoryOptIn ? 'Opt-in' : 'Privé'}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <Link href={`/${locale || 'fr'}/dashboard/students/${r.id}`} className="text-[#2487B8] font-bold hover:underline">
                    Voir le profil
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
