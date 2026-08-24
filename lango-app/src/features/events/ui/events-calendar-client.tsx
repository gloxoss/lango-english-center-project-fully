'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar, MapPin, Users, Plus, Search, CheckCircle2, Check
} from 'lucide-react';
export type EventItem = {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  registeredCount: number;
  status: string;
};

// Maps the API event shape (features/events/services/events-service.ts
// listVisibleEvents) to the client row. registeredSeats/totalCapacity come from
// the server, not hardcoded placeholders.
function mapApiEvent(evt: any): EventItem {
  const sched = evt.schedules?.[0];
  const occ = sched?.occurrences?.[0];
  const startTime = occ?.startTime || '2026-08-10T10:00:00Z';
  return {
    id: evt.id,
    title: evt.title,
    category: evt.eventType || 'Event',
    date: startTime.slice(0, 10),
    time: startTime.slice(11, 16),
    location: evt.venues?.[0]?.name || 'TBD',
    capacity: evt.totalCapacity || evt.venues?.[0]?.capacity || 0,
    registeredCount: evt.registeredSeats || 0,
    status: evt.visibility === 'public' ? 'Public' : 'Interne',
  };
}

export function EventsCalendarClient({ locale: _locale }: { locale?: string }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadEvents = async () => {
    const res = await fetch('/api/addons/events');
    const json = await res.json();
    if (json.success && json.data) {
      const mapped = json.data.map(mapApiEvent);
      setEvents(mapped);
      if (mapped.length > 0) setSelectedEventId(mapped[0].id);
    }
    return json;
  };

  useEffect(() => {
    loadEvents().catch(console.error);
  }, []);

  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'Orientation' as EventItem['category'],
    date: '2025-06-20',
    time: '10:00 - 12:00',
    location: 'Amphithéâtre',
    capacity: 200,
  });

  const filteredEvents = useMemo(() => {
    return events.filter(
      (evt) =>
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [events, searchQuery]);

  const activeEvent = useMemo(() => {
    return events.find((evt) => evt.id === selectedEventId) || events[0]!;
  }, [events, selectedEventId]);

  const totalRegistrations = events.reduce((sum, e) => sum + e.registeredCount, 0);
  const totalCapacity = events.reduce((sum, e) => sum + e.capacity, 0);
  const occupancyRate = totalCapacity > 0 ? Math.round((totalRegistrations / totalCapacity) * 100) : 0;
  const distinctVenues = new Set(events.map(e => e.location).filter(Boolean)).size;

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim()) return;
    const [startTime, endTime] = newEvent.time.split(' - ').map((t) => t.trim());
    const body = {
      title: newEvent.title.trim(),
      visibility: 'internal' as const,
      schedules: [{
        startTime: `${newEvent.date}T${startTime || '09:00'}:00`,
        endTime: `${newEvent.date}T${endTime || '12:00'}:00`,
      }],
      venues: [{
        venueType: 'physical' as const,
        name: newEvent.location || 'TBD',
        capacity: newEvent.capacity || 100,
      }],
    };
    try {
      const res = await fetch('/api/addons/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFeedbackMsg(json.error?.message || "Échec de la création de l'événement.");
        setTimeout(() => setFeedbackMsg(null), 4000);
        return;
      }
      setNewEvent({ title: '', category: 'Orientation', date: '2025-06-20', time: '10:00 - 12:00', location: 'Amphithéâtre', capacity: 200 });
      setIsAddModalOpen(false);
      setFeedbackMsg(`Événement "${body.title}" ajouté au calendrier ! 🎉`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      await loadEvents();
    } catch (err) {
      console.error(err);
      setFeedbackMsg("Erreur réseau lors de la création de l'événement.");
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Calendrier &amp; Événements de l&apos;établissement</h1>
          <p className="text-xs text-slate-500 mt-1">Planifiez, organisez et gérez la participation aux événements scolaires.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Créer un événement
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl text-xs font-bold text-[#17A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 3 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Total événements</p>
            <p className="text-xl font-extrabold text-[#16212B]">{events.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Calendrier actif</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Inscriptions totales</p>
            <p className="text-xl font-extrabold text-[#16212B]">{totalRegistrations}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Taux d&apos;occupation {occupancyRate}%</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Lieux mobilisés</p>
            <p className="text-xl font-extrabold text-[#16212B]">{distinctVenues}</p>
            <p className="text-[10px] font-semibold text-slate-500">Lieux distincts</p>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Événements à venir</h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un événement..."
                  className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Titre de l&apos;événement</th>
                    <th className="pb-2">Catégorie</th>
                    <th className="pb-2">Date &amp; Horaire</th>
                    <th className="pb-2">Lieu</th>
                    <th className="pb-2 text-center">Inscrits</th>
                    <th className="pb-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredEvents.map((evt) => (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEventId(evt.id)}
                      className={`cursor-pointer transition-all ${
                        selectedEventId === evt.id ? 'bg-[#DCEBF4]/40 font-bold' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 font-bold text-[#16212B] text-[11px]">{evt.title}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{evt.category}</td>
                      <td className="py-2.5 font-mono text-[10px] text-slate-500">{evt.date} • {evt.time}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{evt.location}</td>
                      <td className="py-2.5 text-center font-bold text-[#2487B8]">{evt.registeredCount} / {evt.capacity}</td>
                      <td className="py-2.5">
                        <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{evt.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Inspector Panel */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            {activeEvent ? (
              <>
                <div className="border-b border-slate-100 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-[#16212B]">{activeEvent.title}</h2>
                    <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{activeEvent.category}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">{activeEvent.date} • {activeEvent.time}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Lieu :</span><span className="font-bold text-[#16212B]">{activeEvent.location}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Inscrits actuels :</span><span className="font-bold text-[#2487B8]">{activeEvent.registeredCount} / {activeEvent.capacity}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Statut :</span><span className="font-bold text-emerald-700">{activeEvent.status}</span></div>
                </div>

                <Link href={`/${_locale || 'fr'}/dashboard/events/${activeEvent.id}`} className="block w-full">
                  <Button className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white">
                    Gérer l&apos;événement &amp; les billets
                  </Button>
                </Link>
              </>
            ) : (
              <p className="text-xs text-slate-400">Sélectionnez un événement.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Add Event Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Créer un nouvel événement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Titre de l&apos;événement *</label>
              <Input
                placeholder="ex: Forum de l'Orientation 2025"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Catégorie</label>
              <select
                value={newEvent.category}
                onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as EventItem['category'] })}
                className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
              >
                <option value="Orientation">Orientation</option>
                <option value="Académique">Académique</option>
                <option value="Culturel">Culturel</option>
                <option value="Sport">Sport</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Date</label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Capacité max</label>
                <Input
                  type="number"
                  placeholder="200"
                  value={newEvent.capacity}
                  onChange={(e) => setNewEvent({ ...newEvent, capacity: Number(e.target.value) || 50 })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateEvent} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Enregistrer l&apos;événement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
