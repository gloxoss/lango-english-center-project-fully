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
  Calendar as CalendarIcon,
  MapPin,
  Users,
  Plus,
  Search,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
  Clock,
  Building,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
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

const CATEGORIES = [
  { id: 'all', label: 'Tous', color: 'bg-slate-100 text-slate-700' },
  { id: 'Orientation', label: 'Orientation', color: 'bg-blue-50 text-[#0066FF] border-blue-200' },
  { id: 'Académique', label: 'Académique', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Culturel', label: 'Culturel', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Sport', label: 'Sport', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'Examen', label: 'Examen', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

function getCategoryBadgeClass(category: string) {
  switch (category?.toLowerCase()) {
    case 'orientation':
      return 'bg-blue-50 text-[#0066FF] border-blue-200';
    case 'académique':
    case 'academique':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'culturel':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'sport':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'examen':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function mapApiEvent(evt: any): EventItem {
  const sched = evt.schedules?.[0];
  const occ = sched?.occurrences?.[0];
  const startTime = occ?.startTime || '2026-09-15T09:00:00Z';
  const endTime = occ?.endTime || '2026-09-15T11:00:00Z';
  const startHours = startTime.slice(11, 16);
  const endHours = endTime.slice(11, 16);
  return {
    id: evt.id,
    title: evt.title,
    category: evt.eventType || evt.typeId || 'Orientation',
    date: startTime.slice(0, 10),
    time: `${startHours} - ${endHours}`,
    location: evt.venues?.[0]?.name || 'Salle principale',
    capacity: evt.totalCapacity || evt.venues?.[0]?.capacity || 100,
    registeredCount: evt.registeredSeats || 0,
    status: evt.visibility === 'public' ? 'Public' : 'Interne',
  };
}

export function EventsCalendarClient({ locale: _locale }: { locale?: string }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [physicalRooms, setPhysicalRooms] = useState<Array<{ id: string; name: string; capacity: number | null }>>([]);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'Orientation',
    date: todayIso,
    startTime: '09:00',
    endTime: '11:00',
    location: '',
    capacity: 100,
    description: '',
  });

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/addons/events');
      const json = await res.json();
      if (json.success && json.data) {
        const mapped = json.data.map(mapApiEvent);
        setEvents(mapped);
        if (mapped.length > 0 && !selectedEventId) {
          setSelectedEventId(mapped[0].id);
        }
        setErrorMsg(null);
      } else {
        setErrorMsg(json?.error?.message || 'Impossible de charger les événements.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur réseau : impossible de charger les événements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
    fetch('/api/academics/rooms?pageSize=100')
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data)) {
          setPhysicalRooms(j.data);
          setRoomsError(null);
        } else {
          setRoomsError(j?.error?.message || 'Impossible de charger les salles.');
        }
      })
      .catch(() => setRoomsError('Erreur réseau : impossible de charger les salles.'));
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchesSearch =
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === 'all' ||
        evt.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [events, searchQuery, selectedCategory]);

  const activeEvent = useMemo(() => {
    return events.find((evt) => evt.id === selectedEventId) || filteredEvents[0] || events[0];
  }, [events, selectedEventId, filteredEvents]);

  // Calendar Grid Calculation
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const handlePrevMonth = () => setCurrentMonthDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentMonthDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentMonthDate(new Date());

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const totalDaysInMonth = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const days: { dayNumber: number; isCurrentMonth: boolean; iso: string }[] = [];

  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, d);
    days.push({
      dayNumber: d,
      isCurrentMonth: false,
      iso: prevDate.toISOString().slice(0, 10),
    });
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      dayNumber: d,
      isCurrentMonth: true,
      iso,
    });
  }

  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(year, month + 1, d);
    days.push({
      dayNumber: d,
      isCurrentMonth: false,
      iso: nextDate.toISOString().slice(0, 10),
    });
  }

  const monthLabel = new Intl.DateTimeFormat(_locale || 'fr', { month: 'long', year: 'numeric' }).format(currentMonthDate);
  const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Metrics
  const totalRegistrations = events.reduce((sum, e) => sum + e.registeredCount, 0);
  const totalCapacity = events.reduce((sum, e) => sum + e.capacity, 0);
  const occupancyRate = totalCapacity > 0 ? Math.round((totalRegistrations / totalCapacity) * 100) : 0;
  const distinctVenues = new Set(events.map(e => e.location).filter(Boolean)).size;

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim()) {
      setErrorMsg('Veuillez saisir le titre de l\'événement.');
      return;
    }
    setCreating(true);
    setErrorMsg(null);
    const body = {
      title: newEvent.title.trim(),
      description: newEvent.description.trim() || undefined,
      visibility: 'internal' as const,
      typeId: newEvent.category,
      schedules: [{
        startTime: `${newEvent.date}T${newEvent.startTime || '09:00'}:00`,
        endTime: `${newEvent.date}T${newEvent.endTime || '11:00'}:00`,
      }],
      venues: [{
        venueType: 'physical' as const,
        name: newEvent.location.trim() || 'Amphithéâtre',
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
        setErrorMsg(json.error?.message || 'Échec de la création de l\'événement.');
        return;
      }
      setNewEvent({
        title: '',
        category: 'Orientation',
        date: todayIso,
        startTime: '09:00',
        endTime: '11:00',
        location: '',
        capacity: 100,
        description: '',
      });
      setIsAddModalOpen(false);
      setFeedbackMsg(`Événement « ${body.title} » programmé avec succès !`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      await loadEvents();
    } catch {
      setErrorMsg('Erreur réseau lors de la création.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-xs shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Calendrier &amp; Événements de l&apos;établissement</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Planification globale, réservations des salles, billetterie et suivi des inscriptions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'calendar' ? 'bg-white text-[#0066FF] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Grille Mensuelle</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-[#0066FF] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Liste &amp; Planning</span>
            </button>
          </div>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white gap-1.5 font-bold shadow-xs cursor-pointer transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un événement</span>
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 3 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Événements</span>
            <p className="text-2xl font-extrabold text-[#16212B] mt-1">{events.length}</p>
            <p className="text-[11px] font-bold text-[#0066FF] mt-0.5">Calendrier scolaire actif</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inscriptions Totales</span>
            <p className="text-2xl font-extrabold text-[#16212B] mt-1">{totalRegistrations}</p>
            <p className="text-[11px] font-bold text-emerald-600 mt-0.5">Taux d&apos;occupation {occupancyRate}%</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lieux &amp; Salles Mobilisés</span>
            <p className="text-2xl font-extrabold text-[#16212B] mt-1">{distinctVenues}</p>
            <p className="text-[11px] font-bold text-purple-600 mt-0.5">{totalCapacity} places disponibles</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-[#0066FF] text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par titre, lieu ou catégorie..."
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl w-full sm:w-72"
          />
        </div>
      </div>

      {/* Main Grid: Calendar/List + Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          {viewMode === 'calendar' ? (
            /* Monthly Calendar Grid View */
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-[#16212B] capitalize">
                    {monthLabel}
                  </h2>
                  <Badge variant="neutral" className="text-[10px] font-bold">
                    {filteredEvents.length} événement(s)
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToday}
                    className="h-8 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    Aujourd&apos;hui
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="h-8 w-8 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
                    title="Mois précédent"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextMonth}
                    className="h-8 w-8 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
                    title="Mois suivant"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-[11px] text-slate-400 uppercase py-1">
                {weekdays.map((wd) => (
                  <div key={wd}>{wd}</div>
                ))}
              </div>

              {/* 35/42 Days Grid */}
              <div className="grid grid-cols-7 gap-1 border-t border-slate-100 pt-1">
                {days.map((d, idx) => {
                  const isToday = d.iso === todayIso;
                  const dayEvents = filteredEvents.filter((e) => e.date === d.iso);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[96px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                        d.isCurrentMonth
                          ? 'bg-white border-slate-100 hover:border-slate-300'
                          : 'bg-slate-50/50 border-transparent text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday
                              ? 'bg-[#0066FF] text-white shadow-2xs'
                              : d.isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {d.dayNumber}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-extrabold text-[#0066FF]">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-1 overflow-hidden">
                        {dayEvents.slice(0, 2).map((evt) => {
                          const isSelected = selectedEventId === evt.id;
                          return (
                            <button
                              key={evt.id}
                              type="button"
                              onClick={() => setSelectedEventId(evt.id)}
                              className={`w-full text-left px-1.5 py-0.5 rounded-lg text-[10px] font-bold truncate block transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#0066FF] text-white shadow-2xs'
                                  : `${getCategoryBadgeClass(evt.category)} hover:opacity-80`
                              }`}
                            >
                              {evt.title}
                            </button>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <span className="text-[9px] font-bold text-slate-400 block ps-1">
                            +{dayEvents.length - 2} de plus
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            /* Table & Planning View */
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-extrabold text-[#16212B]">Liste des événements programmés</h2>
                <Badge variant="neutral" className="text-[10px] font-bold">
                  {filteredEvents.length} trouvés
                </Badge>
              </div>

              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0066FF]" />
                  <span className="text-xs font-bold">Chargement des événements...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                        <th className="p-3">Titre de l&apos;événement</th>
                        <th className="p-3">Catégorie</th>
                        <th className="p-3">Date &amp; Horaire</th>
                        <th className="p-3">Lieu</th>
                        <th className="p-3 text-center">Inscrits</th>
                        <th className="p-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredEvents.map((evt) => {
                        const isSelected = selectedEventId === evt.id;
                        return (
                          <tr
                            key={evt.id}
                            onClick={() => setSelectedEventId(evt.id)}
                            className={`cursor-pointer transition-all ${
                              isSelected ? 'bg-blue-50/70 font-bold ring-1 ring-[#0066FF]/20' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="p-3 font-bold text-[#16212B] text-xs">
                              {evt.title}
                            </td>
                            <td className="p-3">
                              <Badge className={`border text-[10px] font-bold ${getCategoryBadgeClass(evt.category)}`}>
                                {evt.category}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-600">
                              {evt.date} • {evt.time}
                            </td>
                            <td className="p-3 text-slate-600 text-xs flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{evt.location}</span>
                            </td>
                            <td className="p-3 text-center font-bold text-[#0066FF]">
                              {evt.registeredCount} / {evt.capacity}
                            </td>
                            <td className="p-3">
                              <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                {evt.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredEvents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                            Aucun événement ne correspond à vos critères de recherche.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Inspector Panel */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4 sticky top-4">
            {activeEvent ? (
              <>
                <div className="border-b border-slate-100 pb-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={`border text-[10px] font-bold ${getCategoryBadgeClass(activeEvent.category)}`}>
                      {activeEvent.category}
                    </Badge>
                    <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                      {activeEvent.status}
                    </Badge>
                  </div>
                  <h2 className="text-base font-extrabold text-[#16212B] leading-snug">{activeEvent.title}</h2>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 pt-1">
                    <Clock className="w-3.5 h-3.5 text-[#0066FF]" />
                    <span>{activeEvent.date} • {activeEvent.time}</span>
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      Lieu :
                    </span>
                    <span className="font-bold text-[#16212B]">{activeEvent.location}</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Inscriptions :
                      </span>
                      <span className="font-bold text-[#0066FF]">{activeEvent.registeredCount} / {activeEvent.capacity} places</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0066FF] rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.round((activeEvent.registeredCount / (activeEvent.capacity || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Button asChild className="w-full h-9 text-xs font-bold rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white gap-2 cursor-pointer transition-all active:scale-[0.98]">
                  <Link href={`/${_locale || 'fr'}/dashboard/events/${activeEvent.id}`} className="block w-full">
                    <span>Gérer l&apos;événement &amp; les billets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </>
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">Sélectionnez un événement pour afficher ses détails.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Event Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0066FF]" />
              <span>Programmer un nouvel événement</span>
            </DialogTitle>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {roomsError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{roomsError}</span>
            </div>
          )}

          <div className="space-y-3.5 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Titre de l&apos;événement *</label>
              <Input
                placeholder="ex: Forum de l'Orientation 2026"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Catégorie</label>
                <select
                  value={newEvent.category}
                  onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-2.5 font-medium bg-white cursor-pointer"
                >
                  <option value="Orientation">Orientation</option>
                  <option value="Académique">Académique</option>
                  <option value="Culturel">Culturel</option>
                  <option value="Sport">Sport</option>
                  <option value="Examen">Examen</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Date</label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Heure de Début</label>
                <Input
                  type="time"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Heure de Fin</label>
                <Input
                  type="time"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Lieu / Salle</label>
              {physicalRooms.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    onChange={(e) => {
                      const room = physicalRooms.find(r => r.id === e.target.value);
                      if (room) {
                        setNewEvent({
                          ...newEvent,
                          location: room.name,
                          capacity: room.capacity || newEvent.capacity,
                        });
                      }
                    }}
                    className="w-full h-9 text-xs rounded-xl border border-slate-200 px-2.5 font-medium bg-slate-50 cursor-pointer"
                  >
                    <option value="">-- Choisir une salle de l&apos;école (optionnel) --</option>
                    {physicalRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.capacity ? `(${r.capacity} places)` : ''}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Ou saisissez un lieu personnalisé (ex: Terrain de sport, En ligne...)"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              ) : (
                <Input
                  placeholder="ex: Amphithéâtre Ibn Battouta"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              )}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Capacité maximale (places)</label>
              <Input
                type="number"
                placeholder="100"
                value={newEvent.capacity}
                onChange={(e) => setNewEvent({ ...newEvent, capacity: Number(e.target.value) || 50 })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9 cursor-pointer">
              Annuler
            </Button>
            <Button
              onClick={handleCreateEvent}
              disabled={creating}
              className="rounded-xl text-xs h-9 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold cursor-pointer transition-all active:scale-[0.98]"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Enregistrer l&apos;événement</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
