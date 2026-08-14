'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Users, Mail, Phone, Briefcase } from 'lucide-react';

type Entry = { id: string; name: string | null; cohortName: string | null; currentEmployer: string | null; email: string | null; phone: string | null };

export default function AlumniDirectoryPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/alumni/directory?${params}`).then(r => r.json()).then(j => j?.success && setEntries(j.data));
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Annuaire</h1>
        <p className="text-xs text-slate-500 mt-1">Uniquement les anciens élèves ayant choisi d&apos;apparaître, avec les informations qu&apos;ils ont acceptées de partager.</p>
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher un nom..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries === null && <p className="text-xs text-slate-400">Chargement...</p>}
        {entries !== null && entries.length === 0 && (
          <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs col-span-full flex flex-col items-center justify-center gap-3 text-center">
            <Users className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Aucun ancien élève dans l&apos;annuaire pour le moment.</p>
          </Card>
        )}
        {entries?.map(e => (
          <Card key={e.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
            {e.name && <p className="text-sm font-extrabold text-[#16212B]">{e.name}</p>}
            {e.cohortName && <p className="text-[11px] text-slate-500">Promotion {e.cohortName}</p>}
            {e.currentEmployer && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Briefcase className="w-3 h-3" />{e.currentEmployer}</p>}
            {e.email && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{e.email}</p>}
            {e.phone && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{e.phone}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
