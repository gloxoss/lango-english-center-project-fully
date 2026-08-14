'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { CalendarDays, MapPin } from 'lucide-react';

type EventRow = { id: string; title: string; description: string | null; location: string | null; startsAt: string; myRsvpStatus: string | null };

const RSVP_OPTIONS: { value: string; label: string }[] = [
  { value: 'going', label: 'Je participe' },
  { value: 'maybe', label: 'Peut-être' },
  { value: 'not_going', label: 'Je ne participe pas' },
];

export default function AlumniEventsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    fetch('/api/alumni/me/events').then(r => r.json()).then(j => j?.success && setEvents(j.data));
  };

  useEffect(() => { load(); }, []);

  const handleRsvp = async (eventId: string, status: string) => {
    setUpdating(eventId);
    try {
      await fetch(`/api/alumni/me/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      load();
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Événements</h1>

      <div className="space-y-3">
        {events === null && <p className="text-xs text-slate-400">Chargement...</p>}
        {events !== null && events.length === 0 && (
          <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
            <CalendarDays className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Aucun événement à venir</p>
          </Card>
        )}
        {events?.map(ev => (
          <Card key={ev.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <p className="text-sm font-extrabold text-[#16212B]">{ev.title}</p>
            <p className="text-xs text-slate-500 mt-1">{new Date(ev.startsAt).toLocaleString('fr-FR')}</p>
            {ev.location && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{ev.location}</p>}
            {ev.description && <p className="text-xs text-slate-600 mt-2">{ev.description}</p>}
            <div className="flex items-center gap-2 mt-3">
              {RSVP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  disabled={updating === ev.id}
                  onClick={() => handleRsvp(ev.id, opt.value)}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors ${ev.myRsvpStatus === opt.value ? 'bg-[#2487B8] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
