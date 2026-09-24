'use client';

import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  isPublished: boolean;
  capacity: number | null;
  targetCohortSessionYearId: string | null;
  targetCohortName: string | null;
  targetBranchId: string | null;
  targetBranchName: string | null;
  attachmentUrl: string | null;
  isCancelled: boolean;
  cancellationReason: string | null;
  rsvpCounts: Record<string, number>;
  waitlistCount: number;
  checkedInCount: number;
};

type Attendee = {
  rsvpId: string;
  alumnusId: string;
  alumnusName: string;
  alumnusEmail: string | null;
  alumnusPhone: string | null;
  status: string;
  isWaitlisted: boolean;
  waitlistPosition: number | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  updatedAt: string;
};

type SessionYear = { id: string; name: string };
type Branch = { id: string; name: string };

export function AlumniEventsView() {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<SessionYear[]>([]);
  const [branchesList, setBranchesList] = useState<Branch[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    startsAt: '',
    endsAt: '',
    capacity: '',
    targetCohortSessionYearId: '',
    targetBranchId: '',
    attachmentUrl: '',
    isPublished: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attendees modal state
  const [activeEventModal, setActiveEventModal] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  // Cancellation modal state
  const [cancellingEvent, setCancellingEvent] = useState<EventRow | null>(null);
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/students/alumni/events?pageSize=100');
      const j = await res.json();
      if (j?.success) {
        setEvents(j.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const [cyRes, brRes] = await Promise.all([
        fetch('/api/academics/academic-years'),
        fetch('/api/settings/branches'),
      ]);
      const [cyJson, brJson] = await Promise.all([cyRes.json(), brRes.json()]);
      if (cyJson?.success) {
        setCohorts(cyJson.data ?? []);
      }
      if (brJson?.success) {
        setBranchesList(brJson.data ?? []);
      }
    } catch {
      // Non-blocking metadata fallback
    }
  };

  useEffect(() => {
    load();
    loadMetadata();
  }, []);

  const openCreateForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      description: '',
      location: '',
      startsAt: '',
      endsAt: '',
      capacity: '',
      targetCohortSessionYearId: '',
      targetBranchId: '',
      attachmentUrl: '',
      isPublished: true,
    });
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (ev: EventRow) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description || '',
      location: ev.location || '',
      startsAt: ev.startsAt ? new Date(ev.startsAt).toISOString().slice(0, 16) : '',
      endsAt: ev.endsAt ? new Date(ev.endsAt).toISOString().slice(0, 16) : '',
      capacity: ev.capacity != null ? String(ev.capacity) : '',
      targetCohortSessionYearId: ev.targetCohortSessionYearId || '',
      targetBranchId: ev.targetBranchId || '',
      attachmentUrl: ev.attachmentUrl || '',
      isPublished: ev.isPublished,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.startsAt) {
      setError('Veuillez renseigner le titre et la date de début.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description ? form.description.trim() : null,
        location: form.location ? form.location.trim() : null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        capacity: form.capacity ? Number.parseInt(form.capacity, 10) : null,
        targetCohortSessionYearId: form.targetCohortSessionYearId || null,
        targetBranchId: form.targetBranchId || null,
        attachmentUrl: form.attachmentUrl ? form.attachmentUrl.trim() : null,
        isPublished: form.isPublished,
      };

      let res: Response;
      if (editingId) {
        res = await fetch('/api/students/alumni/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await fetch('/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || 'Échec de l\'enregistrement.');
        return;
      }

      setShowForm(false);
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (ev: EventRow) => {
    try {
      await fetch('/api/students/alumni/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ev.id, isPublished: !ev.isPublished }),
      });
      load();
    } catch (e) {
      console.error('Failed to toggle publish status:', e);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancellingEvent) {
      return;
    }
    try {
      await fetch('/api/students/alumni/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cancellingEvent.id,
          isCancelled: true,
          cancellationReason: cancellationReasonInput.trim() || 'Annulé par l\'administration',
        }),
      });
      setCancellingEvent(null);
      setCancellationReasonInput('');
      load();
    } catch (e) {
      console.error('Failed to cancel event:', e);
    }
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`${tCommon('delete')} ?`)) {
      return;
    }
    const res = await fetch(`/api/students/alumni/events?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      // eslint-disable-next-line no-alert
      alert(json.error?.message || json.message || 'Impossible de supprimer cet événement. Veuillez l\'annuler à la place.');
    }
    load();
  };

  const openAttendeesModal = async (ev: EventRow) => {
    setActiveEventModal(ev);
    setLoadingAttendees(true);
    try {
      const res = await fetch(`/api/students/alumni/events?eventId=${ev.id}`);
      const json = await res.json();
      if (json.success) {
        setAttendees(json.data.attendees || []);
      }
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleCheckInToggle = async (attendee: Attendee) => {
    if (!activeEventModal) {
      return;
    }
    try {
      const res = await fetch('/api/students/alumni/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_in',
          eventId: activeEventModal.id,
          alumnusId: attendee.alumnusId,
          checkedIn: !attendee.checkedIn,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAttendees(prev =>
          prev.map(a =>
            a.alumnusId === attendee.alumnusId
              ? { ...a, checkedIn: !a.checkedIn, checkedInAt: !a.checkedIn ? new Date().toISOString() : null }
              : a,
          ),
        );
        load();
      }
    } catch (e) {
      console.error('Check-in error:', e);
    }
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      {/* Top Header */}
      <div className="
        flex flex-col items-start justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('alumniEventsTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">Gestion des événements, audiences ciblées, jauges et listes d'attente</p>
        </div>
        <Button
          size="sm"
          onClick={() => (showForm ? setShowForm(false) : openCreateForm())}
          className="
            h-9 cursor-pointer gap-1.5 rounded-xl bg-[#2487B8] text-xs font-bold
            text-white shadow-xs
            hover:bg-[#1B6C93]
          "
        >
          {showForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {showForm ? tCommon('cancel') : t('newEvent')}
        </Button>
      </div>

      {/* Create / Edit Drawer */}
      {showForm && (
        <Card className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-xs
        "
        >
          <div className="
            flex items-center justify-between border-b border-slate-100 pb-3
          "
          >
            <h2 className="text-sm font-extrabold text-[#16212B]">
              {editingId ? t('alumniEventEdit') : t('newEvent')}
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="
                cursor-pointer text-xs font-semibold text-slate-400
                hover:text-slate-600
              "
            >
              Fermer
            </button>
          </div>

          {error && (
            <p className="
              rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs
              font-semibold text-rose-600
            "
            >
              {error}
            </p>
          )}

          <div className="
            grid grid-cols-1 gap-3
            sm:grid-cols-2
          "
          >
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Titre de l'événement *</label>
              <Input
                placeholder="ex. Soirée Annuelle des Anciens Élèves"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Lieu</label>
              <Input
                placeholder="ex. Salle Polyvalente / Campus Principal"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Date et heure de début *</label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={e => setForm({ ...form, startsAt: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Date et heure de fin</label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={e => setForm({ ...form, endsAt: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                {t('alumniEventCapacity')}
                {' '}
                (optionnel)
              </label>
              <Input
                type="number"
                min="1"
                placeholder={t('alumniEventUnlimited')}
                value={form.capacity}
                onChange={e => setForm({ ...form, capacity: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                {t('alumniEventAttachment')}
                {' '}
                (URL / lien)
              </label>
              <Input
                placeholder="https://... flyer ou programme PDF"
                value={form.attachmentUrl}
                onChange={e => setForm({ ...form, attachmentUrl: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">{t('alumniEventTargetCohort')}</label>
              <select
                value={form.targetCohortSessionYearId}
                onChange={e => setForm({ ...form, targetCohortSessionYearId: e.target.value })}
                className="
                  h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3
                  text-xs outline-none
                  focus:bg-white
                "
              >
                <option value="">{t('alumniEventAllCohorts')}</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    Promotion :
                    {' '}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">{t('alumniEventTargetBranch')}</label>
              <select
                value={form.targetBranchId}
                onChange={e => setForm({ ...form, targetBranchId: e.target.value })}
                className="
                  h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3
                  text-xs outline-none
                  focus:bg-white
                "
              >
                <option value="">{t('alumniEventAllBranches')}</option>
                {branchesList.map(b => (
                  <option key={b.id} value={b.id}>
                    Annexe :
                    {' '}
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">{tCommon('description')}</label>
            <textarea
              placeholder="Détails du programme, intervenants ou instructions pratiques..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="
                w-full resize-none rounded-xl border border-slate-200
                bg-slate-50 p-3 text-xs outline-none
                focus:bg-white
              "
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPublished"
              checked={form.isPublished}
              onChange={e => setForm({ ...form, isPublished: e.target.checked })}
              className="
                size-4 cursor-pointer rounded-sm border-slate-300 text-[#2487B8]
                focus:ring-[#2487B8]
              "
            />
            <label
              htmlFor="isPublished"
              className="cursor-pointer text-xs font-semibold text-slate-700"
            >
              Publier immédiatement (visible sur le portail des anciens élèves)
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              className="h-9 rounded-xl text-xs font-bold"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSave}
              className="
                h-9 cursor-pointer rounded-xl bg-[#2487B8] text-xs font-bold
                text-white
                hover:bg-[#1B6C93]
              "
            >
              {saving ? tCommon('loading') : tCommon('save')}
            </Button>
          </div>
        </Card>
      )}

      {/* Events List */}
      <div className="space-y-3">
        {loading && (
          <div className="
            animate-pulse p-8 text-center text-xs font-semibold text-slate-400
          "
          >
            Chargement des événements...
          </div>
        )}

        {!loading && events.length === 0 && (
          <Card className="
            flex flex-col items-center justify-center gap-3 rounded-2xl border
            border-slate-200/80 bg-white p-12 text-center shadow-xs
          "
          >
            <CalendarDays className="size-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Aucun événement enregistré.</p>
            <Button
              size="sm"
              onClick={openCreateForm}
              className="
                mt-2 h-8 cursor-pointer gap-1.5 rounded-xl bg-[#2487B8] text-xs
                text-white
                hover:bg-[#1B6C93]
              "
            >
              <Plus className="size-3.5" />
              Créer le premier événement
            </Button>
          </Card>
        )}

        {events.map((ev) => {
          const goingCount = ev.rsvpCounts.going ?? 0;
          const maybeCount = ev.rsvpCounts.maybe ?? 0;
          const isCapacityConfigured = ev.capacity != null;

          return (
            <Card
              key={ev.id}
              className={`
                rounded-2xl border bg-white p-5 shadow-xs transition-all
                ${
            ev.isCancelled
              ? 'border-rose-200 bg-rose-50/20'
              : !ev.isPublished
                  ? 'border-amber-200 bg-amber-50/10'
                  : 'border-slate-200/80'
            }
              `}
            >
              <div className="
                flex flex-col items-start justify-between gap-3
                sm:flex-row sm:items-center
              "
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-[#16212B]">{ev.title}</span>

                    {/* Status Badges */}
                    {ev.isCancelled
                      ? (
                          <span className="
                            flex items-center gap-1 rounded-full bg-rose-100
                            px-2 py-0.5 text-[10px] font-extrabold text-rose-700
                          "
                          >
                            <Ban className="size-3" />
                            {t('alumniEventCancelled')}
                          </span>
                        )
                      : !ev.isPublished
                          ? (
                              <span className="
                                flex items-center gap-1 rounded-full
                                bg-amber-100 px-2 py-0.5 text-[10px]
                                font-extrabold text-amber-800
                              "
                              >
                                <EyeOff className="size-3" />
                                {t('alumniEventDraft')}
                              </span>
                            )
                          : (
                              <span className="
                                flex items-center gap-1 rounded-full
                                bg-emerald-100 px-2 py-0.5 text-[10px]
                                font-extrabold text-emerald-800
                              "
                              >
                                <CheckCircle2 className="size-3" />
                                {t('alumniEventPublished')}
                              </span>
                            )}

                    {/* Audience Scope Badges */}
                    {ev.targetCohortName && (
                      <span className="
                        flex items-center gap-1 rounded-full bg-slate-100 px-2
                        py-0.5 text-[10px] font-semibold text-slate-700
                      "
                      >
                        <GraduationCap className="size-3 text-slate-400" />
                        {ev.targetCohortName}
                      </span>
                    )}
                    {ev.targetBranchName && (
                      <span className="
                        rounded-full bg-slate-100 px-2 py-0.5 text-[10px]
                        font-semibold text-slate-700
                      "
                      >
                        {ev.targetBranchName}
                      </span>
                    )}
                  </div>

                  {ev.isCancelled && ev.cancellationReason && (
                    <p className="
                      flex items-center gap-1 pt-0.5 text-xs font-semibold
                      text-rose-600
                    "
                    >
                      <AlertTriangle className="size-3.5" />
                      Motif :
                      {' '}
                      {ev.cancellationReason}
                    </p>
                  )}

                  <div className="
                    flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs
                    text-slate-500
                  "
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-slate-400" />
                      {new Date(ev.startsAt).toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-slate-400" />
                        {ev.location}
                      </span>
                    )}
                    {ev.attachmentUrl && (
                      <a
                        href={ev.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="
                          flex items-center gap-1 font-semibold text-[#2487B8]
                          hover:underline
                        "
                      >
                        <Paperclip className="size-3" />
                        Document joint
                      </a>
                    )}
                  </div>

                  {ev.description && (
                    <p className="line-clamp-2 pt-1 text-xs text-slate-600">
                      {ev.description}
                    </p>
                  )}
                </div>

                {/* Top Action Buttons */}
                <div className="
                  flex items-center gap-1 self-end
                  sm:self-center
                "
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAttendeesModal(ev)}
                    className="
                      h-8 cursor-pointer gap-1.5 rounded-xl border-slate-200
                      text-xs font-bold
                      hover:bg-slate-50
                    "
                  >
                    <Users className="size-3.5 text-[#2487B8]" />
                    {t('alumniEventParticipants')}
                    {' '}
                    (
                    {goingCount}
                    )
                  </Button>

                  <button
                    onClick={() => handleTogglePublish(ev)}
                    title={ev.isPublished ? t('alumniEventUnpublishAction') : t('alumniEventPublishAction')}
                    className="
                      cursor-pointer rounded-lg p-2 text-slate-400
                      transition-colors
                      hover:bg-slate-100 hover:text-slate-700
                    "
                  >
                    {ev.isPublished
                      ? <EyeOff className="size-4" />
                      : (
                          <Eye className="size-4" />
                        )}
                  </button>

                  {!ev.isCancelled && (
                    <button
                      onClick={() => {
                        setCancellingEvent(ev);
                        setCancellationReasonInput('');
                      }}
                      title={t('alumniEventCancelAction')}
                      className="
                        cursor-pointer rounded-lg p-2 text-slate-400
                        transition-colors
                        hover:bg-amber-50 hover:text-amber-600
                      "
                    >
                      <Ban className="size-4" />
                    </button>
                  )}

                  <button
                    onClick={() => openEditForm(ev)}
                    title={t('alumniEventEdit')}
                    className="
                      cursor-pointer rounded-lg p-2 text-slate-400
                      transition-colors
                      hover:bg-slate-100 hover:text-slate-700
                    "
                  >
                    <Pencil className="size-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(ev.id)}
                    title={tCommon('delete')}
                    className="
                      cursor-pointer rounded-lg p-2 text-slate-400
                      transition-colors
                      hover:bg-rose-50 hover:text-rose-600
                    "
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* Metrics Bar */}
              <div className="
                mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3
                sm:grid-cols-4
              "
              >
                <div className="
                  rounded-xl border border-slate-100 bg-slate-50 p-2.5
                "
                >
                  <p className="
                    text-[10px] font-bold tracking-wider text-slate-500
                    uppercase
                  "
                  >
                    Inscrits
                  </p>
                  <p className="text-sm font-black text-[#16212B]">
                    {goingCount}
                    {' '}
                    {isCapacityConfigured ? `/ ${ev.capacity}` : ''}
                  </p>
                </div>

                <div className={`
                  rounded-xl border p-2.5
                  ${ev.waitlistCount > 0
              ? `border-amber-200 bg-amber-50`
              : `border-slate-100 bg-slate-50`}
                `}
                >
                  <p className="
                    text-[10px] font-bold tracking-wider text-slate-500
                    uppercase
                  "
                  >
                    {t('alumniEventWaitlist')}
                  </p>
                  <p className={`
                    text-sm font-black
                    ${ev.waitlistCount > 0
              ? `text-amber-700`
              : `text-[#16212B]`}
                  `}
                  >
                    {ev.waitlistCount}
                  </p>
                </div>

                <div className={`
                  rounded-xl border p-2.5
                  ${ev.checkedInCount > 0
              ? `border-emerald-200 bg-emerald-50`
              : `border-slate-100 bg-slate-50`}
                `}
                >
                  <p className="
                    text-[10px] font-bold tracking-wider text-slate-500
                    uppercase
                  "
                  >
                    Présents (Pointés)
                  </p>
                  <p className={`
                    text-sm font-black
                    ${ev.checkedInCount > 0
              ? `text-emerald-700`
              : `text-[#16212B]`}
                  `}
                  >
                    {ev.checkedInCount}
                  </p>
                </div>

                <div className="
                  rounded-xl border border-slate-100 bg-slate-50 p-2.5
                "
                >
                  <p className="
                    text-[10px] font-bold tracking-wider text-slate-500
                    uppercase
                  "
                  >
                    Peut-être
                  </p>
                  <p className="text-sm font-black text-[#16212B]">{maybeCount}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Attendees & Check-in Modal */}
      {activeEventModal && (
        <div className="
          fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40
          p-4 backdrop-blur-xs
        "
        >
          <Card className="
            flex max-h-[85vh] w-full max-w-[700px] flex-col overflow-hidden
            rounded-2xl bg-white shadow-xl
          "
          >
            <div className="
              flex items-center justify-between border-b border-slate-100 p-4
            "
            >
              <div>
                <h3 className="
                  flex items-center gap-2 text-sm font-extrabold text-[#16212B]
                "
                >
                  <Users className="size-4 text-[#2487B8]" />
                  Pointage & Participants —
                  {' '}
                  {activeEventModal.title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {attendees.filter(a => a.status === 'going' && !a.isWaitlisted).length}
                  {' '}
                  confirmés ·
                  {' '}
                  {attendees.filter(a => a.isWaitlisted).length}
                  {' '}
                  en attente ·
                  {' '}
                  <span className="font-bold text-emerald-600">
                    {attendees.filter(a => a.checkedIn).length}
                    {' '}
                    présents
                  </span>
                </p>
              </div>
              <button
                onClick={() => setActiveEventModal(null)}
                className="
                  rounded-lg p-1 text-xs font-bold text-slate-400
                  hover:bg-slate-100
                "
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {loadingAttendees && (
                <p className="
                  animate-pulse py-6 text-center text-xs font-semibold
                  text-slate-400
                "
                >
                  Chargement des participants...
                </p>
              )}

              {!loadingAttendees && attendees.length === 0 && (
                <div className="
                  py-8 text-center text-xs font-bold text-slate-400
                "
                >
                  Aucun inscrit pour le moment.
                </div>
              )}

              {!loadingAttendees
                && attendees.map(att => (
                  <div
                    key={att.rsvpId}
                    className={`
                      flex items-center justify-between rounded-xl border p-3
                      transition-colors
                      ${
                  att.checkedIn
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : `border-slate-100 bg-white`
                  }
                    `}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#16212B]">{att.alumnusName}</span>
                        {att.isWaitlisted
                          ? (
                              <span className="
                                rounded-full bg-amber-100 px-2 py-0.5 text-[9px]
                                font-black text-amber-800
                              "
                              >
                                Liste d'attente #
                                {att.waitlistPosition}
                              </span>
                            )
                          : att.status === 'going'
                            ? (
                                <span className="
                                  rounded-full bg-emerald-100 px-2 py-0.5
                                  text-[9px] font-black text-emerald-800
                                "
                                >
                                  Confirmé
                                </span>
                              )
                            : (
                                <span className="
                                  rounded-full bg-slate-100 px-2 py-0.5
                                  text-[9px] font-bold text-slate-600
                                "
                                >
                                  Peut-être
                                </span>
                              )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {att.alumnusEmail || 'Sans email'}
                        {' '}
                        {att.alumnusPhone ? `· ${att.alumnusPhone}` : ''}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleCheckInToggle(att)}
                      className={`
                        h-8 cursor-pointer rounded-xl text-xs font-bold
                        ${
                  att.checkedIn
                    ? `
                      bg-emerald-600 text-white
                      hover:bg-emerald-700
                    `
                    : `
                      bg-slate-100 text-slate-700
                      hover:bg-slate-200
                    `
                  }
                      `}
                    >
                      {att.checkedIn ? '✓ Présent' : 'Marquer présent'}
                    </Button>
                  </div>
                ))}
            </div>

            <div className="flex justify-end border-t border-slate-100 p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveEventModal(null)}
                className="h-8 rounded-xl text-xs font-bold"
              >
                Fermer
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Cancel Event Prompt Modal */}
      {cancellingEvent && (
        <div className="
          fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40
          p-4 backdrop-blur-xs
        "
        >
          <Card className="
            w-full max-w-[450px] space-y-4 rounded-2xl bg-white p-5 shadow-xl
          "
          >
            <div>
              <h3 className="
                flex items-center gap-2 text-sm font-extrabold text-[#16212B]
              "
              >
                <AlertTriangle className="size-4 text-amber-500" />
                {t('alumniEventCancelAction')}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Êtes-vous sûr de vouloir annuler «
                {' '}
                {cancellingEvent.title}
                {' '}
                » ?
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                {t('alumniEventCancellationReason')}
                {' '}
                (optionnel)
              </label>
              <Input
                placeholder="ex. Reporté pour raisons météorologiques"
                value={cancellationReasonInput}
                onChange={e => setCancellationReasonInput(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="
              flex justify-end gap-2 border-t border-slate-100 pt-2
            "
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancellingEvent(null)}
                className="h-8 rounded-xl text-xs font-bold"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleCancelSubmit}
                className="
                  h-8 cursor-pointer rounded-xl bg-rose-600 text-xs font-bold
                  text-white
                  hover:bg-rose-700
                "
              >
                Confirmer l'annulation
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
