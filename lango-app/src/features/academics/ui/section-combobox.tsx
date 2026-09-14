'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';

export type SectionOption = { id: string; name: string };

export function SectionCombobox({
  sections,
  value,
  onChange,
  onCreated,
  placeholder = 'Sélectionner ou créer une section…',
}: {
  sections: SectionOption[];
  value: string;
  onChange: (id: string) => void;
  onCreated?: (section: SectionOption) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedSection = sections.find(s => s.id === value);
  const matches = useMemo(
    () => sections.filter(s => s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12),
    [query, sections]
  );
  const exact = sections.find(s => s.name.toLowerCase() === query.trim().toLowerCase());

  const create = async () => {
    const name = query.trim();
    if (!name || exact) return;
    setCreating(true);
    try {
      const response = await fetch('/api/academics/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await response.json();
      if (json.success) {
        onCreated?.(json.data);
        onChange(json.data.id);
        setQuery('');
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between rounded-xl border-slate-200 bg-white px-3 text-xs font-medium hover:bg-slate-50 transition"
        >
          <span className={selectedSection ? 'font-bold text-[#16212B]' : 'text-slate-400 font-normal'}>
            {selectedSection ? selectedSection.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 rounded-xl bg-white border border-slate-200 shadow-xl space-y-2 z-50" align="start">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher (ex: A, B...)"
            className="h-8 pl-8 text-xs rounded-lg bg-slate-50 border-slate-200"
          />
        </div>
        <div className="max-h-44 overflow-y-auto space-y-0.5">
          {matches.map(section => (
            <button
              type="button"
              key={section.id}
              onClick={() => {
                onChange(section.id);
                setOpen(false);
                setQuery('');
              }}
              className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                value === section.id ? 'bg-[#DCEBF4] font-bold text-[#1B6C93]' : 'hover:bg-slate-50 text-[#16212B]'
              }`}
            >
              <span>{section.name}</span>
              {value === section.id && <Check className="w-3.5 h-3.5 text-[#1B6C93]" />}
            </button>
          ))}
          {query.trim() && !exact && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={creating}
              onClick={create}
              className="w-full justify-start text-xs text-[#2487B8] hover:text-[#1B6C93] hover:bg-[#DCEBF4]/40 rounded-lg gap-1.5 mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {creating ? 'Création en cours…' : `Créer section « ${query.trim()} »`}
            </Button>
          )}
          {!query.trim() && matches.length === 0 && (
            <p className="px-2 py-2 text-center text-xs text-slate-400">Aucune section disponible.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

