'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Share2,
  Plus,
  Trash2,
  Loader2,
  CheckSquare,
  AlertTriangle,
  MessageSquare,
  Send,
  Star,
  FileText,
  Download,
  Building,
  UserCheck,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  lifecycle: 'draft' | 'published' | 'cancelled' | 'completed';
  visibility: 'internal' | 'public' | 'targeted';
  timezone?: string;
  requiresApproval: boolean;
  requiresRsvp: boolean;
  requiresCheckin: boolean;
  createdAt: string;
}

interface Occurrence {
  id: string;
  scheduleId: string;
  startTime: string;
  endTime: string;
  isCancelled: boolean;
}

interface Venue {
  id: string;
  venueType: 'physical' | 'online' | 'hybrid';
  name: string | null;
  address: string | null;
  capacity: number | null;
  onlineLink: string | null;
  accessibilityNotes: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'completed';
  dueAt: string | null;
  assigneeId: string | null;
  completedAt: string | null;
}

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolvedAt: string | null;
  reportedAt: string;
}

interface Feedback {
  id: string;
  rating: number | null;
  comment: string | null;
  submittedAt: string;
}

interface Communication {
  id: string;
  channel: 'email' | 'sms' | 'in_app';
  subject: string;
  body: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  targetCount: number;
  sentAt: string | null;
  createdAt: string;
}

interface Registration {
  id: string;
  occurrenceId: string;
  personId: string;
  status: 'going' | 'cancelled';
  seats: number;
  createdAt: string;
}

interface WaitlistEntry {
  id: string;
  occurrenceId: string;
  personId: string;
  status: 'queued' | 'offered' | 'accepted' | 'declined' | 'expired';
  offerExpiresAt: string | null;
  queuedAt: string;
}

export function EventAdminDetailView({ eventId, locale = 'fr' }: { eventId: string; locale?: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'venues' | 'registrations' | 'tasks' | 'incidents' | 'comms' | 'feedback' | 'reports'>('overview');
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Modals
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [venueForm, setVenueForm] = useState({ name: '', venueType: 'physical' as Venue['venueType'], address: '', capacity: 100, onlineLink: '', accessibilityNotes: '' });

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueAt: '' });

  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', severity: 'medium' as Incident['severity'] });

  const [commModalOpen, setCommModalOpen] = useState(false);
  const [commForm, setCommForm] = useState({ channel: 'email' as Communication['channel'], subject: '', body: '' });

  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: '' });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', visibility: 'internal' as EventDetail['visibility'], timezone: 'UTC' });

  const [modalLoading, setModalLoading] = useState(false);

  const fetchEventData = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [evtRes, venRes, tskRes, incRes, fbRes, comRes, regRes] = await Promise.all([
        fetch(`/api/addons/events/${eventId}`).then(r => r.json()),
        fetch(`/api/addons/events/${eventId}/venues`).then(r => r.json()),
        fetch(`/api/addons/events/${eventId}/tasks`).then(r => r.json()),
        fetch(`/api/addons/events/${eventId}/incidents`).then(r => r.json()),
        fetch(`/api/addons/events/${eventId}/feedback`).then(r => r.json()),
        fetch(`/api/addons/events/${eventId}/communications`).then(r => r.json()),
        fetch(`/api/addons/events/${eventId}/registrations`).then(r => r.json()),
      ]);

      if (evtRes.success && evtRes.data) {
        setEvent(evtRes.data.event);
        setOccurrences(evtRes.data.occurrences || []);
      }
      if (venRes.success && Array.isArray(venRes.data)) setVenues(venRes.data);
      if (tskRes.success && Array.isArray(tskRes.data)) setTasks(tskRes.data);
      if (incRes.success && Array.isArray(incRes.data)) setIncidents(incRes.data);
      if (fbRes.success && Array.isArray(fbRes.data)) setFeedback(fbRes.data);
      if (comRes.success && Array.isArray(comRes.data)) setCommunications(comRes.data);
      if (regRes.success && Array.isArray(regRes.data)) setRegistrations(regRes.data);

      if (evtRes.data?.occurrences?.[0]?.id) {
        const occId = evtRes.data.occurrences[0].id;
        const wlRes = await fetch(`/api/addons/events/occurrences/${occId}/waitlist`).then(r => r.json()).catch(() => ({}));
        if (wlRes.success && Array.isArray(wlRes.data)) setWaitlist(wlRes.data);
      }
    } catch (e: any) {
      setErrorBanner('Impossible de charger les données de cet événement.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  // Venue actions
  const handleAddVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const res = await fetch(`/api/addons/events/${eventId}/venues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueType: venueForm.venueType,
          name: venueForm.name.trim() || undefined,
          address: venueForm.address.trim() || undefined,
          capacity: Number(venueForm.capacity) || undefined,
          onlineLink: venueForm.onlineLink.trim() || undefined,
          accessibilityNotes: venueForm.accessibilityNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Lieu ajouté avec succès.');
        setVenueModalOpen(false);
        setVenueForm({ name: '', venueType: 'physical', address: '', capacity: 100, onlineLink: '', accessibilityNotes: '' });
        fetchEventData();
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteVenue = async (venueId: string) => {
    try {
      const res = await fetch(`/api/addons/events/${eventId}/venues/${venueId}`, { method: 'DELETE' });
      if (res.ok) {
        setFeedbackBanner('Lieu supprimé.');
        fetchEventData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Task actions
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setModalLoading(true);
    try {
      const res = await fetch(`/api/addons/events/${eventId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Tâche d\'organisation ajoutée.');
        setTaskModalOpen(false);
        setTaskForm({ title: '', description: '', dueAt: '' });
        fetchEventData();
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleTask = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    try {
      await fetch(`/api/addons/events/${eventId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchEventData();
    } catch (e) {
      console.error(e);
    }
  };

  // Incident actions
  const handleAddIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.title.trim()) return;
    setModalLoading(true);
    try {
      const res = await fetch(`/api/addons/events/${eventId}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: incidentForm.title.trim(),
          description: incidentForm.description.trim() || undefined,
          severity: incidentForm.severity,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Incident consigné dans la main courante.');
        setIncidentModalOpen(false);
        setIncidentForm({ title: '', description: '', severity: 'medium' });
        fetchEventData();
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    try {
      await fetch(`/api/addons/events/${eventId}/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      });
      setFeedbackBanner('Incident marqué comme résolu.');
      fetchEventData();
    } catch (e) {
      console.error(e);
    }
  };

  // Communication actions
  const handleSendCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commForm.subject.trim() || !commForm.body.trim()) return;
    setModalLoading(true);
    try {
      const res = await fetch(`/api/addons/events/${eventId}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: commForm.channel,
          subject: commForm.subject.trim(),
          body: commForm.body.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Message programmé et diffusé aux participants.');
        setCommModalOpen(false);
        setCommForm({ channel: 'email', subject: '', body: '' });
        fetchEventData();
      }
    } finally {
      setModalLoading(false);
    }
  };

  // Feedback action
  const handleAddFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const res = await fetch(`/api/addons/events/${eventId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: Number(feedbackForm.rating),
          comment: feedbackForm.comment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Avis enregistré.');
        setFeedbackModalOpen(false);
        setFeedbackForm({ rating: 5, comment: '' });
        fetchEventData();
      }
    } finally {
      setModalLoading(false);
    }
  };

  // Attendee actions
  const handleCheckin = async (personId: string, occurrenceId: string) => {
    try {
      const res = await fetch(`/api/addons/events/occurrences/${occurrenceId}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, method: 'manual_search' }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Présence émargée avec succès.');
        fetchEventData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelRegistration = async (regId: string) => {
    try {
      const res = await fetch(`/api/addons/events/registrations/${regId}/cancel`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Inscription annulée.');
        fetchEventData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Lifecycle publish / cancel
  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/addons/events/${eventId}/publish`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Événement publié avec succès.');
        fetchEventData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelEvent = async () => {
    if (!confirm('Confirmez-vous l\'annulation de cet événement ?')) return;
    try {
      const res = await fetch(`/api/addons/events/${eventId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Annulé par l\'administrateur' }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Événement annulé.');
        fetchEventData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenEdit = () => {
    if (!event) return;
    setEditForm({
      title: event.title,
      description: event.description ?? '',
      visibility: event.visibility,
      timezone: event.timezone ?? 'UTC',
    });
    setEditModalOpen(true);
  };

  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim()) return;
    setModalLoading(true);
    try {
      const res = await fetch(`/api/addons/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          visibility: editForm.visibility,
          timezone: editForm.timezone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackBanner('Événement modifié avec succès.');
        setEditModalOpen(false);
        fetchEventData();
      } else {
        setErrorBanner(json.error?.message || 'Impossible de modifier cet événement.');
      }
    } catch (err) {
      setErrorBanner('Impossible de modifier cet événement.');
    } finally {
      setModalLoading(false);
    }
  };

  const totalCapacity = venues.reduce((sum, v) => sum + (v.capacity || 0), 0);
  const activeRegistrations = registrations.filter(r => r.status === 'going');
  const totalRegisteredSeats = activeRegistrations.reduce((sum, r) => sum + (r.seats || 1), 0);
  const avgRating = feedback.length > 0 ? (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length).toFixed(1) : '—';
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  if (loading && !event) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066FF] mb-2" />
        <p className="text-xs font-medium">Chargement des détails de l&apos;événement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Back Link and Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/${locale}/dashboard/events`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0066FF] font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour au calendrier des événements
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{event?.title || 'Détails Événement'}</h1>
            {event && (
              <Badge className={
                event.lifecycle === 'published' ? 'bg-[#DDF5EC] text-[#17A673] border-none font-bold text-[10px]' :
                event.lifecycle === 'cancelled' ? 'bg-rose-100 text-rose-700 border-none font-bold text-[10px]' :
                'bg-amber-100 text-amber-800 border-none font-bold text-[10px]'
              }>
                {event.lifecycle === 'published' ? 'Publié' : event.lifecycle === 'cancelled' ? 'Annulé' : 'Brouillon'}
              </Badge>
            )}
            <Badge variant="neutral" className="text-[10px] font-bold">
              {event?.eventType || 'Général'}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/api/addons/events/${eventId}/feed.ics`}
            download
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold inline-flex items-center gap-1.5 text-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export .ICS
          </a>

          {event?.lifecycle !== 'cancelled' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEdit}
              className="h-9 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Modifier
            </Button>
          )}

          {event?.lifecycle === 'draft' && (
            <Button
              size="sm"
              onClick={handlePublish}
              className="h-9 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Publier l&apos;événement
            </Button>
          )}

          {event?.lifecycle === 'published' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEvent}
              className="h-9 text-xs rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-bold gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Annuler l&apos;événement
            </Button>
          )}
        </div>
      </div>

      {feedbackBanner && (
        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button onClick={() => setFeedbackBanner(null)} className="text-emerald-600 hover:text-emerald-800">Fermer</button>
        </div>
      )}

      {errorBanner && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-1 bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inscriptions &amp; Capacité</span>
          <div className="text-2xl font-extrabold text-[#16212B]">{totalRegisteredSeats} <span className="text-sm font-medium text-slate-400">/ {totalCapacity || 'Illimité'}</span></div>
          <p className="text-[11px] text-slate-400">{activeRegistrations.length} participants confirmés</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-1 bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Liste d&apos;attente</span>
          <div className="text-2xl font-extrabold text-amber-700">{waitlist.length}</div>
          <p className="text-[11px] text-slate-400">Demandes en attente de place</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-1 bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tâches Préparatoires</span>
          <div className="text-2xl font-extrabold text-[#0066FF]">{completedTasks} <span className="text-sm font-medium text-slate-400">/ {tasks.length}</span></div>
          <p className="text-[11px] text-slate-400">{tasks.length - completedTasks} tâche(s) restante(s)</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-1 bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Note Moyenne &amp; Avis</span>
          <div className="text-2xl font-extrabold text-emerald-600 flex items-center gap-1.5">
            <Star className="w-5 h-5 fill-emerald-500 text-emerald-500" />
            {avgRating} <span className="text-sm font-medium text-slate-400">/ 5</span>
          </div>
          <p className="text-[11px] text-slate-400">{feedback.length} évaluation(s) reçue(s)</p>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Vue d\'ensemble', icon: FileText },
          { id: 'venues', label: `Lieux & Espaces (${venues.length})`, icon: Building },
          { id: 'registrations', label: `Inscrits & Émargement (${registrations.length})`, icon: UserCheck },
          { id: 'tasks', label: `Tâches (${tasks.length})`, icon: CheckSquare },
          { id: 'incidents', label: `Incidents (${incidents.length})`, icon: AlertTriangle },
          { id: 'comms', label: `Communications (${communications.length})`, icon: Send },
          { id: 'feedback', label: `Retours (${feedback.length})`, icon: MessageSquare },
          { id: 'reports', label: 'Rapport Analytique', icon: Sparkles },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === t.id ? 'bg-[#0066FF] text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs lg:col-span-2 space-y-4">
            <h2 className="text-sm font-extrabold text-[#16212B]">Description &amp; Informations Générales</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {event?.description || 'Aucune description détaillée renseignée pour cet événement.'}
            </p>

            <div className="pt-3 border-t border-slate-100">
              <h3 className="text-xs font-extrabold text-[#16212B] mb-2">Créneaux &amp; Occurrences</h3>
              <div className="space-y-2">
                {occurrences.map((occ, idx) => (
                  <div key={occ.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-[#0066FF]" />
                      <span className="font-bold text-slate-800">Séance {idx + 1} :</span>
                      <span className="font-mono text-slate-600">
                        {new Date(occ.startTime).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} - {new Date(occ.endTime).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {occ.isCancelled && <Badge className="bg-rose-100 text-rose-700 border-none text-[10px]">Annulée</Badge>}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-3">
            <h2 className="text-sm font-extrabold text-[#16212B]">Paramètres d&apos;Accès</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Visibilité :</span>
                <span className="font-bold text-[#16212B]">{event?.visibility === 'public' ? 'Public (Ouvert)' : 'Interne (Établissement)'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Validation requise :</span>
                <span className="font-bold">{event?.requiresApproval ? 'Oui (Modération)' : 'Non (Inscription directe)'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Émargement obligatoire :</span>
                <span className="font-bold">{event?.requiresCheckin ? 'Oui (QR / Manuel)' : 'Non'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Créé le :</span>
                <span className="font-mono text-slate-600">{event?.createdAt ? new Date(event.createdAt).toLocaleDateString('fr-FR') : '—'}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Venues */}
      {activeTab === 'venues' && (
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#16212B]">Lieux et Salles Réservées</h2>
            <Button size="sm" onClick={() => setVenueModalOpen(true)} className="h-8 text-xs rounded-xl bg-[#0066FF] text-white font-bold gap-1">
              <Plus className="w-3.5 h-3.5" /> Ajouter un lieu
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {venues.map(v => (
              <div key={v.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#16212B]">{v.name || 'Salle Principale'}</span>
                  <Badge variant="neutral" className="text-[10px]">{v.venueType}</Badge>
                </div>
                {v.address && <p className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> {v.address}</p>}
                {v.capacity && <p className="text-[11px] font-bold text-slate-700">{v.capacity} places assises</p>}
                {v.onlineLink && <a href={v.onlineLink} target="_blank" rel="noreferrer" className="text-[11px] text-[#0066FF] underline block truncate">{v.onlineLink}</a>}
                <div className="flex justify-end pt-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteVenue(v.id)} className="h-7 text-[10px] text-rose-600 hover:bg-rose-50">
                    <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                  </Button>
                </div>
              </div>
            ))}
            {venues.length === 0 && <p className="text-xs text-slate-400 col-span-full py-6 text-center">Aucun lieu rattaché à cet événement.</p>}
          </div>
        </Card>
      )}

      {/* TAB 3: Registrations, Check-ins & Waitlist */}
      {activeTab === 'registrations' && (
        <div className="space-y-6">
          <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-4">
            <h2 className="text-sm font-extrabold text-[#16212B]">Participants Inscrits &amp; Émargement</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Participant ID</th>
                    <th className="py-3 px-4">Places</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Date d&apos;inscription</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.personId}</td>
                      <td className="py-3 px-4 font-bold">{r.seats}</td>
                      <td className="py-3 px-4">
                        <Badge className={r.status === 'going' ? 'bg-[#DDF5EC] text-[#17A673] border-none text-[10px]' : 'bg-slate-100 text-slate-500 border-none text-[10px]'}>
                          {r.status === 'going' ? 'Confirmé' : 'Annulé'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {r.status === 'going' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleCheckin(r.personId, r.occurrenceId)} className="h-7 text-[10px] rounded-lg text-emerald-700 border-emerald-200 bg-emerald-50/50">
                              Émarger
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleCancelRegistration(r.id)} className="h-7 text-[10px] rounded-lg text-rose-600 border-rose-200">
                              Annuler
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {registrations.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">Aucune inscription pour le moment.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-3">
            <h2 className="text-sm font-extrabold text-[#16212B]">File d&apos;Attente ({waitlist.length})</h2>
            <div className="space-y-2">
              {waitlist.map((w, idx) => (
                <div key={w.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px] flex items-center justify-center">#{idx + 1}</span>
                    <span className="font-mono font-bold text-slate-800">{w.personId}</span>
                  </div>
                  <Badge variant="neutral" className="text-[10px]">{w.status}</Badge>
                </div>
              ))}
              {waitlist.length === 0 && <p className="text-xs text-slate-400 py-2">Aucun participant en liste d&apos;attente.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: Tasks */}
      {activeTab === 'tasks' && (
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#16212B]">Plan d&apos;Actions &amp; Tâches d&apos;Organisation</h2>
            <Button size="sm" onClick={() => setTaskModalOpen(true)} className="h-8 text-xs rounded-xl bg-[#0066FF] text-white font-bold gap-1">
              <Plus className="w-3.5 h-3.5" /> Nouvelle tâche
            </Button>
          </div>
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <button onClick={() => handleToggleTask(t)} className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${t.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                    {t.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div>
                    <p className={`font-bold ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-[#16212B]'}`}>{t.title}</p>
                    {t.description && <p className="text-[11px] text-slate-500 mt-0.5">{t.description}</p>}
                  </div>
                </div>
                {t.dueAt && <span className="text-[10px] font-mono text-slate-400">Échéance: {new Date(t.dueAt).toLocaleDateString('fr-FR')}</span>}
              </div>
            ))}
            {tasks.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">Aucune tâche planifiée.</p>}
          </div>
        </Card>
      )}

      {/* TAB 5: Incidents */}
      {activeTab === 'incidents' && (
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#16212B]">Main Courante &amp; Journal des Incidents</h2>
            <Button size="sm" onClick={() => setIncidentModalOpen(true)} className="h-8 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Signaler un incident
            </Button>
          </div>
          <div className="space-y-3">
            {incidents.map(inc => (
              <div key={inc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className={
                      inc.severity === 'critical' ? 'bg-rose-600 text-white font-bold text-[9px]' :
                      inc.severity === 'high' ? 'bg-rose-100 text-rose-700 font-bold text-[9px]' :
                      'bg-amber-100 text-amber-800 font-bold text-[9px]'
                    }>
                      {inc.severity.toUpperCase()}
                    </Badge>
                    <span className="font-bold text-slate-900">{inc.title}</span>
                  </div>
                  {inc.description && <p className="text-[11px] text-slate-600">{inc.description}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">{new Date(inc.reportedAt).toLocaleString('fr-FR')}</span>
                  {!inc.resolvedAt ? (
                    <Button size="sm" variant="outline" onClick={() => handleResolveIncident(inc.id)} className="h-7 text-[10px] text-emerald-700 border-emerald-300">
                      Marquer résolu
                    </Button>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px]">Résolu</Badge>
                  )}
                </div>
              </div>
            ))}
            {incidents.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">Aucun incident signalé.</p>}
          </div>
        </Card>
      )}

      {/* TAB 6: Communications */}
      {activeTab === 'comms' && (
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#16212B]">Messages &amp; Diffusions aux Participants</h2>
            <Button size="sm" onClick={() => setCommModalOpen(true)} className="h-8 text-xs rounded-xl bg-[#0066FF] text-white font-bold gap-1">
              <Send className="w-3.5 h-3.5" /> Nouvelle communication
            </Button>
          </div>
          <div className="space-y-3">
            {communications.map(c => (
              <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" className="text-[10px] uppercase font-bold">{c.channel}</Badge>
                    <span className="font-bold text-slate-800">{c.subject}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                <p className="text-[11px] text-slate-600">{c.body}</p>
                <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-100">
                  <span>Destinataires: {c.targetCount}</span>
                  <span>• Statut: {c.status}</span>
                </div>
              </div>
            ))}
            {communications.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">Aucune communication envoyée.</p>}
          </div>
        </Card>
      )}

      {/* TAB 7: Feedback */}
      {activeTab === 'feedback' && (
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#16212B]">Évaluations &amp; Retours Participants</h2>
            <Button size="sm" variant="outline" onClick={() => setFeedbackModalOpen(true)} className="h-8 text-xs rounded-xl border-slate-200 font-bold gap-1">
              <Star className="w-3.5 h-3.5 text-amber-500" /> Ajouter un avis
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {feedback.map(fb => (
              <div key={fb.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} className={`w-3.5 h-3.5 ${star <= (fb.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{new Date(fb.submittedAt).toLocaleDateString('fr-FR')}</span>
                </div>
                {fb.comment && <p className="text-[11px] text-slate-700 italic">&ldquo;{fb.comment}&rdquo;</p>}
              </div>
            ))}
            {feedback.length === 0 && <p className="text-xs text-slate-400 col-span-full py-6 text-center">Aucun retour enregistré pour le moment.</p>}
          </div>
        </Card>
      )}

      {/* TAB 8: Reports */}
      {activeTab === 'reports' && (
        <Card className="p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-5">
          <h2 className="text-sm font-extrabold text-[#16212B]">Bilan Analytique &amp; Conversion de l&apos;Événement</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Taux de Remplissage</span>
              <div className="text-2xl font-extrabold text-[#0066FF]">
                {totalCapacity > 0 ? `${Math.round((totalRegisteredSeats / totalCapacity) * 100)}%` : '100%'}
              </div>
              <p className="text-[11px] text-slate-500">{totalRegisteredSeats} inscrits / {totalCapacity} places</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Satisfaction Globale</span>
              <div className="text-2xl font-extrabold text-emerald-600">{avgRating} / 5</div>
              <p className="text-[11px] text-slate-500">Basé sur {feedback.length} retours</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Efficacité Opérationnelle</span>
              <div className="text-2xl font-extrabold text-purple-700">
                {tasks.length > 0 ? `${Math.round((completedTasks / tasks.length) * 100)}%` : '100%'}
              </div>
              <p className="text-[11px] text-slate-500">Tâches préparatoires terminées</p>
            </div>
          </div>
        </Card>
      )}

      {/* MODALS */}
      {/* Venue Modal */}
      <Dialog open={venueModalOpen} onOpenChange={setVenueModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-extrabold">Ajouter un lieu ou une salle</DialogTitle></DialogHeader>
          <form onSubmit={handleAddVenue} className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom du lieu *</label>
              <Input value={venueForm.name} onChange={e => setVenueForm({ ...venueForm, name: e.target.value })} placeholder="ex: Salle Polyvalente" required className="h-9 text-xs rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Type</label>
                <select value={venueForm.venueType} onChange={(e: any) => setVenueForm({ ...venueForm, venueType: e.target.value })} className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white">
                  <option value="physical">Physique</option>
                  <option value="online">En ligne</option>
                  <option value="hybrid">Hybride</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Capacité</label>
                <Input type="number" value={venueForm.capacity} onChange={e => setVenueForm({ ...venueForm, capacity: Number(e.target.value) })} className="h-9 text-xs rounded-xl" />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Adresse physique</label>
              <Input value={venueForm.address} onChange={e => setVenueForm({ ...venueForm, address: e.target.value })} placeholder="ex: Bâtiment B, 1er étage" className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Lien en ligne (si visio)</label>
              <Input value={venueForm.onlineLink} onChange={e => setVenueForm({ ...venueForm, onlineLink: e.target.value })} placeholder="https://meet..." className="h-9 text-xs rounded-xl" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setVenueModalOpen(false)} className="h-9 text-xs rounded-xl">Annuler</Button>
              <Button type="submit" disabled={modalLoading} className="h-9 text-xs rounded-xl bg-[#0066FF] text-white font-bold">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Modal */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-extrabold">Ajouter une tâche préparatoire</DialogTitle></DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Titre de la tâche *</label>
              <Input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="ex: Tester la sonorisation et micros" required className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description</label>
              <Input value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Détails..." className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date d&apos;échéance</label>
              <Input type="date" value={taskForm.dueAt} onChange={e => setTaskForm({ ...taskForm, dueAt: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setTaskModalOpen(false)} className="h-9 text-xs rounded-xl">Annuler</Button>
              <Button type="submit" disabled={modalLoading} className="h-9 text-xs rounded-xl bg-[#0066FF] text-white font-bold">Créer la tâche</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Incident Modal */}
      <Dialog open={incidentModalOpen} onOpenChange={setIncidentModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-extrabold">Signaler un incident</DialogTitle></DialogHeader>
          <form onSubmit={handleAddIncident} className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Intitulé de l&apos;incident *</label>
              <Input value={incidentForm.title} onChange={e => setIncidentForm({ ...incidentForm, title: e.target.value })} placeholder="ex: Panne du projecteur principal" required className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Gravité</label>
              <select value={incidentForm.severity} onChange={(e: any) => setIncidentForm({ ...incidentForm, severity: e.target.value })} className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white">
                <option value="low">Faible (Mineur)</option>
                <option value="medium">Moyenne</option>
                <option value="high">Élevée</option>
                <option value="critical">Critique (Bloquant)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description détaillée</label>
              <Input value={incidentForm.description} onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })} placeholder="Mesures prises ou impact..." className="h-9 text-xs rounded-xl" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIncidentModalOpen(false)} className="h-9 text-xs rounded-xl">Annuler</Button>
              <Button type="submit" disabled={modalLoading} className="h-9 text-xs rounded-xl bg-rose-600 text-white font-bold">Consigner</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Communication Modal */}
      <Dialog open={commModalOpen} onOpenChange={setCommModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-extrabold">Diffuser un message aux participants</DialogTitle></DialogHeader>
          <form onSubmit={handleSendCommunication} className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Canal de diffusion</label>
              <select value={commForm.channel} onChange={(e: any) => setCommForm({ ...commForm, channel: e.target.value })} className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white">
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="in_app">Notification In-App</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Objet / Sujet *</label>
              <Input value={commForm.subject} onChange={e => setCommForm({ ...commForm, subject: e.target.value })} placeholder="ex: Rappel : Début de la cérémonie à 14h00" required className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Contenu du message *</label>
              <Input value={commForm.body} onChange={e => setCommForm({ ...commForm, body: e.target.value })} placeholder="Texte de l'annonce..." required className="h-9 text-xs rounded-xl" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCommModalOpen(false)} className="h-9 text-xs rounded-xl">Annuler</Button>
              <Button type="submit" disabled={modalLoading} className="h-9 text-xs rounded-xl bg-[#0066FF] text-white font-bold">Diffuser</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-extrabold">Ajouter une évaluation participant</DialogTitle></DialogHeader>
          <form onSubmit={handleAddFeedback} className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Note sur 5 étoiles</label>
              <select value={feedbackForm.rating} onChange={e => setFeedbackForm({ ...feedbackForm, rating: Number(e.target.value) })} className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white">
                <option value={5}>5 / 5 — Excellent</option>
                <option value={4}>4 / 5 — Très bon</option>
                <option value={3}>3 / 5 — Moyen</option>
                <option value={2}>2 / 5 — Insuffisant</option>
                <option value={1}>1 / 5 — Médiocre</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Commentaire ou suggestion</label>
              <Input value={feedbackForm.comment} onChange={e => setFeedbackForm({ ...feedbackForm, comment: e.target.value })} placeholder="Retour du participant..." className="h-9 text-xs rounded-xl" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setFeedbackModalOpen(false)} className="h-9 text-xs rounded-xl">Annuler</Button>
              <Button type="submit" disabled={modalLoading} className="h-9 text-xs rounded-xl bg-[#0066FF] text-white font-bold">Enregistrer l&apos;avis</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Event Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-extrabold">Modifier l&apos;événement</DialogTitle></DialogHeader>
          <form onSubmit={handleEditEvent} className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Titre *</label>
              <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Intitulé de l'événement" required className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description</label>
              <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Détails..." rows={3} className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Visibilité</label>
                <select value={editForm.visibility} onChange={(e: any) => setEditForm({ ...editForm, visibility: e.target.value })} className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white">
                  <option value="internal">Interne</option>
                  <option value="public">Public</option>
                  <option value="targeted">Ciblé</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Fuseau horaire</label>
                <Input value={editForm.timezone} onChange={e => setEditForm({ ...editForm, timezone: e.target.value })} placeholder="UTC" className="h-9 text-xs rounded-xl" />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)} className="h-9 text-xs rounded-xl">Annuler</Button>
              <Button type="submit" disabled={modalLoading} className="h-9 text-xs rounded-xl bg-[#0066FF] text-white font-bold">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
