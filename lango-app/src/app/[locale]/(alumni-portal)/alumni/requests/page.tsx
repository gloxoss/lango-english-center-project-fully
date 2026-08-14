'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox } from 'lucide-react';

type RequestRow = { id: string; type: string; status: string; note: string; decisionNote: string | null; createdAt: string };

const TYPE_OPTIONS = [
  { value: 'correction', label: 'Correction d\'un document' },
  { value: 'reissue', label: 'Réémission d\'un document' },
  { value: 'data_access', label: 'Accès à mes données' },
  { value: 'deletion', label: 'Suppression de mes données optionnelles' },
];
const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', approved: 'bg-[#DDF5EC] text-[#17A673]', rejected: 'bg-rose-100 text-rose-600',
};

export default function AlumniRequestsPage() {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [type, setType] = useState('correction');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch('/api/alumni/me/requests').then(r => r.json()).then(j => j?.success && setRows(j.data));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/alumni/me/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, note: note.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Échec de l\'envoi.');
        return;
      }
      setNote('');
      load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Mes demandes</h1>

      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h3 className="text-sm font-extrabold text-[#16212B]">Nouvelle demande</h3>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <select value={type} onChange={e => setType(e.target.value)} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs">
          {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <textarea
          placeholder="Décrivez votre demande..."
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none"
        />
        <Button size="sm" disabled={submitting || !note.trim()} onClick={handleSubmit} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
          {submitting ? 'Envoi...' : 'Envoyer la demande'}
        </Button>
      </Card>

      <div className="space-y-2">
        {rows === null && <p className="text-xs text-slate-400">Chargement...</p>}
        {rows !== null && rows.length === 0 && (
          <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
            <Inbox className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Aucune demande envoyée pour le moment.</p>
          </Card>
        )}
        {rows?.map(r => (
          <Card key={r.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <Badge className={`${STATUS_BADGE[r.status]} border-none text-[10px]`}>{r.status}</Badge>
              <span className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>
            <p className="text-xs text-slate-600 mt-2">{r.note}</p>
            {r.decisionNote && <p className="text-[10px] text-slate-400 mt-1">Réponse : {r.decisionNote}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
