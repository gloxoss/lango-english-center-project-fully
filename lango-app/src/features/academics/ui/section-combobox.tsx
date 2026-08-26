'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type SectionOption = { id: string; name: string };

export function SectionCombobox({ sections, value, onChange, onCreated, placeholder = 'Rechercher ou créer une section…' }: {
  sections: SectionOption[];
  value: string;
  onChange: (id: string) => void;
  onCreated?: (section: SectionOption) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const matches = useMemo(() => sections.filter(s => s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8), [query, sections]);
  const exact = sections.find(s => s.name.toLowerCase() === query.trim().toLowerCase());

  const create = async () => {
    const name = query.trim();
    if (!name || exact) return;
    setCreating(true);
    try {
      const response = await fetch('/api/academics/sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const json = await response.json();
      if (json.success) {
        onCreated?.(json.data);
        onChange(json.data.id);
        setQuery(json.data.name);
      }
    } finally { setCreating(false); }
  };

  return <div className="space-y-2">
    <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} className="h-9 rounded-xl" />
    <div className="max-h-36 overflow-auto rounded-xl border border-slate-200 bg-white p-1">
      {matches.map(section => <button type="button" key={section.id} onClick={() => { onChange(section.id); setQuery(section.name); }} className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs ${value === section.id ? 'bg-[#DCEBF4] font-bold text-[#1B6C93]' : 'hover:bg-slate-50'}`}>{section.name}</button>)}
      {query.trim() && !exact && <Button type="button" variant="ghost" size="sm" disabled={creating} onClick={create} className="w-full justify-start text-xs text-[#1B6C93]">{creating ? 'Création…' : `Créer « ${query.trim()} »`}</Button>}
      {!query.trim() && matches.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Saisissez un nom.</p>}
    </div>
  </div>;
}
