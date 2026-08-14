'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Search, SearchX } from 'lucide-react';
import { api, type LookupResult } from './reception-api';

const TYPE_LABELS: Record<string, string> = { student: 'Élève', guardian: 'Parent / Tuteur', parent: 'Parent (compte)' };

export function ReceptionLookupPanel() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LookupResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) {
      setMessage('Saisissez au moins 3 caractères (ou le matricule exact).');
      setResults(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await api<LookupResult[]>(`/api/reception/lookup?q=${encodeURIComponent(term)}`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setResults(res.data);
      if (res.data.length === 0) setMessage('Aucune personne trouvée.');
    } else {
      setResults([]);
      setMessage(res.error?.message ?? 'Recherche impossible.');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
            placeholder="Rechercher (nom, téléphone, matricule)…"
            className="pl-8"
            aria-label="Rechercher une personne"
          />
        </div>
        <Button type="button" onClick={search} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechercher'}
        </Button>
      </div>

      {message && !loading && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
          {message.startsWith('Aucune') ? <SearchX className="h-4 w-4" /> : <AlertCircle className="h-4 w-4 text-rose-500" />}
          {message}
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-slate-50/60">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#16212B]">{r.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {TYPE_LABELS[r.type] ?? r.type}
                  {r.matricule ? ` · ${r.matricule}` : ''}
                  {r.className ? ` · ${r.className}` : ''}
                  {r.maskedPhone ? ` · ${r.maskedPhone}` : ''}
                  {r.maskedEmail ? ` · ${r.maskedEmail}` : ''}
                </p>
              </div>
              <Badge className={r.hasPickupAuthority ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                {r.hasPickupAuthority ? 'Retrait autorisé' : r.isLinkedGuardian ? 'Parent lié' : '—'}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
