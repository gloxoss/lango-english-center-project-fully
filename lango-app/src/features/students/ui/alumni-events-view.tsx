'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, CalendarDays, Trash2 } from 'lucide-react';

type EventRow = { id: string; title: string; description: string | null; location: string | null; startsAt: string; rsvpCounts: Record<string, number> };

export function AlumniEventsView() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', startsAt: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch('/api/students/alumni/events?pageSize=100').then(r => r.json()).then(j => j?.success && setEvents(j.data));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.startsAt) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/students/alumni/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title.trim(), description: form.description || undefined, location: form.location || undefined, startsAt: new Date(form.startsAt).toISOString() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Échec de la création.');
        return;
      }
      setShowForm(false);
      setForm({ title: '', description: '', location: '', startsAt: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/students/alumni/events?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Événements Anciens Élèves</h1>
        <Button size="sm" onClick={() => setShowForm(v => !v)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Nouvel événement
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <Input placeholder="Titre" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-9 rounded-xl text-xs" />
          <Input placeholder="Lieu" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="h-9 rounded-xl text-xs" />
          <Input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} className="h-9 rounded-xl text-xs" />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none" />
          <Button size="sm" disabled={saving} onClick={handleCreate} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
            {saving ? 'Création...' : 'Créer'}
          </Button>
        </Card>
      )}

      <div className="space-y-2">
        {events.length === 0 && (
          <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
            <CalendarDays className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Aucun événement créé.</p>
          </Card>
        )}
        {events.map(ev => (
          <Card key={ev.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-[#16212B]">{ev.title}</p>
              <p className="text-[10px] text-slate-400">{new Date(ev.startsAt).toLocaleString('fr-FR')} {ev.location ? `· ${ev.location}` : ''}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                {ev.rsvpCounts.going ?? 0} participant(s) · {ev.rsvpCounts.maybe ?? 0} peut-être
              </p>
            </div>
            <button onClick={() => handleDelete(ev.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
